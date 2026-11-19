package com.truespend.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.truespend.app.notification.NotificationCapturePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(NotificationCapturePlugin.class);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
