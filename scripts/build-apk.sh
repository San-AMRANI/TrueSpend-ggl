#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/app/applet"
cd "$ROOT_DIR"

echo "1. Checking web bundle and syncing Capacitor Android project..."
if [ ! -f "$ROOT_DIR/dist/index.html" ]; then
  npm run cap:sync
else
  npx cap sync android
fi

JDK_DIR="/tmp/jdk21"
SDK_DIR="/tmp/android-sdk"
WORK_DIR="/tmp/apk-build"

mkdir -p "$JDK_DIR" "$SDK_DIR/cmdline-tools"

if [ ! -f "$JDK_DIR/bin/javac" ]; then
  echo "2. Downloading OpenJDK 21..."
  curl --http1.1 --retry 5 -fsSL "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" | tar -xz -C "$JDK_DIR" --strip-components=1
fi

export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$JAVA_HOME/bin:$SDK_DIR/cmdline-tools/latest/bin:$PATH"

if [ ! -f "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "3. Downloading Android SDK Command-line Tools..."
  curl --http1.1 --retry 5 -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o /tmp/cmdline-tools.zip
  rm -rf "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  python3 -m zipfile -e /tmp/cmdline-tools.zip "$SDK_DIR/cmdline-tools/"
  mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  chmod +x "$SDK_DIR/cmdline-tools/latest/bin/"*
  rm -f /tmp/cmdline-tools.zip
fi

if [ ! -f "$SDK_DIR/platforms/android-35/android.jar" ] || [ ! -f "$SDK_DIR/build-tools/35.0.0/aapt2" ]; then
  echo "4. Installing Android SDK Platform 35 & Build-Tools 35.0.0..."
  yes | sdkmanager --licenses > /dev/null 2>&1 || true
  sdkmanager "platforms;android-35" "build-tools;35.0.0" > /dev/null
fi

BUILD_TOOLS="$SDK_DIR/build-tools/35.0.0"
ANDROID_JAR="$SDK_DIR/platforms/android-35/android.jar"
chmod +x "$BUILD_TOOLS/"* || true

echo "5. Preparing native Android source and resources in $WORK_DIR..."
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/src/com/truespend/app" \
         "$WORK_DIR/res/values" \
         "$WORK_DIR/res/mipmap-hdpi" \
         "$WORK_DIR/assets/public" \
         "$WORK_DIR/gen" \
         "$WORK_DIR/obj" \
         "$WORK_DIR/dex"

cp "$ROOT_DIR/public/app-icon.png" "$WORK_DIR/res/mipmap-hdpi/ic_launcher.png"
cp -r "$ROOT_DIR/dist/"* "$WORK_DIR/assets/public/"

cat > "$WORK_DIR/res/values/strings.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">TrueSpend</string>
</resources>
EOF

cat > "$WORK_DIR/AndroidManifest.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.truespend.app"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <activity
            android:name="com.truespend.app.MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

cat > "$WORK_DIR/src/com/truespend/app/MainActivity.java" << 'EOF'
package com.truespend.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;

    public class AndroidBridge {
        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0A0D14"));
            window.setNavigationBarColor(Color.parseColor("#0A0D14"));
        }

        FrameLayout layout = new FrameLayout(this);
        layout.setBackgroundColor(Color.parseColor("#0A0D14"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0A0D14"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && "localhost".equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "/index.html";
                    }
                    if (path.startsWith("/api/")) {
                        return null;
                    }
                    String assetPath = "public" + path;
                    try {
                        InputStream is = getAssets().open(assetPath);
                        String mime = guessMimeType(path);
                        WebResourceResponse response = new WebResourceResponse(mime, "UTF-8", is);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        response.setResponseHeaders(headers);
                        return response;
                    } catch (Exception e) {
                        if (!path.contains(".")) {
                            try {
                                InputStream indexStream = getAssets().open("public/index.html");
                                return new WebResourceResponse("text/html", "UTF-8", indexStream);
                            } catch (Exception ignored) {}
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        layout.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(layout);

        webView.loadUrl("https://localhost/index.html");
    }

    private String guessMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".ico")) return "image/x-icon";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed != null ? guessed : "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF

echo "6. Compiling Android resources with aapt2..."
"$BUILD_TOOLS/aapt2" compile --dir "$WORK_DIR/res" -o "$WORK_DIR/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$ANDROID_JAR" \
  --manifest "$WORK_DIR/AndroidManifest.xml" \
  --java "$WORK_DIR/gen" \
  -A "$WORK_DIR/assets" \
  -o "$WORK_DIR/unsigned.apk" \
  "$WORK_DIR/resources.zip"

echo "7. Compiling Java sources with javac..."
export JAVA_TOOL_OPTIONS="-Xmx256m"
javac --release 11 \
  -cp "$ANDROID_JAR" \
  -d "$WORK_DIR/obj" \
  "$WORK_DIR/gen/com/truespend/app/R.java" \
  "$WORK_DIR/src/com/truespend/app/MainActivity.java"

echo "8. Converting bytecode to DEX with d8..."
CLASS_FILES=$(find "$WORK_DIR/obj" -name "*.class")
"$BUILD_TOOLS/d8" \
  --lib "$ANDROID_JAR" \
  --min-api 24 \
  --output "$WORK_DIR/dex" \
  $CLASS_FILES

python3 -c '
import zipfile
with zipfile.ZipFile("/tmp/apk-build/unsigned.apk", "a", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.write("/tmp/apk-build/dex/classes.dex", "classes.dex")
'

echo "9. Aligning and signing APK with zipalign and apksigner..."
"$BUILD_TOOLS/zipalign" -f -p 4 "$WORK_DIR/unsigned.apk" "$WORK_DIR/aligned.apk"

KEYSTORE="$WORK_DIR/debug.keystore"
keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -storepass android \
  -keypass android \
  -alias androiddebugkey \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=TrueSpend,OU=Mobile,O=TrueSpend,L=London,S=UK,C=GB"

"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$WORK_DIR/TrueSpend.apk" \
  "$WORK_DIR/aligned.apk"

"$BUILD_TOOLS/apksigner" verify --verbose "$WORK_DIR/TrueSpend.apk"

mkdir -p "$ROOT_DIR/public" "$ROOT_DIR/android/app/build/outputs/apk/debug"
cp "$WORK_DIR/TrueSpend.apk" "$ROOT_DIR/TrueSpend.apk"
cp "$WORK_DIR/TrueSpend.apk" "$ROOT_DIR/public/TrueSpend.apk"
cp "$WORK_DIR/TrueSpend.apk" "$ROOT_DIR/android/TrueSpend.apk"
cp "$WORK_DIR/TrueSpend.apk" "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

rm -rf "$WORK_DIR" "$JDK_DIR" "$SDK_DIR"
echo "10. APK build complete!"
ls -lh "$ROOT_DIR/TrueSpend.apk" "$ROOT_DIR/public/TrueSpend.apk" "$ROOT_DIR/android/TrueSpend.apk"
