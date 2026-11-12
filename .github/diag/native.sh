#!/bin/bash
# Temporary: checks the Android-only features of the branch APK.
adb install -r branch.apk >/dev/null && echo installed
adb shell am start -n in.foursinteriors.roomplanner/.MainActivity >/dev/null; sleep 25
SOCK=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
adb forward tcp:9222 localabstract:$SOCK
adb logcat -c
node .github/diag/native.js
sleep 4
echo "== Downloads folder"; adb shell ls -la "/sdcard/Download/4S\ Room\ Planner/" 2>&1 | tail -3
echo "== intents"; adb logcat -d | grep -E "ActivityTaskManager: START|Chooser|ResolverActivity" | tail -8
echo "== offline fallback"; adb shell am force-stop in.foursinteriors.roomplanner; adb shell svc wifi disable; adb shell svc data disable; sleep 3
adb shell pm clear in.foursinteriors.roomplanner >/dev/null
adb shell am start -n in.foursinteriors.roomplanner/.MainActivity >/dev/null; sleep 20
SOCK=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1); adb forward --remove-all; adb forward tcp:9222 localabstract:$SOCK
node .github/diag/url.js
