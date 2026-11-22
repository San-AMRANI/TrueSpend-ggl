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
    private static final String DEFAULT_API_BASE_URL = "https://true-spend-ggl.vercel.app";
    private static final String PRIMARY_INGEST_PATH = "/api/transactions/from-bank-notification";
    private static final String FALLBACK_INGEST_PATH = "/api/notifications/ingest";
    private static final Object TOKEN_REFRESH_LOCK = new Object();

    private static final class IngestResult {
        final int code;
        final String body;
        IngestResult(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

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
            db.claimStaleProcessingEvents(120_000L);
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
            updateAndNotify(db, eventId, "PERMANENT_FAILED", "ACCOUNT_MISMATCH", null);
            return Result.success();
        }

        try {
            SharedPreferences session = getSecureSession();
            String accessToken = session.getString("accessToken", "");
            String refreshToken = session.getString("refreshToken", "");
            String apiBaseUrl = session.getString("apiBaseUrl", "");
            if (TextUtils.isEmpty(apiBaseUrl)) apiBaseUrl = DEFAULT_API_BASE_URL;
            String normalizedBaseUrl = apiBaseUrl.replaceAll("/+$", "");

            if (TextUtils.isEmpty(accessToken) && TextUtils.isEmpty(refreshToken)) {
                updateAndNotify(db, eventId, "PERMANENT_FAILED", "SIGN_IN_REQUIRED", null);
                return Result.success();
            }

            OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(45, TimeUnit.SECONDS)
                .build();

            // Only refresh before sending if we have no cached access token at all.
            if (TextUtils.isEmpty(accessToken)) {
                accessToken = refreshAccessTokenLocked(client, normalizedBaseUrl, "", session);
            }
            if (TextUtils.isEmpty(accessToken)) {
                updateAndNotify(db, eventId, "PERMANENT_FAILED", "AUTH_REQUIRED", null);
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

            IngestResult result = postIngestWithFallback(client, normalizedBaseUrl, accessToken, eventId, payload);

            // Lazy single-retry token refresh on 401 behind TOKEN_REFRESH_LOCK.
            if (result.code == 401 && !TextUtils.isEmpty(session.getString("refreshToken", ""))) {
                String refreshedAccess = refreshAccessTokenLocked(client, normalizedBaseUrl, accessToken, session);
                if (!TextUtils.isEmpty(refreshedAccess)) {
                    result = postIngestWithFallback(client, normalizedBaseUrl, refreshedAccess, eventId, payload);
                }
            }

            int code = result.code;
            JSONObject data = new JSONObject();
            try {
                if (!TextUtils.isEmpty(result.body)) data = new JSONObject(result.body);
            } catch (Exception ignored) {}
            String transactionId = data.optString("transactionId");
            String serverStatus = data.optString("status");

            if (code >= 200 && code < 300) {
                if ("ignored".equalsIgnoreCase(serverStatus)) {
                    updateAndNotify(db, eventId, "PERMANENT_FAILED", "IGNORED", transactionId);
                } else {
                    updateAndNotify(db, eventId, "SUCCEEDED", null, transactionId);
                }
                return Result.success();
            }
            if (code == 401 || code == 403) {
                updateAndNotify(db, eventId, "PERMANENT_FAILED", "AUTH_REQUIRED", null);
                return Result.success();
            }
            if (code == 422) {
                updateAndNotify(db, eventId, "PERMANENT_FAILED", "NO_AMOUNT_DETECTED", null);
                return Result.success();
            }
            if (code == 429) {
                updateAndNotify(db, eventId, "RETRYABLE_FAILED", "RATE_LIMITED", null);
                return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
            }
            if (code >= 400 && code < 500) {
                updateAndNotify(db, eventId, "PERMANENT_FAILED", "HTTP_" + code, null);
                return Result.success();
            }
            updateAndNotify(db, eventId, "RETRYABLE_FAILED", "HTTP_" + code, null);
            return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
        } catch (IOException error) {
            updateAndNotify(db, eventId, "RETRYABLE_FAILED", "NETWORK_ERROR", null);
            return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
        } catch (Exception error) {
            updateAndNotify(db, eventId, "RETRYABLE_FAILED", "WORKER_ERROR", null);
            return db.getAttemptCount(eventId) >= 8 ? Result.success() : Result.retry();
        }
    }

    private IngestResult postIngestWithFallback(OkHttpClient client, String baseUrl, String accessToken,
                                                String eventId, JSONObject payload) throws IOException {
        IngestResult primary = executeIngestPost(client, baseUrl + PRIMARY_INGEST_PATH, accessToken, eventId, payload);
        if (primary.code == 404) {
            return executeIngestPost(client, baseUrl + FALLBACK_INGEST_PATH, accessToken, eventId, payload);
        }
        return primary;
    }

    private IngestResult executeIngestPost(OkHttpClient client, String url, String accessToken,
                                           String eventId, JSONObject payload) throws IOException {
        Request request = new Request.Builder()
            .url(url)
            .post(RequestBody.create(payload.toString(), JSON))
            .header("Authorization", "Bearer " + accessToken)
            .header("X-Client-Platform", "capacitor")
            .header("Idempotency-Key", eventId)
            .build();
        try (Response response = client.newCall(request).execute()) {
            String body = response.body() == null ? "" : response.body().string();
            return new IngestResult(response.code(), body);
        }
    }

    private void updateAndNotify(NotificationCaptureDatabase db, String eventId, String status,
                                 String errorCode, String transactionId) {
        db.updateEventStatus(eventId, status, errorCode, transactionId);
        JSONObject updated = db.getEvent(eventId);
        if (updated != null) {
            NotificationCapturePlugin.emitNotificationCaptured(updated);
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

    private String refreshAccessTokenLocked(OkHttpClient client, String baseUrl, String failedAccessToken,
                                            SharedPreferences secureSession) throws IOException {
        synchronized (TOKEN_REFRESH_LOCK) {
            String latestAccess = secureSession.getString("accessToken", "");
            if (!TextUtils.isEmpty(latestAccess) && !latestAccess.equals(failedAccessToken)) {
                return latestAccess;
            }
            String currentRefresh = secureSession.getString("refreshToken", "");
            if (TextUtils.isEmpty(currentRefresh)) {
                return "";
            }
            JSONObject body = new JSONObject();
            try { body.put("refreshToken", currentRefresh); } catch (Exception ignored) {}
            Request request = new Request.Builder()
                .url(baseUrl + "/api/auth/refresh")
                .post(RequestBody.create(body.toString(), JSON))
                .header("X-Client-Platform", "capacitor")
                .build();
            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) return "";
                JSONObject data = new JSONObject(response.body().string());
                String access = data.optString("accessToken");
                if (TextUtils.isEmpty(access)) access = data.optString("token");
                String rotatedRefresh = data.optString("refreshToken");
                SharedPreferences.Editor editor = secureSession.edit();
                if (!TextUtils.isEmpty(access)) editor.putString("accessToken", access);
                if (!TextUtils.isEmpty(rotatedRefresh)) editor.putString("refreshToken", rotatedRefresh);
                editor.commit();
                if (!TextUtils.isEmpty(access)) {
                    NotificationCapturePlugin.emitSessionRefreshed(access, rotatedRefresh);
                }
                return access;
            } catch (Exception error) {
                return "";
            }
        }
    }
}
