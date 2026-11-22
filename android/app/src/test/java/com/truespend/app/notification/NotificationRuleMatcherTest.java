package com.truespend.app.notification;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NotificationRuleMatcherTest {
    @Test
    public void anyModeMatchesOneKeyword() {
        NotificationCaptureDatabase.Rule rule = new NotificationCaptureDatabase.Rule(
            "rule-1", true, "com.example.app", "Example",
            new String[]{"payment", "achat"}, "ANY", false);
        assertTrue(rule.matches("Payment", "150 MAD"));
    }

    @Test
    public void allModeRequiresEveryKeyword() {
        NotificationCaptureDatabase.Rule rule = new NotificationCaptureDatabase.Rule(
            "rule-2", true, "com.example.app", "Example",
            new String[]{"payment", "150"}, "ALL", false);
        assertTrue(rule.matches("Payment", "150 MAD"));
        assertFalse(rule.matches("Payment", "200 MAD"));
    }

    @Test
    public void disabledAndEmptyRulesDoNotMatch() {
        NotificationCaptureDatabase.Rule disabled = new NotificationCaptureDatabase.Rule(
            "rule-3", false, "com.example.app", "Example",
            new String[]{"payment"}, "ANY", false);
        NotificationCaptureDatabase.Rule empty = new NotificationCaptureDatabase.Rule(
            "rule-4", true, "com.example.app", "Example",
            new String[]{}, "ANY", false);
        assertFalse(disabled.matches("Payment", "150 MAD"));
        assertFalse(empty.matches("Payment", "150 MAD"));
    }

    @Test
    public void matchFieldsRestrictsTitleOrText() {
        NotificationCaptureDatabase.Rule titleOnly = new NotificationCaptureDatabase.Rule(
            "rule-5", true, "com.example.app", "Example",
            new String[]{"payment"}, "ANY", new String[]{"TITLE"}, false);
        NotificationCaptureDatabase.Rule textOnly = new NotificationCaptureDatabase.Rule(
            "rule-6", true, "com.example.app", "Example",
            new String[]{"150"}, "ANY", new String[]{"TEXT"}, false);
        assertTrue(titleOnly.matches("Payment alert", "150 MAD"));
        assertFalse(titleOnly.matches("Bank alert", "Payment 150 MAD"));
        assertTrue(textOnly.matches("Bank alert", "150 MAD"));
        assertFalse(textOnly.matches("150 MAD", "Bank alert"));
    }
}
