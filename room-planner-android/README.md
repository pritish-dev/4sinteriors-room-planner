# 3D Room Planner – Android app

A small Android wrapper (WebView) around the offline 3D room planner in `app/src/main/assets/`.

## Get the APK
Download the latest build on the phone:
https://github.com/pritish-dev/4sinteriors-room-planner/releases/latest/download/RoomPlanner.apk

It is built by `.github/workflows/build-apk.yml` (repository root) on every push to `master`.

## Or build on a computer
Open this folder in Android Studio and choose Build > Build APK(s).

## Updating the catalogue
Replace `catalog.js` (products and sizes) and `images.js` (photos) in `app/src/main/assets/`, then rebuild.
If product ids change, regenerate the photo cut-outs in `assets/cutouts/` too.
