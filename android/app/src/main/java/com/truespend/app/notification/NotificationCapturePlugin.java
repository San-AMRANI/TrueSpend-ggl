package com.truespend.app.notification;

import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NotificationCapture")
public class NotificationCapturePlugin extends Plugin {
    private static volatile NotificationCapturePlugin instance;
    private static final ExecutorService APP_LIST_EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        instance = this;
        NotificationCaptureDatabase.getInstance(getContext()).claimStaleProcessingEvents(120_000L);
        NotificationCaptureQueueWorker.enqueueDrain(getContext());
    }

    public static void emitNotificationCaptured(JSONObject event) {
        NotificationCapturePlugin plugin = instance;
        if (plugin == null || event == null) return;
        try {
            JSObject payload = JSObject.fromJSONObject(event);
            plugin.notifyListeners("notificationCaptured", payload, true);
        } catch (Exception ignored) {}
    }

    public static void emitSessionRefreshed(String accessToken, String refreshToken) {
        NotificationCapturePlugin plugin = instance;
        if (plugin == null || TextUtils.isEmpty(accessToken)) return;
        try {
            JSObject payload = new JSObject();
            payload.put("accessToken", accessToken);
            if (!TextUtils.isEmpty(refreshToken)) {
                payload.put("refreshToken", refreshToken);
            }
            plugin.notifyListeners("nativeSessionRefreshed", payload, true);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }

    @PluginMethod
    public void isAccessGranted(PluginCall call) {
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        call.resolve(permissionStatus());
    }

    private JSObject permissionStatus() {
        String enabled = Settings.Secure.getString(
            getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName listener = new ComponentName(getContext(), BankNotificationListenerService.class);
        String flattened = listener.flattenToString();
        String packageAndClass = listener.getPackageName() + "/" + listener.getClassName();
        boolean granted = enabled != null && (
            enabled.contains(flattened)
                || enabled.contains(packageAndClass));
        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("listenerConnected", granted && BankNotificationListenerService.isConnected());
        return result;
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        getContext().startActivity(
            new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        call.resolve();
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        openAccessSettings(call);
    }

    private boolean isValidAndroidPackageName(String packageName) {
        if (TextUtils.isEmpty(packageName) || packageName.length() > 255) return false;
        String[] segments = packageName.split("\\.", -1);
        if (segments.length < 2) return false;
        for (String segment : segments) {
            if (segment.isEmpty() || !segment.matches("^[A-Za-z][A-Za-z0-9_]*$")) return false;
        }
        return true;
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        APP_LIST_EXECUTOR.execute(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                List<JSObject> apps = new ArrayList<>();
                java.util.LinkedHashMap<String, JSObject> appByPackage = new java.util.LinkedHashMap<>();
                Intent launcher = new Intent(Intent.ACTION_MAIN);
                launcher.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> resolved;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    resolved = pm.queryIntentActivities(launcher,
                        PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL));
                } else {
                    resolved = pm.queryIntentActivities(launcher,
                        PackageManager.MATCH_ALL);
                }
                for (ResolveInfo info : resolved) {
                    if (info.activityInfo == null) continue;
                    String packageName = info.activityInfo.packageName;
                    if (packageName.equals(getContext().getPackageName())) continue;
                    if (appByPackage.containsKey(packageName)) continue;
                    CharSequence label = info.loadLabel(pm);
                    JSObject app = new JSObject();
                    app.put("packageName", packageName);
                    app.put("appName", label == null ? packageName : label.toString());
                    app.put("icon", drawableToBase64(info.loadIcon(pm)));
                    appByPackage.put(packageName, app);
                }
                apps.addAll(appByPackage.values());
                Collections.sort(apps, Comparator.comparing(
                    app -> app.getString("appName").toLowerCase(java.util.Locale.ROOT)));
                JSArray output = new JSArray();
                for (JSObject app : apps) output.put(app);
                JSObject result = new JSObject();
                result.put("apps", output);
                result.put("count", output.length());
                result.put("queryType", "launcher");
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Unable to read installed launcher apps.", error);
            }
        });
    }

    private String drawableToBase64(Drawable drawable) {
        try {
            Bitmap bitmap = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, 48, 48);
            drawable.draw(canvas);
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 85, stream);
            bitmap.recycle();
            return "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
        } catch (Exception error) {
            return "";
        }
    }

    @PluginMethod
    public void getRules(PluginCall call) {
        JSObject result = new JSObject();
        result.put("rules", NotificationCaptureDatabase.getInstance(getContext()).getRules());
        call.resolve(result);
    }

    @PluginMethod
    public void saveRule(PluginCall call) {
        try {
            JSONObject rule = call.getData();
            if (TextUtils.isEmpty(rule.optString("id"))) rule.put("id", UUID.randomUUID().toString());
            String packageName = rule.optString("packageName").trim();
            if (!isValidAndroidPackageName(packageName)) {
                call.reject("Enter a valid Android package name, such as com.example.app.");
                return;
            }
            rule.put("packageName", packageName);
            boolean saved = NotificationCaptureDatabase.getInstance(getContext()).saveRule(rule);
            if (!saved) {
                call.reject("Could not save the rule. Enter a package and at least one keyword, and make sure you are signed in.");
                return;
            }
            JSObject result = new JSObject();
            result.put("rule", rule);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to save notification rule.", error);
        }
    }

    @PluginMethod
    public void deleteRule(PluginCall call) {
        String id = call.getString("ruleId");
        if (TextUtils.isEmpty(id)) {
            call.reject("ruleId is required.");
            return;
        }
        NotificationCaptureDatabase.getInstance(getContext()).deleteRule(id);
        call.resolve();
    }

    @PluginMethod
    public void setRuleEnabled(PluginCall call) {
        String id = call.getString("ruleId");
        if (TextUtils.isEmpty(id)) {
            call.reject("ruleId is required.");
            return;
        }
        NotificationCaptureDatabase.getInstance(getContext()).setRuleEnabled(id,
            call.getBoolean("enabled", false));
        call.resolve();
    }

    @PluginMethod
    public void setAutomationEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getContext().getSharedPreferences(BankNotificationListenerService.PREFS_NAME,
            android.content.Context.MODE_PRIVATE).edit()
            .putBoolean("automation_enabled", enabled).apply();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
        if (enabled) NotificationCaptureQueueWorker.enqueueDrain(getContext());
    }

    @PluginMethod
    public void getAutomationStatus(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            BankNotificationListenerService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("enabled", prefs.getBoolean("automation_enabled", true));
        call.resolve(result);
    }

    @PluginMethod
    public void setNativeSession(PluginCall call) {
        try {
            String ownerUserId = call.getString("ownerUserId");
            String accessToken = call.getString("accessToken");
            String refreshToken = call.getString("refreshToken");
            String apiBaseUrl = call.getString("apiBaseUrl");
            MasterKey masterKey = new MasterKey.Builder(getContext())
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build();
            SharedPreferences secure = EncryptedSharedPreferences.create(
                getContext(), "truespend_notification_secure", masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
            SharedPreferences.Editor editor = secure.edit();
            if (TextUtils.isEmpty(ownerUserId)) {
                editor.clear();
                NotificationCaptureDatabase.getInstance(getContext()).setActiveOwnerUserId("");
                getContext().getSharedPreferences(BankNotificationListenerService.PREFS_NAME,
                    android.content.Context.MODE_PRIVATE).edit()
                    .putBoolean("automation_enabled", false).apply();
            } else {
                editor.putString("ownerUserId", ownerUserId);
                if (!TextUtils.isEmpty(accessToken)) editor.putString("accessToken", accessToken);
                if (!TextUtils.isEmpty(refreshToken)) editor.putString("refreshToken", refreshToken);
                if (!TextUtils.isEmpty(apiBaseUrl)) editor.putString("apiBaseUrl", apiBaseUrl);
                NotificationCaptureDatabase.getInstance(getContext()).setActiveOwnerUserId(ownerUserId);
            }
            editor.commit();
            if (!TextUtils.isEmpty(ownerUserId)) {
                SharedPreferences prefs = getContext().getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
                if (prefs.getBoolean("automation_enabled", true)) {
                    NotificationCaptureQueueWorker.enqueueDrain(getContext());
                }
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to store native notification session.", error);
        }
    }

    @PluginMethod
    public void getQueueSummary(PluginCall call) {
        JSONObject summary = NotificationCaptureDatabase.getInstance(getContext()).getQueueSummary();
        JSObject result = new JSObject();
        result.put("pending", summary.optInt("pending"));
        result.put("processing", summary.optInt("processing"));
        result.put("succeeded", summary.optInt("succeeded"));
        result.put("retryableFailed", summary.optInt("retryableFailed"));
        result.put("permanentFailed", summary.optInt("permanentFailed"));
        call.resolve(result);
    }

    @PluginMethod
    public void getEventHistory(PluginCall call) {
        int limit = call.getInt("limit", 50);
        int offset = call.getInt("offset", 0);
        JSObject result = new JSObject();
        result.put("events",
            NotificationCaptureDatabase.getInstance(getContext()).getEventHistory(limit, offset));
        call.resolve(result);
    }

    @PluginMethod
    public void retryPendingEvents(PluginCall call) {
        NotificationCaptureDatabase db = NotificationCaptureDatabase.getInstance(getContext());
        db.retryEligibleEvents();
        NotificationCaptureQueueWorker.enqueueDrain(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearCompletedHistory(PluginCall call) {
        NotificationCaptureDatabase.getInstance(getContext()).clearCompletedHistory();
        call.resolve();
    }

    // Backward-compatible package-only methods for existing web builds.
    @PluginMethod
    public void setEnabledPackages(PluginCall call) {
        try {
            JSArray packages = call.getArray("packages");
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to save notification packages.", error);
        }
    }

    @PluginMethod
    public void getEnabledPackages(PluginCall call) {
        JSONArray rules = NotificationCaptureDatabase.getInstance(getContext()).getRules();
        JSArray packages = new JSArray();
        try {
            for (int i = 0; i < rules.length(); i++) {
                String packageName = rules.optJSONObject(i).optString("packageName");
                if (!TextUtils.isEmpty(packageName) && packages.toList().indexOf(packageName) < 0) {
                    packages.put(packageName);
                }
            }
        } catch (Exception ignored) {}
        JSObject result = new JSObject();
        result.put("packages", packages);
        call.resolve(result);
    }
}
