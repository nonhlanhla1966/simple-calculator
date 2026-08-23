# AGENTS.md - Permanent Android App Factory Rules

These rules apply to every Android app built in this environment.
They are permanent instructions for OpenCode sessions working in this project
or any app scaffolded from it.

## The mandatory workflow

```
APP IDEA -> APP DESIGN -> APP ICON -> SOURCE CODE -> LOCAL BUILD -> TEST
  -> AUTOMATIC ERROR FIXING -> GIT COMMIT -> GITHUB PUSH -> GITHUB ACTIONS
  -> CLOUD APK -> APK VERIFICATION -> COPY APK TO /storage/emulated/0/Download/
```

## Build system rules

- Use the existing lightweight Node.js + Android SDK CLI build system
  (`build.js` driving `aapt`, `javac`, `d8`, zipalign, `apksigner`).
- Never require Gradle, Kotlin, Android Studio, Replit, or a PC.
- Do not replace working build infrastructure without a technical reason.
- Avoid unnecessary npm dependencies; zero is the default.
- New apps target **Android 8.0 / API 26+** unless the app requires otherwise.
- Support ARM devices appropriately (the local device is aarch64); keep build
  tooling architecture-portable (see `tools/zipalign.js` fallback pattern).
- Keep apps permission-free unless genuinely required by features.

## App identity rules

- Package name: `com.nonhlanhla1966.<appname>` - lowercase, valid Java package
  syntax, no spaces or invalid characters, unique per app, never reuse an
  existing app's package name. `tools/scaffold.js` enforces this.
- Versioning: `versionName` starts at `1.0.0`, `versionCode` starts at `1`
  (stored in `AndroidManifest.xml`; managed by `node tools/version.js`).
  Increment only for real releases, not for routine dev-build testing.

## Icons

Every new app MUST have a launcher icon:
1. Analyze the app idea and propose a fitting icon concept.
2. Generate it with a pure-Node generator (see `tools/genicons.js` pattern).
3. Produce all densities: mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192,
   plus round variants.
4. Verify the icons exist inside the final APK. Never ship the default icon.

## Quality gates

- Test every app (`npm test`) before declaring completion.
- On build failure: read the actual error, identify the root cause, make a
  minimal fix, rebuild. Maximum 3 automatic retries, then report the exact
  remaining error. No infinite loops, no unrelated edits, never hide errors.
- Verify after build: APK exists, signature verifies, package name and
  version correct, launcher resources present.

## Release and delivery

- Final deliverable is a signed release-style APK named
  `<AppName>-v<versionName>.apk`.
- Signing uses a locally generated keystore cached in `keys/` (stable across
  builds, never committed). This is self-signed - suitable for sideloading,
  not Play-Store production signing.
- Copy the verified APK to `/storage/emulated/0/Download/` (replace same-name
  files safely; verify existence and non-zero size afterwards).

## Git and GitHub

- Commit and push completed work to GitHub on `main`.
- Confirm the GitHub Actions run goes green and produces an APK artifact;
  download and re-verify the cloud-built APK when possible.
- Optionally create a GitHub Release (`node tools/release.js`) for versions.
- NEVER commit or expose API keys, tokens, passwords, auth files, keystores
  or any other secrets. Scan for secrets before pushing.

## Cost rules

- Target $0. No paid services unless explicitly requested by the user:
  no Replit, no paid AI APIs, no paid GitHub plans, no paid CI.
