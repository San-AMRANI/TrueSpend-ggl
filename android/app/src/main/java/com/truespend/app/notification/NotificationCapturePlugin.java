package com.truespend.app.notification;

import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

@CapacitorPlugin(name = "NotificationCapture")
public class NotificationCapturePlugin extends Plugin {
    private static NotificationCapturePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    public static void notifyCaptured(JSONObject item) {
        if (instance == null) return;
        try {
            JSObject payload = new JSObject();
            Iterator<String> keys = item.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                payload.put(key, item.get(key));
            }
            instance.notifyListeners("notificationCaptured", payload, true);
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void isAccessGranted(PluginCall call) {
        String enabled = Settings.Secure.getString(
            getContext().getContentResolver(),
            "enabled_notification_listeners"
        );
        boolean granted = enabled != null && enabled.contains(
            new ComponentName(getContext(), BankNotificationListenerService.class).flattenToString()
        );
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        getContext().startActivity(
            new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        );
        call.resolve();
    }

    @PluginMethod
    public void setEnabledPackages(PluginCall call) {
        try {
            JSArray packages = call.getArray("packages");
            Set<String> enabled = new HashSet<>();
            if (packages != null) {
                for (Object value : packages.toList()) {
                    if (value != null) {
                        String packageName = String.valueOf(value).trim();
                        if (!packageName.isEmpty()) enabled.add(packageName);
                    }
                }
            }
            SharedPreferences prefs = getContext().getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME,
                android.content.Context.MODE_PRIVATE
            );
            prefs.edit().putStringSet(BankNotificationListenerService.ENABLED_PACKAGES, enabled).apply();
            JSObject result = new JSObject();
            result.put("packages", new JSArray(enabled.toArray(new String[0])));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to save notification package settings.", error);
        }
    }

    @PluginMethod
    public void getEnabledPackages(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME,
                android.content.Context.MODE_PRIVATE
            );
            Set<String> enabled = prefs.getStringSet(BankNotificationListenerService.ENABLED_PACKAGES, new HashSet<>());
            JSObject result = new JSObject();
            result.put("packages", new JSArray(enabled.toArray(new String[0])));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read notification package settings.", error);
        }
    }

    @PluginMethod
    public void getCapturedNotifications(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            BankNotificationListenerService.PREFS_NAME,
            android.content.Context.MODE_PRIVATE
        );
        JSArray output = new JSArray();
        try {
            JSONArray queue = new JSONArray(
                prefs.getString(BankNotificationListenerService.QUEUE, "[]")
            );
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.optJSONObject(i);
                if (item != null) {
                    JSObject copy = new JSObject();
                    Iterator<String> keys = item.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        copy.put(key, item.get(key));
                    }
                    output.put(copy);
                }
            }
        } catch (Exception ignored) {
        }
        JSObject result = new JSObject();
        result.put("notifications", output);
        call.resolve(result);
    }

    @PluginMethod
    public void removeCapturedNotification(PluginCall call) {
        String idempotencyKey = call.getString("idempotencyKey");
        if (!TextUtils.isEmpty(idempotencyKey)) {
            SharedPreferences prefs = getContext().getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME,
                android.content.Context.MODE_PRIVATE
            );
            try {
                JSONArray queue = new JSONArray(
                    prefs.getString(BankNotificationListenerService.QUEUE, "[]")
                );
                JSONArray remaining = new JSONArray();
                for (int i = 0; i < queue.length(); i++) {
                    JSONObject item = queue.optJSONObject(i);
                    if (item == null || !idempotencyKey.equals(item.optString("idempotencyKey"))) {
                        if (item != null) remaining.put(item);
                    }
                }
                prefs.edit().putString(BankNotificationListenerService.QUEUE, remaining.toString()).apply();
            } catch (Exception ignored) {
            }
        }
        call.resolve();
    }
}
