#!/bin/bash
# Usage: try_login.sh <apk> <label>. Installs the APK, signs in with a dummy user and
# prints what the login screen shows plus WebView console output.
set -x
APK=$1; L=$2
adb uninstall in.foursinteriors.roomplanner >/dev/null 2>&1
adb install -r "$APK" || exit 0
adb logcat -c
adb shell am start -n in.foursinteriors.roomplanner/.MainActivity
sleep 25
adb shell uiautomator dump /sdcard/ui.xml >/dev/null; adb pull /sdcard/ui.xml ui_$L.xml >/dev/null
python3 .github/diag/fields.py ui_$L.xml text; python3 .github/diag/fields.py ui_$L.xml > fields.txt; cat fields.txt
U=$(sed -n 1p fields.txt); P=$(sed -n 2p fields.txt); B=$(sed -n 3p fields.txt)
adb shell input tap $U; sleep 1; adb shell input text zzdiagnobody; sleep 1
adb shell input tap $P; sleep 1; adb shell input text wrongpass; sleep 1
adb shell input keyevent 111; sleep 1
adb shell uiautomator dump /sdcard/ui.xml >/dev/null; adb pull /sdcard/ui.xml ui2_$L.xml >/dev/null
B=$(python3 .github/diag/fields.py ui2_$L.xml | sed -n 3p)
adb shell input tap $B
sleep 30
adb shell uiautomator dump /sdcard/ui.xml >/dev/null; adb pull /sdcard/ui.xml ui3_$L.xml >/dev/null
echo "===== [$L] TEXT ON SCREEN AFTER SIGN-IN ====="
python3 .github/diag/fields.py ui3_$L.xml text
echo "===== [$L] WEBVIEW CONSOLE / ERRORS ====="
adb logcat -d | grep -iE "chromium|console|roomplanner|AndroidRuntime" | tail -40
