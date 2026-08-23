#!/usr/bin/env node
/*
 * Verifies the built APK: exists, valid ZIP structure, correct badging,
 * expected contents and a valid signature. Exit code 0 = all good.
 * Run via: npm run verify
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function findApk() {
  if (!fs.existsSync(DIST)) return null;
  const apks = fs.readdirSync(DIST).filter(f => f.endsWith('.apk')).sort();
  return apks.length ? path.join(DIST, apks[apks.length - 1]) : null;
}
const APK = findApk();

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function findJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', 'javac'))) {
    return process.env.JAVA_HOME;
  }
  const jdk = '/opt/java/jdk1.8.0_212';
  if (fs.existsSync(path.join(jdk, 'bin', 'javac'))) return jdk;
  try {
    for (const d of fs.readdirSync('/usr/lib/jvm')) {
      if (fs.existsSync(path.join('/usr/lib/jvm', d, 'bin', 'javac'))) return path.join('/usr/lib/jvm', d);
    }
  } catch (_) { /* ignore */ }
  throw new Error('JDK not found');
}

function javaEnv() {
  const env = Object.assign({}, process.env);
  const jh = findJavaHome();
  env.JAVA_HOME = jh;
  env.PATH = path.join(jh, 'bin') + path.delimiter + env.PATH;
  return env;
}

function findSdk() {
  return process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '/opt/android_sdk';
}

function findAapt() {
  const candidates = ['/usr/bin/aapt', '/usr/lib/android-sdk/build-tools/debian/aapt'];
  const bt = path.join(findSdk(), 'build-tools');
  try {
    for (const v of fs.readdirSync(bt).sort().reverse()) candidates.push(path.join(bt, v, 'aapt'));
  } catch (_) { /* ignore */ }
  for (const c of candidates) {
    try { execFileSync(c, ['v'], { stdio: 'ignore' }); return c; } catch (_) { /* next */ }
  }
  throw new Error('no runnable aapt found');
}

function findApksigner() {
  const bt = path.join(findSdk(), 'build-tools');
  for (const v of fs.readdirSync(bt).sort().reverse()) {
    const c = path.join(bt, v, 'apksigner');
    if (fs.existsSync(c)) {
      try { execFileSync(c, ['--version'], { stdio: 'ignore', env: javaEnv() }); return c; } catch (_) { /* next */ }
    }
  }
  throw new Error('apksigner not found');
}

console.log('Verifying APK from dist/\n');

check('APK exists', () => assert(APK, 'no .apk file found in dist/ - run npm run build'));

check('APK is a valid ZIP (magic bytes + EOCD)', () => {
  const b = fs.readFileSync(APK);
  assert(b.length > 10 * 1024, `suspiciously small (${b.length} bytes)`);
  assert(b[0] === 0x50 && b[1] === 0x4b, 'missing ZIP magic');
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert(eocd >= 0, 'missing End Of Central Directory record');
});

let badging = '';
let listing = '';
check('aapt can parse the APK', () => {
  badging = execFileSync(findAapt(), ['dump', 'badging', APK], { encoding: 'utf8' });
  listing = execFileSync(findAapt(), ['list', APK], { encoding: 'utf8' });
});

check('package com.simple.calculator v1.0.0', () => {
  assert(badging.includes("package: name='com.simple.calculator'"), 'wrong package');
  assert(badging.includes("versionName='1.0.0'"), 'wrong versionName');
});
check('label "Simple Calculator" with launchable activity', () => {
  assert(badging.includes("application-label:'Simple Calculator'"), 'wrong label');
  assert(badging.includes("launchable-activity: name='com.simple.calculator.MainActivity'"), 'no launchable activity');
});
check('no permissions requested', () => {
  assert(!badging.includes('uses-permission'), 'APK requests permissions');
});
check('required entries present (dex, assets, icons)', () => {
  const lines = listing.split('\n');
  ['classes.dex', 'assets/index.html', 'assets/js/calculator.js',
    'res/mipmap-mdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi-v4/ic_launcher.png']
    .forEach(f => assert(lines.includes(f), `${f} missing`));
});
check('signature verifies (v1/v2)', () => {
  const out = execFileSync(findApksigner(), ['verify', '--verbose', APK], {
    encoding: 'utf8', env: javaEnv(), timeout: 120000
  });
  assert(/Verified using v\d scheme/i.test(out), `not verified:\n${out}`);
});

console.log(failures ? `\nVERIFY FAILED (${failures})` : '\nAPK VERIFIED OK');
process.exit(failures ? 1 : 0);
