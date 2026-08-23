# Simple Calculator

A lightweight Android calculator (API 26+, WebView + HTML/CSS/JS) built
**without Gradle** using Node.js and the Android SDK command-line tools.
Zero npm dependencies. This project doubles as the **template for an
automatic Android app factory** - see AGENTS.md and the Reuse section below.

## Build pipeline

```
node build.js   ->  aapt -> javac -> d8 -> zipalign -> apksigner -> dist/Simple-Calculator-v<version>.apk
```

| Command | Purpose |
|---|---|
| `npm run build` | Build and sign a release-style APK in `dist/` |
| `npm test` | Run all validation tests (logic, files, icons, APK, signature) |
| `npm run verify` | Verify the built APK (ZIP, badging, permissions, signature) |
| `npm run clean` | Remove `build/` and `dist/` |
| `node tools/version.js bump [major\|minor\|patch]` | Bump version for a release |
| `node tools/release.js` | Create a GitHub Release and attach the APK |
| `node tools/scaffold.js "New App"` | Create a brand-new app project from this factory |

## How it works

- App identity (name, versions, package) lives only in `AndroidManifest.xml`
  and `res/values/strings.xml`; `build.js` derives everything else from them.
- `build.js` auto-detects `JAVA_HOME` / `ANDROID_SDK_ROOT`.
- Architecture-portable tooling: SDK binaries that cannot run on the local CPU
  fall back automatically (native `/usr/bin/aapt`, pure-Node `tools/zipalign.js`).
- Signing: a self-signed keystore is generated once into gitignored `keys/`
  and reused, keeping release signatures stable across builds.

## Creating a new app

```
node tools/scaffold.js "My Next App" ../my-next-app
```

Generates a complete standalone project: valid unique package name
(`com.nonhlanhla1966.<slug>`), manifest at API 26+, generic WebView host
activity, letter-based launcher icons in all densities, tests, CI workflow,
and the same build scripts. Customize the icon (`tools/genicons.js`) and the
UI (`www/`). Calculator code is never copied into new apps.

## GitHub Actions

`.github/workflows/build.yml` runs on every push: checkout -> Node 20 ->
JDK 17 -> Android SDK -> `npm test` -> `npm run build` -> `npm run verify`
-> uploads the APK artifact. No secrets are stored in the repository; CI uses
GitHub's own hosted tooling.

## Delivery & versioning

The verified APK is delivered to `/storage/emulated/0/Download/` as
`<AppName>-v<versionName>.apk` (e.g. `Simple-Calculator-v1.0.0.apk`).
Version bumps (`tools/version.js`) are reserved for real releases;
versionCode increments on every release.

## Supported Android version

Android 8.0 (API 26)+, targetSdk 29. ARM (aarch64/armv7) devices supported -
the app contains pure Java + HTML/CSS/JS, no native libraries.

## Testing

106+ automated checks run via `npm test`: calculator logic (all operations,
precedence, negatives, errors, fuzz), required files, icon dimensions,
manifest rules, APK contents, alignment, signature and delivery.
Future apps get their own suite from the scaffold.

## Security rules

Never commit tokens, passwords, `.env*`, `auth.json`, keystores or any
credentials - enforced by `.gitignore` and pre-push secret scans. The signing
key stays local in `keys/`.

## Cost / free design

$0 end-to-end: local Node/npm/JDK/Android SDK, GitHub public-repo Actions,
OpenCode CLI. AI access currently depends on AndroidIDE's bundled provider -
its continued free availability depends on that third-party service.
