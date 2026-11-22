package com.truespend.app.notification;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import android.app.Notification;
import android.content.SharedPreferences;
import android.text.TextUtils;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class BankNotificationListenerService extends NotificationListenerService {
    public static final String PREFS_NAME = "truespend_notification_capture";
    public static final String ENABLED_PACKAGES = "enabled_packages";
    public static final String QUEUE = "captured_notifications";
    private static volatile boolean connected;
    public static boolean isConnected() { return connected; }
    private static final int MAX_QUEUE = 100;

    @Override
    public void onListenerConnected() {
        connected = true;
        NotificationCaptureDatabase.getInstance(this).claimStaleProcessingEvents();
        NotificationCaptureQueueWorker.enqueueDrain(this);
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String packageName = sbn.getPackageName();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (!prefs.getBoolean("automation_enabled", true)) return;
        if (TextUtils.isEmpty(packageName)) return;

        NotificationCaptureDatabase db = NotificationCaptureDatabase.getInstance(this);
        List<NotificationCaptureDatabase.Rule> rules = db.getEnabledRulesForPackage(packageName);
        if (rules.isEmpty()) return;

        Bundle extras = sbn.getNotification() == null ? null : sbn.getNotification().extras;
        if (extras == null) return;
        String title = extras.getCharSequence(Notification.EXTRA_TITLE) == null
            ? ""
            : extras.getCharSequence(Notification.EXTRA_TITLE).toString();
        CharSequence textSequence = extras.getCharSequence(Notification.EXTRA_TEXT);
        String text = textSequence == null ? "" : textSequence.toString();
        if (text.trim().isEmpty() && extras.containsKey(Notification.EXTRA_BIG_TEXT)) {
            CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            text = bigText == null ? "" : bigText.toString();
        }
        if (title.trim().isEmpty() && text.trim().isEmpty()) return;

        try {
            String normalizedText = (title + "\n" + text).toLowerCase(Locale.ROOT).trim();
            List<String> matchedRuleIds = new ArrayList<>();
            String appLabel = packageName;
            for (NotificationCaptureDatabase.Rule rule : rules) {
                appLabel = rule.appLabel;
                if (rule.matches(title, text)) matchedRuleIds.add(rule.id);
            }
            if (matchedRuleIds.isEmpty()) return;

            String notificationKey = sha256(packageName + "|" + sbn.getKey() + "|" + sbn.getPostTime() + "|" + title + "|" + text);
            String eventId = "notif-" + notificationKey;
            String ownerUserId = NotificationCaptureDatabase.getInstance(this).getActiveOwnerUserId();
            if (TextUtils.isEmpty(ownerUserId)) return;
            if (db.insertEventIfAbsent(eventId, ownerUserId, matchedRuleIds, packageName, appLabel, title, text, sbn.getPostTime())) {
                NotificationCaptureQueueWorker.enqueueEvent(this, eventId);
            }
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
