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
        NotificationCaptureDatabase.getInstance(this).claimStaleProcessingEvents(120_000L);
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
        if (TextUtils.isEmpty(packageName) || packageName.equals(getPackageName())) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;
        int flags = notification.flags;
        if ((flags & Notification.FLAG_GROUP_SUMMARY) != 0
            || (flags & Notification.FLAG_ONGOING_EVENT) != 0) {
            return;
        }

        NotificationCaptureDatabase db = NotificationCaptureDatabase.getInstance(this);
        List<NotificationCaptureDatabase.Rule> rules = db.getEnabledRulesForPackage(packageName);
        if (rules.isEmpty()) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        String title = charSeqToString(extras.getCharSequence(Notification.EXTRA_TITLE));
        String bigTitle = charSeqToString(extras.getCharSequence(Notification.EXTRA_TITLE_BIG));
        if (bigTitle.length() > title.length()) title = bigTitle;

        String shortText = charSeqToString(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = charSeqToString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String text = bigText.length() > shortText.length() ? bigText : shortText;

        CharSequence[] textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (textLines != null && textLines.length > 0) {
            StringBuilder joined = new StringBuilder();
            for (CharSequence line : textLines) {
                String lineStr = charSeqToString(line).trim();
                if (!lineStr.isEmpty()) {
                    if (joined.length() > 0) joined.append('\n');
                    joined.append(lineStr);
                }
            }
            if (joined.length() > text.length()) {
                text = joined.toString();
            }
        }

        String subText = charSeqToString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT)).trim();
        if (!subText.isEmpty() && !text.toLowerCase(Locale.ROOT).contains(subText.toLowerCase(Locale.ROOT))) {
            text = text.isEmpty() ? subText : (text + "\n" + subText);
        }

        title = title.trim();
        text = text.trim();
        if (title.isEmpty() && text.isEmpty()) return;

        try {
            List<String> matchedRuleIds = new ArrayList<>();
            String appLabel = packageName;
            for (NotificationCaptureDatabase.Rule rule : rules) {
                appLabel = rule.appLabel;
                if (rule.matches(title, text)) matchedRuleIds.add(rule.id);
            }
            if (matchedRuleIds.isEmpty()) return;

            long timeBucket = sbn.getPostTime() / 60_000L;
            String notificationKey = sha256(
                packageName + "|" + timeBucket + "|" + title.toLowerCase(Locale.ROOT) + "|" + text.toLowerCase(Locale.ROOT)
            );
            String eventId = "notif-" + notificationKey;
            String ownerUserId = db.getActiveOwnerUserId();
            if (TextUtils.isEmpty(ownerUserId)) return;
            if (db.insertEventIfAbsent(eventId, ownerUserId, matchedRuleIds, packageName, appLabel, title, text, sbn.getPostTime())) {
                JSONObject savedEvent = db.getEvent(eventId);
                if (savedEvent != null) {
                    NotificationCapturePlugin.emitNotificationCaptured(savedEvent);
                }
                NotificationCaptureQueueWorker.enqueueEvent(this, eventId);
            }
        } catch (Exception ignored) {
        }
    }

    private static String charSeqToString(CharSequence value) {
        return value == null ? "" : value.toString();
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte b : hash) result.append(String.format(Locale.US, "%02x", b));
        return result.toString();
    }
}
