package in.foursinteriors.roomplanner;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    // The app opens the LIVE planner on GitHub Pages, so every update merged to master
    // reaches installed phones the next time the app is opened — no reinstall (the same
    // way the 4S Orders app updates). The copy bundled in the APK is used when the
    // phone is offline and the live page has never been cached.
    private static final String LIVE = "https://pritish-dev.github.io/4sinteriors-room-planner/";
    private static final String LIVE_HOST = "pritish-dev.github.io";
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String LOCAL = "https://" + LOCAL_HOST + "/assets/index.html";
    private static final int PICK_FILES = 7;

    private WebView web;
    private WebViewAssetLoader assets;
    private ValueCallback<Uri[]> fileCallback;
    private boolean onLocal = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        assets = new WebViewAssetLoader.Builder()
                .setDomain(LOCAL_HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // keeps the login, designs and offline copy
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.addJavascriptInterface(new Bridge(), "RPNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String host = u.getHost();
                if (LOCAL_HOST.equals(host) || (LIVE_HOST.equals(host) && u.getPath() != null && u.getPath().startsWith("/4sinteriors-room-planner"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* ignore */ }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // No internet (and nothing cached): fall back to the copy inside the APK.
                if (request.isForMainFrame() && !onLocal) { onLocal = true; view.loadUrl(LOCAL); }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse r) {
                if (request.isForMainFrame() && !onLocal && r.getStatusCode() >= 400) { onLocal = true; view.loadUrl(LOCAL); }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // <input type="file"> for room photos (gallery / camera / files, several at once).
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                Intent chooser = Intent.createChooser(pick, "Add room photos");
                try {
                    startActivityForResult(chooser, PICK_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        setContentView(web);
        if (savedInstanceState == null) { if (online()) web.loadUrl(LIVE); else { onLocal = true; web.loadUrl(LOCAL); } }
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILES || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /** Called from JavaScript as window.RPNative.* — only for the planner's own pages. */
    private class Bridge {
        private boolean trusted() {
            final String[] url = {null};
            final Object lock = new Object();
            runOnUiThread(() -> { synchronized (lock) { url[0] = web.getUrl(); lock.notify(); } });
            synchronized (lock) { try { if (url[0] == null) lock.wait(1000); } catch (InterruptedException ignored) { } }
            if (url[0] == null) return false;
            Uri u = Uri.parse(url[0]);
            return LOCAL_HOST.equals(u.getHost()) || (LIVE_HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/4sinteriors-room-planner"));
        }

        /**
         * Save or send a file made in the page.
         * target: "save" (Downloads), "whatsapp" (to the customer's number), "email" (to the
         * customer's email) or anything else for the normal share sheet.
         */
        @JavascriptInterface
        public void shareFile(String base64, String name, String mime, String target, String phone, String email, String subject, String text) {
            if (!trusted()) return;
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                File dir = new File(getCacheDir(), "shared");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, safe);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, "in.foursinteriors.roomplanner.files", f);
                runOnUiThread(() -> deliver(uri, bytes, safe, mime, target, phone, email, subject, text));
            } catch (Exception e) {
                toast("Could not prepare the file: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void setFullscreen(boolean on) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController c = getWindow().getInsetsController();
                    if (c == null) return;
                    if (on) {
                        c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    } else {
                        c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    }
                } else {
                    getWindow().getDecorView().setSystemUiVisibility(on
                            ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            : View.SYSTEM_UI_FLAG_VISIBLE);
                }
            });
        }

        @JavascriptInterface
        public String version() { return BuildConfigInfo.VERSION; }
    }

    private void deliver(Uri uri, byte[] bytes, String name, String mime, String target, String phone, String email, String subject, String text) {
        if ("save".equals(target)) {
            if (saveToDownloads(bytes, name, mime)) toast("Saved to Downloads: " + name);
            else share(uri, mime, subject, text, null);
            return;
        }
        if ("whatsapp".equals(target)) {
            for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType(mime);
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.setClipData(ClipData.newRawUri(name, uri));
                if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
                if (phone != null && !phone.isEmpty()) i.putExtra("jid", phone + "@s.whatsapp.net");
                i.setPackage(pkg);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivity(i); return; } catch (ActivityNotFoundException ignored) { }
            }
            toast("WhatsApp is not installed — choose another app");
            share(uri, mime, subject, text, null);
            return;
        }
        if ("email".equals(target)) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.setClipData(ClipData.newRawUri(name, uri));
            if (email != null && !email.isEmpty()) i.putExtra(Intent.EXTRA_EMAIL, new String[]{email});
            i.putExtra(Intent.EXTRA_SUBJECT, subject);
            i.putExtra(Intent.EXTRA_TEXT, text);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.setSelector(new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")));   // email apps only
            try { startActivity(Intent.createChooser(i, "Send email")); }
            catch (ActivityNotFoundException e) { i.setSelector(null); share(uri, mime, subject, text, email); }
            return;
        }
        share(uri, mime, subject, text, email);
    }

    private void share(Uri uri, String mime, String subject, String text, String email) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType(mime);
        i.putExtra(Intent.EXTRA_STREAM, uri);
        i.setClipData(ClipData.newRawUri("file", uri));
        i.putExtra(Intent.EXTRA_SUBJECT, subject);
        i.putExtra(Intent.EXTRA_TEXT, text);
        if (email != null && !email.isEmpty()) i.putExtra(Intent.EXTRA_EMAIL, new String[]{email});
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(i, "Share")); } catch (ActivityNotFoundException e) { toast("No app to share with"); }
    }

    private boolean saveToDownloads(byte[] bytes, String name, String mime) {
        if (Build.VERSION.SDK_INT < 29) return false;   // older Android: offer the share sheet instead
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/4S Room Planner");
            Uri dest = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (dest == null) return false;
            try (OutputStream o = getContentResolver().openOutputStream(dest)) { if (o == null) return false; o.write(bytes); }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void toast(String m) { runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_LONG).show()); }

    // Live vs built-in copy is decided only when the app starts — never on returning from
    // WhatsApp/email, so a design in progress is never reloaded.
    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkCapabilities c = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) { return false; }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    /** Native version, so the page can tell when a new APK is needed. */
    static final class BuildConfigInfo { static final String VERSION = "2"; }
}
