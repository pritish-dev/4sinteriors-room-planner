# 3D Room Planner – Android app

A small Android wrapper (WebView) around the offline 3D room planner in `app/src/main/assets/`.

## Get the APK without installing anything
1. Create a new repository on GitHub and upload the contents of this folder (keep the folder structure, including `.github`).
2. Open the repository's **Actions** tab. The "Build APK" run starts on upload (or press "Run workflow").
3. When it finishes, open the run and download **RoomPlanner-apk** from "Artifacts". Unzip it to get `app-debug.apk`.
4. Copy the APK to the phone and open it. Allow "install from unknown sources" when asked.

## Or build on a computer
Open this folder in Android Studio and choose Build > Build APK(s).

## Updating the catalogue
Replace `catalog.js` (products and sizes) and `images.js` (photos) in `app/src/main/assets/`, then rebuild.
