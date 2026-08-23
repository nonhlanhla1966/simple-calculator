# Simple Calculator

A lightweight Android calculator (API 26+, WebView + HTML/CSS/JS) built
**without Gradle** using Node.js and the Android SDK command-line tools.
Zero npm dependencies.

## Build pipeline

```
node build.js   ->  aapt -> javac -> d8 -> zipalign -> apksigner -> dist/Simple-Calculator.apk
```

| Command | Purpose |
|---|---|
| `npm run build` | Build and sign the APK (`dist/Simple-Calculator.apk`) |
| `npm test` | Run all 106 validation tests (logic, files, icons, APK, signature) |
| `npm run verify` | Verify the built APK (ZIP, badging, permissions, signature) |
| `npm run clean` | Remove `build/` and `dist/` |
| `npm run icons` | Regenerate launcher icons from `tools/genicons.js` |

## Toolchain notes

- `build.js` auto-detects `JAVA_HOME` / `ANDROID_SDK_ROOT` (or uses
  `/opt/java/jdk1.8.0_212` and `/opt/android_sdk`).
- SDK binaries that cannot run on the local CPU architecture fall back
  automatically: native `aapt` (`/usr/bin/aapt`) and a pure-Node zipalign
  (`tools/zipalign.js`). On x86_64 CI runners the standard SDK tools are used.
- Signing keystore is generated at build time into `build/` (never committed).

## Reusable app workflow (any future app)

1. **App idea** -> write the app design first (screens, features).
2. **Icon** -> adapt `tools/genicons.js`, generate all mipmap densities.
3. **Source** -> HTML/CSS/JS in `www/` + minimal `src/` Activity + manifest.
4. **Build** -> `npm run build`; on failure read the error, fix, rebuild.
5. **Test** -> extend `tests/run-tests.js`; everything must pass.
6. **Commit & push** -> GitHub Actions builds/tests/verifies in the cloud
   (`.github/workflows/build.yml`) and uploads the APK as an artifact.
7. **Deliver** -> copy the artifact APK to `/storage/emulated/0/Download/`.

New apps: copy this project skeleton, rename the package
(`com.simple.calculator`), app label, icons, and `APK_NAME` in `build.js`.

## Security

Never commit tokens, keys, `auth.json`, keystores or credentials - see
`.gitignore`. The debug signing key is generated locally per build.
