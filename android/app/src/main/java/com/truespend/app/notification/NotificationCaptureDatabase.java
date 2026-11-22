package com.truespend.app.notification;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class NotificationCaptureDatabase extends SQLiteOpenHelper {
    private static NotificationCaptureDatabase instance;
    private final Context appContext;

    public static synchronized NotificationCaptureDatabase getInstance(Context context) {
        if (instance == null) instance = new NotificationCaptureDatabase(context.getApplicationContext());
        return instance;
    }

    private NotificationCaptureDatabase(Context context) {
        super(context, "truespend_notification_capture.db", null, 1);
        appContext = context;
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE rules (" +
            "id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, " +
            "package_name TEXT NOT NULL, app_label TEXT NOT NULL, keywords_json TEXT NOT NULL, " +
            "keyword_mode TEXT NOT NULL DEFAULT 'ANY', match_fields_json TEXT NOT NULL, " +
            "case_sensitive INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
        db.execSQL("CREATE TABLE events (" +
            "event_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, rule_ids_json TEXT NOT NULL, " +
            "package_name TEXT NOT NULL, app_label TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, " +
            "received_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', attempt_count INTEGER NOT NULL DEFAULT 0, " +
            "last_error_code TEXT, server_transaction_id TEXT, updated_at TEXT NOT NULL)");
        db.execSQL("CREATE INDEX idx_rules_package ON rules(enabled, package_name)");
        db.execSQL("CREATE INDEX idx_events_status ON events(status)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {}

    public static class Rule {
        public final String id;
        public final boolean enabled;
        public final String packageName;
        public final String appLabel;
        public final String[] keywords;
        public final String keywordMode;
        public final boolean caseSensitive;

        Rule(String id, boolean enabled, String packageName, String appLabel, String[] keywords,
             String keywordMode, boolean caseSensitive) {
            this.id = id;
            this.enabled = enabled;
            this.packageName = packageName;
            this.appLabel = appLabel;
            this.keywords = keywords;
            this.keywordMode = keywordMode;
            this.caseSensitive = caseSensitive;
        }

        public boolean matches(String title, String text) {
            if (!enabled) return false;
            String combined = (title == null ? "" : title) + "\n" + (text == null ? "" : text);
            String normalized = Normalizer.normalize(combined, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
            if (caseSensitive) normalized = combined;
            if (keywords == null || keywords.length == 0) return false;
            if ("ALL".equalsIgnoreCase(keywordMode)) {
                for (String keyword : keywords) {
                    String needle = caseSensitive
                        ? keyword
                        : Normalizer.normalize(keyword, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
                    if (needle.isEmpty() || !normalized.contains(needle)) return false;
                }
                return true;
            }
            for (String keyword : keywords) {
                String needle = caseSensitive
                    ? keyword
                    : Normalizer.normalize(keyword, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
                if (!needle.isEmpty() && normalized.contains(needle)) return true;
            }
            return false;
        }
    }

    public void setActiveOwnerUserId(String ownerUserId) {
        appContext.getSharedPreferences("truespend_notification_auth", Context.MODE_PRIVATE)
            .edit().putString("owner_user_id", ownerUserId == null ? "" : ownerUserId).apply();
    }

    public String getActiveOwnerUserId() {
        return appContext.getSharedPreferences("truespend_notification_auth", Context.MODE_PRIVATE)
            .getString("owner_user_id", "");
    }

    public List<Rule> getEnabledRulesForPackage(String packageName) {
        List<Rule> output = new ArrayList<>();
        String owner = getActiveOwnerUserId();
        if (TextUtils.isEmpty(owner) || TextUtils.isEmpty(packageName)) return output;
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT id, package_name, app_label, keywords_json, keyword_mode, case_sensitive " +
            "FROM rules WHERE enabled=1 AND owner_user_id=? AND package_name=?",
            new String[]{owner, packageName})) {
            while (cursor.moveToNext()) {
                String[] keywords = jsonStringArray(cursor.getString(3));
                output.add(new Rule(cursor.getString(0), true, cursor.getString(1),
                    cursor.getString(2), keywords, cursor.getString(4), cursor.getInt(5) == 1));
            }
        }
        return output;
    }

    public synchronized boolean saveRule(JSONObject rule) {
        try {
            String id = rule.optString("id").trim();
            String packageName = rule.optString("packageName").trim();
            String appLabel = rule.optString("appLabel").trim();
            String mode = "ALL".equalsIgnoreCase(rule.optString("keywordMode")) ? "ALL" : "ANY";
            JSONArray keywordArray = rule.optJSONArray("keywords");
            if (TextUtils.isEmpty(id) || TextUtils.isEmpty(packageName) || keywordArray == null) return false;
            JSONArray cleanKeywords = new JSONArray();
            for (int i = 0; i < keywordArray.length(); i++) {
                String keyword = Normalizer.normalize(keywordArray.optString(i).trim(), Normalizer.Form.NFKC);
                if (!keyword.isEmpty()) cleanKeywords.put(keyword);
            }
            if (cleanKeywords.length() == 0) return false;
            String owner = getActiveOwnerUserId();
            if (TextUtils.isEmpty(owner)) return false;
            String now = isoNow();
            ContentValues values = new ContentValues();
            values.put("id", id);
            values.put("owner_user_id", owner);
            values.put("enabled", rule.optBoolean("enabled", true) ? 1 : 0);
            values.put("package_name", packageName);
            values.put("app_label", appLabel.isEmpty() ? packageName : appLabel);
            values.put("keywords_json", cleanKeywords.toString());
            values.put("keyword_mode", mode);
            values.put("match_fields_json", "[\"TITLE\",\"TEXT\"]");
            values.put("case_sensitive", rule.optBoolean("caseSensitive", false) ? 1 : 0);
            values.put("created_at", rule.optString("createdAt", now));
            values.put("updated_at", now);
            getWritableDatabase().insertWithOnConflict("rules", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    public void deleteRule(String id) {
        getWritableDatabase().delete("rules", "id=? AND owner_user_id=?", new String[]{id, getActiveOwnerUserId()});
    }

    public void setRuleEnabled(String id, boolean enabled) {
        ContentValues values = new ContentValues();
        values.put("enabled", enabled ? 1 : 0);
        values.put("updated_at", isoNow());
        getWritableDatabase().update("rules", values, "id=? AND owner_user_id=?",
            new String[]{id, getActiveOwnerUserId()});
    }

    public JSONArray getRules() {
        JSONArray output = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT id, enabled, package_name, app_label, keywords_json, keyword_mode, case_sensitive, created_at, updated_at " +
            "FROM rules WHERE owner_user_id=? ORDER BY created_at DESC",
            new String[]{getActiveOwnerUserId()})) {
            while (cursor.moveToNext()) {
                JSONObject rule = new JSONObject();
                rule.put("id", cursor.getString(0));
                rule.put("enabled", cursor.getInt(1) == 1);
                rule.put("packageName", cursor.getString(2));
                rule.put("appLabel", cursor.getString(3));
                rule.put("keywords", new JSONArray(cursor.getString(4)));
                rule.put("keywordMode", cursor.getString(5));
                rule.put("matchFields", new JSONArray("[\"TITLE\",\"TEXT\"]"));
                rule.put("caseSensitive", cursor.getInt(6) == 1);
                rule.put("createdAt", cursor.getString(7));
                rule.put("updatedAt", cursor.getString(8));
                output.put(rule);
            }
        } catch (Exception ignored) {}
        return output;
    }

    public synchronized boolean insertEventIfAbsent(String eventId, String ownerUserId, List<String> ruleIds,
                                                     String packageName, String appLabel, String title, String text,
                                                     long postTime) {
        try (Cursor existing = getWritableDatabase().query("events", new String[]{"event_id"}, "event_id=?",
            new String[]{eventId}, null, null, null)) {
            if (existing.getCount() > 0) return false;
        }
        JSONArray ids = new JSONArray();
        for (String id : ruleIds) ids.put(id);
        String receivedAt = isoTime(postTime);
        String now = isoNow();
        ContentValues values = new ContentValues();
        values.put("event_id", eventId);
        values.put("owner_user_id", ownerUserId);
        values.put("rule_ids_json", ids.toString());
        values.put("package_name", packageName);
        values.put("app_label", appLabel);
        values.put("title", title.length() > 500 ? title.substring(0, 500) : title);
        values.put("text", text.length() > 5000 ? text.substring(0, 5000) : text);
        values.put("received_at", receivedAt);
        values.put("status", "PENDING");
        values.put("attempt_count", 0);
        values.put("updated_at", now);
        return getWritableDatabase().insert("events", null, values) != -1;
    }

    public JSONObject getEvent(String eventId) {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT event_id, owner_user_id, rule_ids_json, package_name, app_label, title, text, received_at, status, attempt_count, last_error_code, server_transaction_id " +
            "FROM events WHERE event_id=?", new String[]{eventId})) {
            if (!cursor.moveToFirst()) return null;
            JSONObject event = new JSONObject();
            event.put("eventId", cursor.getString(0));
            event.put("ownerUserId", cursor.getString(1));
            event.put("ruleIds", new JSONArray(cursor.getString(2)));
            event.put("packageName", cursor.getString(3));
            event.put("appLabel", cursor.getString(4));
            event.put("title", cursor.getString(5));
            event.put("text", cursor.getString(6));
            event.put("receivedAt", cursor.getString(7));
            event.put("status", cursor.getString(8));
            event.put("attemptCount", cursor.getInt(9));
            event.put("lastErrorCode", cursor.isNull(10) ? JSONObject.NULL : cursor.getString(10));
            event.put("serverTransactionId", cursor.isNull(11) ? JSONObject.NULL : cursor.getString(11));
            return event;
        } catch (Exception ignored) {
            return null;
        }
    }

    public synchronized boolean claimEvent(String eventId) {
        Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT status FROM events WHERE event_id=? AND owner_user_id=?",
            new String[]{eventId, getActiveOwnerUserId()});
        if (!cursor.moveToFirst()) { cursor.close(); return false; }
        String status = cursor.getString(0);
        cursor.close();
        if (!"PENDING".equals(status) && !"RETRYABLE_FAILED".equals(status)) return false;
        ContentValues values = new ContentValues();
        values.put("status", "PROCESSING");
        values.put("attempt_count", getAttemptCount(eventId) + 1);
        values.put("updated_at", isoNow());
        return getWritableDatabase().update("events", values, "event_id=? AND status=?",
            new String[]{eventId, status}) == 1;
    }

    public int getAttemptCount(String eventId) {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT attempt_count FROM events WHERE event_id=?", new String[]{eventId})) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    public void updateEventStatus(String eventId, String status, String errorCode, String transactionId) {
        ContentValues values = new ContentValues();
        values.put("status", status);
        if (errorCode != null) values.put("last_error_code", errorCode);
        if (transactionId != null) values.put("server_transaction_id", transactionId);
        values.put("updated_at", isoNow());
        getWritableDatabase().update("events", values, "event_id=?", new String[]{eventId});
    }

    public JSONObject getQueueSummary() {
        JSONObject result = new JSONObject();
        try {
            result.put("pending", countEvents("PENDING"));
            result.put("processing", countEvents("PROCESSING"));
            result.put("succeeded", countEvents("SUCCEEDED"));
            result.put("retryableFailed", countEvents("RETRYABLE_FAILED"));
            result.put("permanentFailed", countEvents("PERMANENT_FAILED"));
        } catch (Exception ignored) {}
        return result;
    }

    private int countEvents(String status) {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT COUNT(*) FROM events WHERE owner_user_id=? AND status=?",
            new String[]{getActiveOwnerUserId(), status})) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    public JSONArray getEventHistory(int limit, int offset) {
        JSONArray output = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT event_id, owner_user_id, rule_ids_json, package_name, app_label, title, text, received_at, status, attempt_count, last_error_code, server_transaction_id " +
            "FROM events WHERE owner_user_id=? ORDER BY received_at DESC LIMIT ? OFFSET ?",
            new String[]{getActiveOwnerUserId(), String.valueOf(Math.min(200, Math.max(1, limit))), String.valueOf(Math.max(0, offset))})) {
            while (cursor.moveToNext()) {
                JSONObject event = new JSONObject();
                event.put("eventId", cursor.getString(0));
                event.put("ownerUserId", cursor.getString(1));
                event.put("ruleIds", new JSONArray(cursor.getString(2)));
                event.put("packageName", cursor.getString(3));
                event.put("appLabel", cursor.getString(4));
                event.put("title", cursor.getString(5));
                event.put("text", cursor.getString(6));
                event.put("receivedAt", cursor.getString(7));
                event.put("status", cursor.getString(8));
                event.put("attemptCount", cursor.getInt(9));
                event.put("lastErrorCode", cursor.isNull(10) ? JSONObject.NULL : cursor.getString(10));
                event.put("serverTransactionId", cursor.isNull(11) ? JSONObject.NULL : cursor.getString(11));
                output.put(event);
            }
        } catch (Exception ignored) {}
        return output;
    }

    public void retryEligibleEvents() {
        ContentValues values = new ContentValues();
        values.put("status", "PENDING");
        getWritableDatabase().update("events", values,
            "owner_user_id=? AND status IN (?,?)",
            new String[]{getActiveOwnerUserId(), "RETRYABLE_FAILED", "PERMANENT_FAILED"});
    }

    public void clearCompletedHistory() {
        getWritableDatabase().delete("events",
            "owner_user_id=? AND status IN (?,?)",
            new String[]{getActiveOwnerUserId(), "SUCCEEDED", "PERMANENT_FAILED"});
    }

    public void claimStaleProcessingEvents() {
        ContentValues values = new ContentValues();
        values.put("status", "RETRYABLE_FAILED");
        getWritableDatabase().update("events", values,
            "owner_user_id=? AND status='PROCESSING'", new String[]{getActiveOwnerUserId()});
    }

    private String[] jsonStringArray(String raw) {
        try {
            JSONArray array = new JSONArray(raw);
            String[] output = new String[array.length()];
            for (int i = 0; i < array.length(); i++) output[i] = array.optString(i);
            return output;
        } catch (Exception error) {
            return new String[0];
        }
    }

    private static String isoNow() {
        return isoTime(System.currentTimeMillis());
    }

    private static String isoTime(long millis) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return format.format(new Date(millis));
    }
}
