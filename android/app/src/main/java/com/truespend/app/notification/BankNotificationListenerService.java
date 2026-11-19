package com.truespend.app.notification;

import android.content.SharedPreferences;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

public class BankNotificationListenerService extends NotificationListenerService {
    public static final String PREFS_NAME = "truespend_notification_capture";
    public static final String ENABLED_PACKAGES = "enabled_packages";
    public static final String QUEUE = "captured_notifications";
    private static final int MAX_QUEUE = 100;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String packageName = sbn.getPackageName();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        Set<String> enabled = prefs.getStringSet(ENABLED_PACKAGES, new HashSet<>());
        if (!enabled.contains(packageName)) return;

        Bundle extras = sbn.getNotification() == null ? null : sbn.getNotification().extras;
        if (extras == null) return;
        String title = extras.getCharSequence("android.title") == null
            ? ""
            : extras.getCharSequence("android.title").toString();
        CharSequence textSequence = extras.getCharSequence("android.text");
        String text = textSequence == null ? "" : textSequence.toString();
        if (text.trim().isEmpty() && extras.containsKey("android.bigText")) {
            CharSequence bigText = extras.getCharSequence("android.bigText");
            text = bigText == null ? "" : bigText.toString();
        }
        if (title.trim().isEmpty() && text.trim().isEmpty()) return;

        try {
            String notificationKey = sha256(
                packageName + "|" + sbn.getKey() + "|" + sbn.getPostTime()
            );
            JSONObject item = new JSONObject();
            item.put("idempotencyKey", "notif-" + notificationKey);
            item.put("packageName", packageName);
            item.put("title", title);
            item.put("text", text);
            item.put("postedAt", sbn.getPostTime());

            JSONArray queue;
            String rawQueue = prefs.getString(QUEUE, "[]");
            queue = new JSONArray(rawQueue);
            for (int i = 0; i < queue.length(); i++) {
                JSONObject existing = queue.optJSONObject(i);
                if (existing != null
                    && notificationKey.equals(existing.optString("idempotencyKey").replace("notif-", ""))) {
                    return;
                }
            }
            queue.put(item);
            if (queue.length() > MAX_QUEUE) {
                JSONArray trimmed = new JSONArray();
                for (int i = queue.length() - MAX_QUEUE; i < queue.length(); i++) {
                    trimmed.put(queue.get(i));
                }
                queue = trimmed;
            }
            prefs.edit().putString(QUEUE, queue.toString()).apply();
            NotificationCapturePlugin.notifyCaptured(item);
        } catch (Exception ignored) {
        }
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte b : hash) result.append(String.format("%02x", b));
        return result.toString();
    }
}
