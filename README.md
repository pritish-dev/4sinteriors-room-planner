# 4S Interiors – 3D Room Planner

Plan a customer's room in 3D with real Interio catalogue products, at real size.
Staff only: sign in with your **4S Orders app** username and password.

| | Link |
|---|---|
| **Android app (APK)** | https://github.com/pritish-dev/4sinteriors-room-planner/releases/latest/download/RoomPlanner.apk |
| **iPhone / any browser** | https://pritish-dev.github.io/4sinteriors-room-planner/ |

**Android:** open the APK link on the phone, download, open the file and allow
"install from unknown sources" when asked. New versions install over the old one.

**iPhone:** open the web link in **Safari**, tap **Share → Add to Home Screen**. It then
opens full-screen like an app and keeps working offline after the first load.

## How it is built
- `room-planner-android/app/src/main/assets/` — the planner itself (HTML/JS). The same
  files are the Android app and the web app.
- `.github/workflows/build-apk.yml` — builds the APK on every push; every build of
  `master` refreshes the `apk-latest` release (the APK link above).
- `.github/workflows/deploy-pages.yml` — publishes the web app to GitHub Pages on every
  push to `master`.

## Login
`assets/auth.js` sends the username and password to the 4S Orders backend (the same
Google Apps Script and `APP_ORDERING_CREDS` sheet the ordering app uses), so adding,
removing or deactivating a person there also applies here. A session lasts 30 days and
is re-checked whenever the phone is online; bumping `TOKEN_VERSION` in the backend
signs everyone out of both apps.

## Furniture look
- **Photo view (default):** every product is its own catalogue photo, cut out from
  the background and stood in the room at its catalogue size, so it looks exactly as in
  the catalogue. Cut-outs live in `assets/cutouts/` (`index.js` lists them). Products
  whose photo could not be cut out cleanly use a 3D shape in the catalogue colour.
- **Shapes view:** simple 3D models of each furniture type in the catalogue colour.
- **Real 3D models:** drop a `.glb` file into `assets/models/` and list it in
  `assets/models/index.js`; that product then shows as a true 3D model.
