package com.truespend.app.notification;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.Data;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class NotificationCaptureQueueWorker extends Worker {
    public static final String UNIQUE_PREFIX = "truespend-notification-";
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    public NotificationCaptureQueueWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void enqueueEvent(Context context, String eventId) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(NotificationCaptureQueueWorker.class)
            .setConstraints(constraints)
            .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .setInputData(new Data.Builder().putString("eventId", eventId).build())
            .addTag(UNIQUE_PREFIX + "event")
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_PREFIX + eventId,
            ExistingWorkPolicy.KEEP, request);
    }

    public static void enqueueDrain(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(NotificationCaptureQueueWorker.class)
            .setConstraints(constraints)
            .setInputData(new Data.Builder().putString("drain", "true").build())
            .addTag(UNIQUE_PREFIX + "drain")
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_PREFIX + "drain",
            ExistingWorkPolicy.REPLACE, request);
    }

    @NonNull
    @Override
    public Result doWork() {
        NotificationCaptureDatabase db = NotificationCaptureDatabase.getInstance(getApplicationContext());
        if (getInputData().getBoolean("drain", false) || getInputData().getString("drain") != null) {
            JSONArray history = db.getEventHistory(200, 0);
            for (int i = 0; i < history.length(); i++) {
                JSONObject event = history.optJSONObject(i);
                String status = event == null ? "" : event.optString("status");
                if ("PENDING".equals(status) || "RETRYABLE_FAILED".equals(status)) {
                    enqueueEvent(getApplicationContext(), event.optString("eventId"));
                }
            }
            return Result.success();
        }

        String eventId = getInputData().getString("eventId");
        if (TextUtils.isEmpty(eventId) || !db.claimEvent(eventId)) return Result.success();
        JSONObject event = db.getEvent(eventId);
        if (event == null) return Result.success();

        String ownerId = event.optString("ownerUserId");
        String activeOwner = db.getActiveOwnerUserId();
        if (TextUtils.isEmpty(ownerId) || !ownerId.equals(activeOwner)) {
            db.updateEventStatus(eventId, "PERMANENT_FAILED", "ACCOUNT_MISMATCH", null);
            return Result.success();
        }

        try {
            SharedPreferences session = getSecureSession();
            String accessToken = session.getString("accessToken", "");
            String refreshToken = session.getString("refreshToken", "");
            String apiBaseUrl = session.getString("apiBaseUrl", "");
            if (apiBaseUrl.isEmpty()) apiBaseUrl = "https://true-spend-ggl.vercel.app";
            if (accessToken.isEmpty() && refreshToken.isEmpty()) {
                db.updateEventStatus(eventId, "PERMANENT_FAILED", "SIGN_IN_REQUIRED", null);
                return Result.success();
            }
            if (!refreshToken.isEmpty()) {
                String refreshed = refreshAccessToken(apiBaseUrl, refreshToken, session);
                if (!refreshed.isEmpty()) accessToken = refreshed;
            }
            if (accessToken.isEmpty()) {
                accessToken = refreshAccessToken(apiBaseUrl, refreshToken, session);
            }
            if (accessToken.isEmpty()) {
                db.updateEventStatus(eventId, "PERMANENT_FAILED", "AUTH_REQUIRED", null);
                return Result.success();
            }

            JSONObject payload = new JSONObject();
            payload.put("eventId", eventId);
            payload.put("sourcePackage", event.optString("packageName"));
            payload.put("sourceAppLabel", event.optString("appLabel"));
            payload.put("ruleIds", event.optJSONArray("ruleIds"));
            payload.put("title", event.optString("title"));
            payload.put("text", event.optString("text"));
            payload.put("receivedAt", event.optString("receivedAt"));
            payload.put("idempotencyKey", eventId);
            payload.put("packageName", event.optString("packageName"));
            payload.put("postedAt", System.currentTimeMillis());

            OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();
            Request request = new Request.Builder()
                .url(apiBaseUrl.replaceAll("/+$", "") + "/api/notifications/ingest")
                .post(RequestBody.create(payload.toString(), JSON))
                .header("Authorization", "Bearer " + accessToken)
                .header("X-Client-Platform", "capacitor")
                .header("Idempotency-Key", eventId)
                .build();

            try (Response response = client.newCall(request).execute()) {
                int code = response.code();
                String responseBody = response.body() == null ? "" : response.body().string();
                JSONObject data = new JSONObject();
                try { data = new JSONObject(responseBody); } catch (Exception ignored) {}
                String transactionId = data.optString("transactionId");
                String serverStatus = data.optString("status");

                if (response.isSuccessful()) {
                    if ("ignored".equals(serverStatus) || code == 422) {
                        db.updateEventStatus(eventId, "PERMANENT_FAILED", "IGNORED", transactionId);
                    } else {
                        db.updateEventStatus(eventId, "SUCCEEDED", null, transactionId);
                    }
                    return Result.success();
                }
                if (code == 401 || code == 403) {
                    db.updateEventStatus(eventId, "PERMANENT_FAILED", "AUTH_REQUIRED", null);
                    return Result.success();
                }
                if (code == 422) {
                    db.updateEventStatus(eventId, "PERMANENT_FAILED", "VALIDATION_FAILED", null);
                    return Result.success();
                }
                if (code >= 400 && code < 500) {
                    db.updateEventStatus(eventId, "PERMANENT_FAILED", "HTTP_" + code, null);
                    return Result.success();
                }
                db.updateEventStatus(eventId, "RETRYABLE_FAILED", "HTTP_" + code, null);
                return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
            }
        } catch (IOException error) {
            db.updateEventStatus(eventId, "RETRYABLE_FAILED", "NETWORK_ERROR", null);
            return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
        } catch (Exception error) {
            db.updateEventStatus(eventId, "RETRYABLE_FAILED", "WORKER_ERROR", null);
            return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
        }
    }

    private SharedPreferences getSecureSession() throws Exception {
        MasterKey masterKey = new MasterKey.Builder(getApplicationContext())
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build();
        return EncryptedSharedPreferences.create(
            getApplicationContext(),
            "truespend_notification_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    private String refreshAccessToken(String apiBaseUrl, String refreshToken,
                                      SharedPreferences secureSession) throws IOException {
        JSONObject body = new JSONObject();
        try { body.put("refreshToken", refreshToken); } catch (Exception ignored) {}
        OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build();
        Request request = new Request.Builder()
            .url(apiBaseUrl.replaceAll("/+$", "") + "/api/auth/refresh")
            .post(RequestBody.create(body.toString(), JSON))
            .header("X-Client-Platform", "capacitor")
            .build();
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return "";
            JSONObject data = new JSONObject(response.body().string());
            String access = data.optString("accessToken");
            if (access.isEmpty()) access = data.optString("token");
            String rotatedRefresh = data.optString("refreshToken");
            if (!access.isEmpty()) secureSession.edit().putString("accessToken", access).apply();
            if (!rotatedRefresh.isEmpty()) secureSession.edit().putString("refreshToken", rotatedRefresh).apply();
            return access;
        } catch (Exception error) {
            return "";
        }
    }
}
