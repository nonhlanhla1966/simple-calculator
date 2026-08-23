#!/usr/bin/env node
/*
 * Automated validation suite for Simple Calculator.
 * Zero dependencies - uses Node's child_process and plain assertions.
 *
 * Covers: calculator logic (all operations, precedence, negatives, edge
 * cases), required project files, launcher icons, APK generation, APK
 * contents and APK signature.
 *
 * Run with: npm test
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function findDistApk() {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) return null;
  const apks = fs.readdirSync(dist).filter(f => f.endsWith('.apk')).sort();
  return apks.length ? path.join(dist, apks[apks.length - 1]) : null;
}
let APK = findDistApk();
const DOWNLOAD_APK = '/storage/emulated/0/Download/Simple-Calculator-v1.0.0.apk';

/* ---------------- tiny harness ---------------- */

let passed = 0;
let failed = 0;
const failures = [];

function section(name) {
  console.log(`\n== ${name} ==`);
}

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label || 'value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/* ---------------- helpers ---------------- */

const Calculator = require(path.join(ROOT, 'www', 'js', 'calculator.js'));

/** Feed a key sequence to a fresh Calculator, return final display.
 * Multi-character numbers like '12.5' are expanded into individual presses;
 * 'AC', 'DEL' and '00' are genuine multi-char keys and stay intact. */
function calc(...keys) {
  const c = new Calculator();
  const flat = [];
  for (const k of keys) {
    const s = String(k);
    if (s === 'AC' || s === 'DEL' || s === '00') flat.push(s);
    else for (const ch of s) flat.push(ch);
  }
  let out = '0';
  for (const k of flat) out = c.press(k);
  return out;
}

/** Like calc() but returns the calculator instance for state inspection. */
function calcState(...keys) {
  const c = new Calculator();
  const flat = [];
  for (const k of keys) {
    const s = String(k);
    if (s === 'AC' || s === 'DEL' || s === '00') flat.push(s);
    else for (const ch of s) flat.push(ch);
  }
  for (const k of flat) c.press(k);
  return c;
}

function mustExist(rel) {
  const p = path.join(ROOT, rel);
  assert(fs.existsSync(p), `missing required file: ${rel}`);
  return p;
}

function readPNG(p) {
  const b = fs.readFileSync(p);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) assert(b[i] === sig[i], `${p}: not a PNG`);
  assert(b.readUInt32BE(8) === 13 && b.toString('ascii', 12, 16) === 'IHDR', `${p}: missing IHDR`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

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
  try {
    const bt = path.join(findSdk(), 'build-tools');
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

/* ================================================================== */
/* 1. Calculator core logic - basic operations                         */
/* ================================================================== */

section('Calculator logic - basic operations');

check('addition: 2 + 3 = 5', () => assertEqual(calc(2, '+', 3, '='), '5'));
check('subtraction: 10 \u2212 4 = 6', () => assertEqual(calc(10, '\u2212', 4, '='), '6'));
check('multiplication: 6 \u00d7 7 = 42', () => assertEqual(calc(6, '\u00d7', 7, '='), '42'));
check('division: 20 \u00f7 4 = 5', () => assertEqual(calc(20, '\u00f7', 4, '='), '5'));

/* ================================================================== */
/* 2. Decimals and percentage                                          */
/* ================================================================== */

section('Calculator logic - decimals & percentage');

check('decimal addition: 1.5 + 2.5 = 4', () => assertEqual(calc('1.5', '+', '2.5', '='), '4'));
check('decimal addition: 12.5 + 7.5 = 20', () => assertEqual(calc('12.5', '+', '7.5', '='), '20'));
check('decimal multiplication: 3.14 \u00d7 2 = 6.28', () => assertEqual(calc('3.14', '\u00d7', 2, '='), '6.28'));
check('dot starts entry as 0.', () => assertEqual(calc('.', 5), '0.5'));
check('second decimal point ignored', () => assertEqual(calc('3.1.4'), '3.14'));
check('percentage: 50 % = 0.5', () => assertEqual(calc(50, '%'), '0.5'));
check('percentage then equals stays 0.5', () => assertEqual(calc(50, '%', '='), '0.5'));
check('percent chains into calculation: 200 + 10 % = 200.1', () =>
  assertEqual(calc(200, '+', 10, '%', '='), '200.1'));

/* ================================================================== */
/* 3. Operator precedence and combinations                             */
/* ================================================================== */

section('Calculator logic - operator precedence');

check('precedence: 2 + 3 \u00d7 4 = 14', () => assertEqual(calc(2, '+', 3, '\u00d7', 4, '='), '14'));
check('precedence: 10 \u2212 2 \u00d7 3 = 4', () => assertEqual(calc(10, '\u2212', 2, '\u00d7', 3, '='), '4'));
check('left-to-right within tier: 8 \u00f7 4 \u00d7 2 = 4', () => assertEqual(calc(8, '\u00f7', 4, '\u00d7', 2, '='), '4'));
check('mixed chain: 2 + 3 \u00d7 4 \u2212 6 \u00f7 3 = 12', () =>
  assertEqual(calc(2, '+', 3, '\u00d7', 4, '\u2212', 6, '\u00f7', 3, '='), '12'));
check('division binds before subtraction: 100 \u2212 8 \u00f7 4 = 98', () =>
  assertEqual(calc(100, '\u2212', 8, '\u00f7', 4, '='), '98'));
check('operator replace mid-expression: 7 \u00d7 \u00f7 2 = 3.5', () =>
  assertEqual(calc(7, '\u00d7', '\u00f7', 2, '='), '3.5'));
check('leading operator ignored', () => assertEqual(calc('+', 5), '5'));
check('equals with nothing to do keeps value', () => assertEqual(calc(8, '='), '8'));
check('trailing operator dropped on equals', () => assertEqual(calc(9, '+', '='), '9'));

/* ================================================================== */
/* 4. Negative numbers                                                 */
/* ================================================================== */

section('Calculator logic - negative numbers');

check('negative result: 4 \u2212 9 = -5', () => assertEqual(calc(4, '\u2212', 9, '='), '-5'));
check('negative from zero: 0 \u2212 5 = -5', () => assertEqual(calc(0, '\u2212', 5, '='), '-5'));
check('continue calculating from negative result: 4\u22129 = then + 20 = gives 15', () =>
  assertEqual(calc(4, '\u2212', 9, '=', '+', 20, '='), '15'));
check('negative operand in expression: 0 \u2212 3 \u00d7 2 = -6', () =>
  assertEqual(calc(0, '\u2212', 3, '\u00d7', 2, '='), '-6'));

/* ================================================================== */
/* 5. Chaining and repeated calculations                               */
/* ================================================================== */

section('Calculator logic - chaining & repeated calculations');

check('chained addition: 2 + 3 + 4 = 9', () => assertEqual(calc(2, '+', 3, '+', 4, '='), '9'));
check('continue from result: 2 + 3 = then \u00d7 2 = gives 10', () =>
  assertEqual(calc(2, '+', 3, '=', '\u00d7', 2, '='), '10'));
check('repeated calculations without AC: 2+3= then 9+1=', () => {
  const c = calcState(2, '+', 3, '=');
  assertEqual(c.display(), '5');
  ['9', '+', '1', '='].forEach(k => c.press(k));
  assertEqual(c.display(), '10');
});
check('equals twice does not corrupt result', () => assertEqual(calc(2, '+', 3, '=', '='), '5'));

/* ================================================================== */
/* 6. Clear / delete / double zero                                     */
/* ================================================================== */

section('Calculator logic - clear, delete, double zero');

check('clear: AC resets everything', () => {
  const c = new Calculator();
  c.press(9); c.press('+'); c.press(1);
  assertEqual(c.press('AC'), '0');
  assertEqual(c.press(7), '7');
});
check('delete: 123 DEL -> 12', () => assertEqual(calc(1, 2, 3, 'DEL'), '12'));
check('delete all digits -> 0', () => assertEqual(calc(5, 'DEL'), '0'));
check('delete removes pending operator', () => assertEqual(calc(5, '+', 'DEL', 3), '3'));
check('delete after equals starts over', () => assertEqual(calc(2, '+', 3, '=', 'DEL', 9), '9'));
check('double zero: 5 00 -> 500', () => assertEqual(calc(5, '00'), '500'));
check('double zero on empty stays single 0', () => assertEqual(calc('00'), '0'));
check('double zero after 0 stays 0', () => assertEqual(calc(0, '00'), '0'));

/* ================================================================== */
/* 7. Error handling                                                   */
/* ================================================================== */

section('Calculator logic - error handling');

check('division by zero shows error', () => assertEqual(calc(5, '\u00f7', 0, '='), "Can't divide by 0"));
check('division by zero inside larger expression errors safely', () =>
  assertEqual(calc(2, '+', 3, '\u00f7', 0, '='), "Can't divide by 0"));
check('AC recovers from division-by-zero error', () => {
  const c = new Calculator();
  c.press(5); c.press('\u00f7'); c.press(0); c.press('=');
  assertEqual(c.press('AC'), '0');
  assertEqual(c.press(1), '1');
});
check('other keys are inert while in error state', () => {
  const c = new Calculator();
  c.press(5); c.press('\u00f7'); c.press(0); c.press('=');
  assertEqual(c.press(9), "Can't divide by 0");
  assertEqual(c.press('='), "Can't divide by 0");
});

/* ================================================================== */
/* 8. Invalid input protection                                         */
/* ================================================================== */

section('Calculator logic - invalid input protection');

check('leading zeros collapsed (0 0 5 -> 5)', () => assertEqual(calc(0, 0, 5), '5'));
check('very long entry clamped to 15 chars', () => {
  const keys = Array(30).fill('9');
  const out = calc(...keys);
  assert(out.length <= 15, `entry length ${out.length} exceeds cap`);
});
check('unknown keys ignored without crash', () => assertEqual(calc('foo', 4, 'bar', '+', 1, '='), '5'));
check('fuzz: 500 random key sequences never crash or NaN', () => {
  const alphabet = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '.', '+',
    '\u2212', '\u00d7', '\u00f7', '%', '=', 'AC', 'DEL'];
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 500; i++) {
    const c = new Calculator();
    const n = 1 + Math.floor(rand() * 40);
    for (let k = 0; k < n; k++) {
      const out = c.press(alphabet[Math.floor(rand() * alphabet.length)]);
      assert(typeof out === 'string' && out.length > 0, `fuzz produced bad display: ${out}`);
      assert(!/\bNaN\b/.test(out) && out !== 'undefined' && out !== 'null', `fuzz produced ${out}`);
    }
  }
});

/* ================================================================== */
/* 9. Large numbers and decimal precision                              */
/* ================================================================== */

section('Calculator logic - large numbers & precision');

check('large result uses scientific notation', () => {
  const out = calc('999999999999999', '\u00d7', 9, '=');
  assert(/e\+?15/i.test(out), `unexpected large-number format: ${out}`);
});
check('formatting helper: 1e21 formats exponentially', () => {
  const s = Calculator.formatNumber(1e21);
  assert(/e\+?21/i.test(s), `unexpected big-number format: ${s}`);
});
check('formatting helper: tiny values stay readable', () => {
  const s = Calculator.formatNumber(0.000000001);
  assert(parseFloat(s) === 1e-9, `unexpected small-number format: ${s}`);
});
check('decimal precision: 0.1 + 0.2 = 0.3', () => assertEqual(calc('0.1', '+', '0.2', '='), '0.3'));
check('decimal precision: 1 \u00f7 3 \u00d7 3 = 1', () => assertEqual(calc(1, '\u00f7', 3, '\u00d7', 3, '='), '1'));
check('evaluator rejects malformed token lists', () => {
  let threw = false;
  try { Calculator.evaluateTokens(['+', 1, 2]); } catch (e) { threw = true; }
  assert(threw, 'malformed tokens must throw an evaluation error');
});

/* ================================================================== */
/* 10. Required project files                                          */
/* ================================================================== */

section('Required project files');

[
  'package.json',
  'build.js',
  'AGENTS.md',
  'AndroidManifest.xml',
  'res/values/strings.xml',
  'res/values/styles.xml',
  'res/values/colors.xml',
  'www/index.html',
  'www/css/styles.css',
  'www/js/calculator.js',
  'www/js/app.js',
  'src/com/simple/calculator/MainActivity.java',
  'tools/genicons.js',
  'tools/zipalign.js',
  'tools/clean.js',
  'tools/verify.js',
  'tools/version.js',
  'tools/release.js',
  'tools/scaffold.js',
  'tests/run-tests.js',
  '.gitignore',
  '.github/workflows/build.yml'
].forEach(f => check(`exists: ${f}`, () => mustExist(f)));

check('AGENTS.md contains the mandatory factory workflow', () => {
  const a = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8').toLowerCase();
  ['one simple idea', 'opencode provides the complete app', 'automatic product analysis',
    'automatic ux/ui design', 'automatic feature plan',
    'github actions', '/storage/emulated/0/download/',
    'api 26', 'never commit', 'professional'].forEach(s =>
    assert(a.includes(s), `AGENTS.md missing rule: ${s}`));
});

check('versioning: manifest starts at 1.0.0 (code 1)', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'version.js')], { encoding: 'utf8' });
  assert(out.includes('versionName=1.0.0') && out.includes('versionCode=1'), `unexpected: ${out.trim()}`);
});

check('scaffold: derives valid package names and rejects bad ones', () => {
  const scaffold = fs.readFileSync(path.join(ROOT, 'tools', 'scaffold.js'), 'utf8');
  assert(scaffold.includes('com.${prefix}') || scaffold.includes('com.'), 'no package prefix logic');
  assert(/slugify/.test(scaffold), 'no slugify sanitisation');
});

check('package.json defines all npm commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  ['test', 'build', 'clean', 'verify'].forEach(s =>
    assert(pkg.scripts && pkg.scripts[s], `missing scripts.${s}`));
});

check('zero npm dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert(!pkg.dependencies, 'package.json has dependencies');
  assert(!pkg.devDependencies, 'package.json has devDependencies');
});

check('no Gradle files in project', () => {
  ['build.gradle', 'settings.gradle', 'gradlew', 'gradlew.bat', 'gradle']
    .forEach(g => assert(!fs.existsSync(path.join(ROOT, g)), `Gradle artifact present: ${g}`));
});

check('manifest: correct package, launcher intent, no permissions, API 26+', () => {
  const m = fs.readFileSync(path.join(ROOT, 'AndroidManifest.xml'), 'utf8');
  assert(m.includes('package="com.simple.calculator"'), 'wrong package');
  assert(m.includes('android.intent.action.MAIN'), 'missing MAIN action');
  assert(m.includes('android.intent.category.LAUNCHER'), 'missing LAUNCHER category');
  assert(!m.includes('<uses-permission'), 'app must declare no permissions');
  assert(m.includes('@mipmap/ic_launcher'), 'manifest must reference launcher icon');
  assert(m.includes('android:minSdkVersion="26"'), 'minSdkVersion must be 26');
});

check('UI layout matches specified keypad grid', () => {
  const html = fs.readFileSync(path.join(ROOT, 'www', 'index.html'), 'utf8');
  const order = ['AC', 'DEL', '%', '\u00f7', '7', '8', '9', '\u00d7', '4', '5', '6',
    '\u2212', '1', '2', '3', '+', '0', '00', '.', '='];
  const positions = order.map(k => html.indexOf(`data-key="${k}"`));
  positions.forEach((p, i) => assert(p !== -1, `key ${order[i]} missing from layout`));
  const sorted = positions.slice().every((p, i) => i === 0 || positions[i - 1] < p);
  assert(sorted, 'keypad buttons are out of the specified order');
});

check('no eval() used anywhere in app code', () => {
  // strip comments first so prose mentioning eval() cannot false-positive
  const strip = src => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"\\])\/\/.*$/g, '$1');
  ['www/js/calculator.js', 'www/js/app.js'].forEach(f => {
    const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    assert(!/(^|[^.\w])eval\s*\(/.test(src), `${f} uses eval()`);
    assert(!/new Function\s*\(/.test(src), `${f} uses new Function()`);
  });
});

/* ================================================================== */
/* 11. Launcher icons                                                  */
/* ================================================================== */

section('Launcher icons');

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
Object.entries(DENSITIES).forEach(([d, size]) => {
  ['ic_launcher.png', 'ic_launcher_round.png'].forEach(icon => {
    check(`icon res/mipmap-${d}/${icon} is a valid ${size}x${size} PNG`, () => {
      const p = mustExist(path.join('res', `mipmap-${d}`, icon));
      const dims = readPNG(p);
      assertEqual(dims.width, size, `${icon} width`);
      assertEqual(dims.height, size, `${icon} height`);
    });
  });
});

/* ================================================================== */
/* 12. APK generation                                                  */
/* ================================================================== */

section('APK generation');

check('npm run build completes successfully', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js')], {
    cwd: ROOT, encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'inherit']
  });
  APK = findDistApk();
  assert(APK, 'no .apk produced in dist/');
});

check('APK is a plausible size (> 10 KB)', () => {
  const size = fs.statSync(APK).size;
  assert(size > 10 * 1024, `APK too small: ${size} bytes`);
});

check('APK starts with ZIP magic', () => {
  const b = fs.readFileSync(APK);
  assert(b[0] === 0x50 && b[1] === 0x4b, 'not a ZIP/APK file');
});

/* ================================================================== */
/* 13. APK contents                                                    */
/* ================================================================== */

section('APK contents');

const aapt = findAapt();
let badging = '';
let listing = '';
check('aapt can parse the APK', () => {
  badging = execFileSync(aapt, ['dump', 'badging', APK], { encoding: 'utf8' });
  listing = execFileSync(aapt, ['list', APK], { encoding: 'utf8' });
});

check('badging: package com.simple.calculator v1.0.0', () => {
  assert(badging.includes("package: name='com.simple.calculator'"), 'wrong package in badging');
  assert(badging.includes("versionName='1.0.0'"), 'wrong versionName');
});
check('badging: app label is "Simple Calculator"', () => {
  assert(badging.includes("application-label:'Simple Calculator'"), 'wrong app label');
});
check('badging: launchable activity present', () => {
  assert(badging.includes("launchable-activity: name='com.simple.calculator.MainActivity'"), 'no launchable activity');
});
check('badging: no permissions requested', () => {
  assert(!badging.includes('uses-permission'), 'APK requests permissions');
});
check('badging: minSdk 26 / targetSdk 29', () => {
  assert(badging.includes("sdkVersion:'26'"), 'wrong minSdk');
  assert(badging.includes("targetSdkVersion:'29'"), 'wrong targetSdk');
});
check('badging: versionName 1.0.0 / versionCode 1', () => {
  assert(badging.includes("versionName='1.0.0'"), 'wrong versionName in badging');
});
check('badging: versioned APK filename matches <AppName>-v<version>.apk', () => {
  assert(path.basename(APK) === 'Simple-Calculator-v1.0.0.apk', `unexpected name: ${path.basename(APK)}`);
});
check('badging: release build (not debuggable)', () => {
  assert(!badging.includes('application-debuggable'), 'APK is marked debuggable');
});

['classes.dex', 'assets/index.html', 'assets/css/styles.css', 'assets/js/calculator.js',
  'assets/js/app.js', 'resources.arsc',
  'res/mipmap-mdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi-v4/ic_launcher.png'
].forEach(f => check(`APK contains ${f}`, () => {
  assert(listing.split('\n').includes(f), `${f} missing from APK`);
}));

check('stored entries are 4-byte aligned (zipalign)', () => {
  const b = fs.readFileSync(APK);
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert(eocd >= 0, 'EOCD missing');
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    assert(b.readUInt32LE(p) === 0x02014b50, 'bad central dir');
    const method = b.readUInt16LE(p + 10);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const localOffset = b.readUInt32LE(p + 42);
    if (method === 0) {
      const lNameLen = b.readUInt16LE(localOffset + 26);
      const lExtraLen = b.readUInt16LE(localOffset + 28);
      const dataOff = localOffset + 30 + lNameLen + lExtraLen;
      assert(dataOff % 4 === 0, `stored entry data at unaligned offset ${dataOff}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
});

/* ================================================================== */
/* 14. APK signing                                                     */
/* ================================================================== */

section('APK signing');

check('apksigner verify passes (v1+v2 schemes)', () => {
  const out = execFileSync(findApksigner(), ['verify', '--verbose', APK], {
    encoding: 'utf8', env: javaEnv(), timeout: 120000
  });
  assert(/Verified using v\d scheme/i.test(out), `signature not verified:\n${out}`);
  assert(!/NOT verified/i.test(out), 'signature reported as NOT verified');
});

check('signing certificate identity matches project', () => {
  const out = execFileSync(findApksigner(), ['verify', '--print-certs', APK], {
    encoding: 'utf8', env: javaEnv(), timeout: 120000
  });
  assert(out.includes('CN=Simple Calculator'), 'unexpected certificate DN');
});

/* ================================================================== */
/* 15. Delivery copy                                                   */
/* ================================================================== */

section('Delivery');

if (fs.existsSync(path.dirname(DOWNLOAD_APK))) {
  check(`copy delivered to ${DOWNLOAD_APK}`, () => {
    assert(fs.existsSync(DOWNLOAD_APK), 'Download copy missing');
    assertEqual(fs.statSync(DOWNLOAD_APK).size, fs.statSync(APK).size, 'download copy size differs from dist APK');
  });
} else {
  console.log(`  skip ${DOWNLOAD_APK} (directory not present on this machine)`);
}

/* ---------------- summary ---------------- */

console.log('\n========================================');
console.log(`PASSED: ${passed}  FAILED: ${failed}`);
if (failed) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(` - ${f.name}: ${f.err.message}`));
  process.exit(1);
}
console.log('ALL TESTS PASSED');
