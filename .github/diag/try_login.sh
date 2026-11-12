#!/bin/bash
# Usage: try_login.sh <apk> <label>. Installs the APK, signs in with a dummy user via the
# WebView debugger and prints what the login screen reports.
APK=$1; L=$2
adb uninstall in.foursinteriors.roomplanner >/dev/null 2>&1
adb install -r "$APK" >/dev/null || { echo "install failed"; exit 0; }
adb shell am start -n in.foursinteriors.roomplanner/.MainActivity >/dev/null
sleep 20
PID=$(adb shell pidof in.foursinteriors.roomplanner | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
echo "[$L] pid=$PID socket=$SOCK"
adb forward --remove-all; adb forward tcp:9222 localabstract:$SOCK
adb shell dumpsys package in.foursinteriors.roomplanner | grep -iE "android.permission.INTERNET|requested permissions" | head -3
adb shell "ping -c 1 -W 3 8.8.8.8 >/dev/null && echo emulator-net-ok || echo emulator-net-FAIL"
echo "===== [$L] RESULT ====="
node .github/diag/cdp.js || true
