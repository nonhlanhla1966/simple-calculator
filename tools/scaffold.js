#!/usr/bin/env node
/*
 * Android App Factory - scaffolds a complete new app project using the
 * proven Node.js + Android SDK build system (no Gradle).
 *
 *   node tools/scaffold.js "My App" [targetDir]
 *
 * - Derives a valid unique package name: com.nonhlanhla1966.<slug>
 * - Sets versionName=1.0.0, versionCode=1
 * - Generates a letter-based launcher icon in all densities (customize the
 *   generated tools/genicons.js THEME/GLYPH section per app idea).
 * - Copies the app-agnostic infrastructure from THIS project (build.js,
 *   zipalign, clean, version, AGENTS.md, CI workflow).
 *
 * App-specific code is never copied from other apps.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SOURCE_ROOT = path.join(__dirname, '..');
const DEFAULT_PREFIX = 'nonhlanhla1966';

function slugify(name) {
  return String(name).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function javaPackage(appName, prefix) {
  const slug = slugify(appName).replace(/-/g, '');
  if (!/^[a-z][a-z0-9]*$/.test(slug)) {
    throw new Error(`Cannot derive a valid package segment from "${appName}"`);
  }
  return `com.${prefix}.${slug}`;
}

function mustRead(rel) {
  return fs.readFileSync(path.join(SOURCE_ROOT, rel), 'utf8');
}

/* ---------- embedded app-specific templates ---------- */

function manifestTemplate(pkg) {
return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk
        android:minSdkVersion="26"
        android:targetSdkVersion="29" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`;
}

function stringsTemplate(appName) {
return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appName}</string>
</resources>
`;
}

function colorsTemplate(primary, background) {
return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="app_background">${background}</color>
    <color name="status_bar">${primary}</color>
</resources>
`;
}

const STYLES_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.Material.NoActionBar">
        <item name="android:windowBackground">@color/app_background</item>
        <item name="android:statusBarColor">@color/status_bar</item>
        <item name="android:navigationBarColor">@color/status_bar</item>
    </style>
</resources>
`;

function activityTemplate(pkg) {
return `package ${pkg};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Minimal host activity: renders the local HTML/CSS/JS app from assets. */
public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        webView.setBackgroundColor(0xFF10131A);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
`;
}

function indexHtmlTemplate(appName) {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${appName}</title>
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<main class="app">
  <h1>${appName}</h1>
  <p>Edit www/index.html to start building your app.</p>
</main>
<script src="js/app.js"></script>
</body>
</html>
`;
}

const STYLES_CSS = `/* App styles - responsive, light/dark aware. */
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif;
  background: #f2f4f8; color: #1b2030; }
@media (prefers-color-scheme: dark) {
  html, body { background: #10131a; color: #f4f6fb; }
}
.app { max-width: 560px; margin: 0 auto; padding: 24px; }
`;

const APP_JS = `/* App UI logic - replace with your app's behaviour. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    console.log('app ready');
  });
})();
`;

function geniconsTemplate(letter, fg, bgTop, bgBottom) {
return `#!/usr/bin/env node
/*
 * Launcher icon generator - pure Node (zlib built-in).
 * Default glyph: app initial on a gradient tile. Customize THEME below or
 * replace shapeAt() to draw a bespoke icon for this app.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const THEME = { fg: '${fg}', bgTop: '${bgTop}', bgBottom: '${bgBottom}', letter: '${letter}' };

/* ---- PNG encoding ---- */
const CRC_TABLE = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
function crc32(b) { let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]); }
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6;
  const raw = Buffer.alloc(h*(w*4+1));
  for (let y=0;y<h;y++) { const s=y*(w*4+1); raw[s]=0;
    rgba.copy(raw,s+1,y*w*4,(y+1)*w*4); }
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

/* ---- 5x7 bitmap font (subset: A-Z 0-9) ---- */
const FONT = {
A:["01110","10001","10001","11111","10001","10001","10001"],
B:["11110","10001","10001","11110","10001","10001","11110"],
C:["01111","10000","10000","10000","10000","10000","01111"],
D:["11110","10001","10001","10001","10001","10001","11110"],
E:["11111","10000","10000","11110","10000","10000","11111"],
F:["11111","10000","10000","11110","10000","10000","10000"],
G:["01111","10000","10000","10111","10001","10001","01110"],
H:["10001","10001","10001","11111","10001","10001","10001"],
I:["11111","00100","00100","00100","00100","00100","11111"],
J:["00111","00010","00010","00010","00010","10010","01100"],
K:["10001","10010","10100","11000","10100","10010","10001"],
L:["10000","10000","10000","10000","10000","10000","11111"],
M:["10001","11011","10101","10101","10001","10001","10001"],
N:["10001","11001","10101","10011","10001","10001","10001"],
O:["01110","10001","10001","10001","10001","10001","01110"],
P:["11110","10001","10001","11110","10000","10000","10000"],
Q:["01110","10001","10001","10001","10101","10010","01101"],
R:["11110","10001","10001","11110","10100","10010","10001"],
S:["01111","10000","10000","01110","00001","00001","11110"],
T:["11111","00100","00100","00100","00100","00100","00100"],
U:["10001","10001","10001","10001","10001","10001","01110"],
V:["10001","10001","10001","10001","10001","01010","00100"],
W:["10001","10001","10001","10101","10101","11011","10001"],
X:["10001","01010","00100","00100","00100","01010","10001"],
Y:["10001","01010","00100","00100","00100","00100","00100"],
Z:["11111","00001","00010","00100","01000","10000","11111"],
"0":["01110","10001","10011","10101","11001","10001","01110"],
"1":["00100","01100","00100","00100","00100","00100","01110"],
"2":["01110","10001","00001","00010","00100","01000","11111"],
"3":["11111","00010","00100","00010","00001","10001","01110"],
"4":["00010","00110","01010","10010","11111","00010","00010"],
"5":["11111","10000","11110","00001","00001","10001","01110"],
"6":["00110","01000","10000","11110","10001","10001","01110"],
"7":["11111","00001","00010","00100","01000","01000","01000"],
"8":["01110","10001","10001","01110","10001","10001","01110"],
"9":["01110","10001","10001","01111","00001","00010","01100"]
};

function hex(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];}
function lerp(a,b,t){return a+(b-a)*t;}
function inRoundRect(px,py,x,y,w,h,r){
  if(px<x||px>x+w||py<y||py>y+h)return false;
  const cx=Math.max(x+r,Math.min(px,x+w-r)),cy=Math.max(y+r,Math.min(py,y+h-r));
  const dx=px-cx,dy=py-cy;return dx*dx+dy*dy<=r*r;}

function shapeAt(px,py){
  let t=Math.min(1,Math.max(0,py/48));
  let col=[Math.round(lerp(hex(THEME.bgTop)[0],hex(THEME.bgBottom)[0],t)),
           Math.round(lerp(hex(THEME.bgTop)[1],hex(THEME.bgBottom)[1],t)),
           Math.round(lerp(hex(THEME.bgTop)[2],hex(THEME.bgBottom)[2],t))];
  if(inRoundRect(px,py,6,6,36,36,8))col=hex(THEME.fg);
  // letter glyph centred on the tile
  const rows=FONT[THEME.letter.toUpperCase()]||FONT.A;
  const s=4,pad=(rows[0].length*s);
  const ox=24-pad/2+s*0,oy=24-(7*s)/2;
  outer:
  for(let r=0;r<7;r++)for(let c=0;c<5;c++){
    if(rows[r][c]==='1'){
      if(px>=ox+c*s&&px<ox+c*s+s&&py>=oy+r*s&&py<oy+r*s+s){col=[16,19,26];break outer;}
    }
  }
  return col;
}

function draw(size,round){
  const S=size/48,img=Buffer.alloc(size*size*4),SS=3,R=23.4;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let r=0,g=0,b=0,a=0;
    for(let sy=0;sy<SS;sy++)for(let sx=0;sx<SS;sx++){
      const dx=(x+(sx+.5)/SS)/S,dy=(y+(sy+.5)/SS)/S;
      if(round){const ex=dx-24,ey=dy-24;if(ex*ex+ey*ey>R*R)continue;}
      const c=shapeAt(dx,dy);r+=c[0];g+=c[1];b+=c[2];a++;
    }
    const i=(y*size+x)*4,n=SS*SS;
    img[i]=a?Math.round(r/a):0;img[i+1]=a?Math.round(g/a):0;
    img[i+2]=a?Math.round(b/a):0;img[i+3]=Math.round((a/n)*255);
  }
  return img;
}

const DENSITIES={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
const outRoot=path.join(__dirname,'..','res');
for(const[d,size]of Object.entries(DENSITIES)){
  const dir=path.join(outRoot,'mipmap-'+d);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'ic_launcher.png'),encodePNG(size,size,draw(size,false)));
  fs.writeFileSync(path.join(dir,'ic_launcher_round.png'),encodePNG(size,size,draw(size,true)));
  console.log('mipmap-'+d+': OK');
}
console.log('Icons generated.');
`;
}

function verifyTemplate() {
return `#!/usr/bin/env node
/* Verifies the built APK: existence, ZIP validity, badging, signature. */
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync,spawnSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const DIST=path.join(ROOT,'dist');
function findJavaHome(){const j='/opt/java/jdk1.8.0_212';
  if(process.env.JAVA_HOME&&fs.existsSync(path.join(process.env.JAVA_HOME,'bin','javac')))return process.env.JAVA_HOME;
  if(fs.existsSync(path.join(jdk(),'bin','javac')))return jdk();throw new Error('JDK not found');}
function jdk(){return '/opt/java/jdk1.8.0_212';}
function env(){const e={...process.env};e.JAVA_HOME=findJavaHome();e.PATH=path.join(findJavaHome(),'bin')+path.delimiter+e.PATH;return e;}
function findSdk(){return process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME||'/opt/android_sdk';}
function findAapt(){const cs=['/usr/bin/aapt'];const bt=path.join(findSdk(),'build-tools');
  try{for(const v of fs.readdirSync(bt).sort().reverse())cs.push(path.join(bt,v,'aapt'));}catch(_){}
  for(const c of cs){try{execFileSync(c,['v'],{stdio:'ignore'});return c;}catch(_){}}
  throw new Error('no runnable aapt');}
function findSigner(){const bt=path.join(findSdk(),'build-tools');
  for(const v of fs.readdirSync(bt).sort().reverse()){const c=path.join(bt,v,'apksigner');
    if(fs.existsSync(c)){try{execFileSync(c,['--version'],{stdio:'ignore',env:env()});return c;}catch(_){}}}
  throw new Error('apksigner not found');}

const apks=fs.existsSync(DIST)?fs.readdirSync(DIST).filter(f=>f.endsWith('.apk')):[];
if(!apks.length){console.error('VERIFY FAILED: no APK in dist/');process.exit(1);}
const apk=path.join(DIST,apks[0]);
console.log('Verifying',apks[0]);
const badging=execFileSync(findAapt(),['dump','badging',apk],{encoding:'utf8'});
execFileSync(findAapt(),['list',apk],{encoding:'utf8'});
const out=execFileSync(findSigner(),['verify','--verbose',apk],{encoding:'utf8',env:env()});
const ok=/Verified using v\\d scheme/i.test(out)&&!/NOT verified/i.test(out);
console.log('signature:',ok?'OK':'FAILED');
console.log(ok?'APK VERIFIED OK':'VERIFY FAILED');process.exit(ok?0:1);
`;
}

function runTestsTemplate(appName, pkg) {
return `#!/usr/bin/env node
/* Validation suite for ${appName}. Zero dependencies. Run with: npm test
 * This baseline checks build integrity. Per AGENTS.md you MUST extend it
 * with tests for real application behavior (features, storage, edge cases)
 * before declaring the app complete - file-existence tests alone are not
 * acceptable for a finished app. */
 'use strict';
 const fs=require('fs'),path=require('path'),{execFileSync,spawnSync}=require('child_process');
 const ROOT=path.join(__dirname,'..');
 let passed=0,failed=0;const failures=[];
const section=n=>console.log('\\n== '+n+' ==');
function check(name,fn){try{fn();passed++;console.log('  ok  '+name);}
  catch(err){failed++;failures.push(name+': '+err.message);console.log('FAIL  '+name+'\\n      '+err.message);}}
const assert=(c,m)=>{if(!c)throw new Error(m||'assertion failed');};

section('Required files');
['package.json','build.js','AndroidManifest.xml','AGENTS.md','res/values/strings.xml',
 'www/index.html','src/${pkg.replace(/\./g,'/')}/MainActivity.java',
 '.github/workflows/build.yml','.gitignore'].forEach(f=>
  check('exists: '+f,()=>assert(fs.existsSync(path.join(ROOT,f)),'missing '+f)));

section('Icons');
[['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]].forEach(([d,s])=>{
  ['ic_launcher.png','ic_launcher_round.png'].forEach(n=>{
    check(\`icon mipmap-\${d}/\${n} is \${s}x\${s}\`,()=>{
      const p=path.join(ROOT,'res','mipmap-'+d,n);
      assert(fs.existsSync(p),'missing icon');
      const b=fs.readFileSync(p);
      assert(b.readUInt32BE(16)===s&&b.readUInt32BE(20)===s,'wrong dimensions');});});});

section('Manifest');
check('package/name/intent correct',()=>{
  const m=fs.readFileSync(path.join(ROOT,'AndroidManifest.xml'),'utf8');
  assert(m.includes('package="${pkg}"'),'wrong package');
  assert(m.includes('android.intent.category.LAUNCHER'),'no LAUNCHER');
  assert(!m.includes('<uses-permission'),'must be permission-free');});

section('Build & APK');
const APK=path.join(ROOT,'dist');
check('npm run build succeeds',()=>{execFileSync(process.execPath,[path.join(ROOT,'build.js')],
  {cwd:ROOT,encoding:'utf8',timeout:300000,stdio:['ignore','pipe','inherit']});
  const list=fs.readdirSync(APK).filter(f=>f.endsWith('.apk'));
  assert(list.length===1,'expected exactly one APK');});
let badging='';
check('APK badging/signature',()=>{
  const apk=path.join(APK,fs.readdirSync(APK).find(f=>f.endsWith('.apk')));
  const jh=process.env.JAVA_HOME&&fs.existsSync(path.join(process.env.JAVA_HOME,'bin','javac'))
    ?process.env.JAVA_HOME:'/opt/java/jdk1.8.0_212';
  if(!fs.existsSync(path.join(jh,'bin','javac'))&&!process.env.JAVA_HOME)
    throw new Error('no JDK found');
  const env={...process.env};env.JAVA_HOME=jh;
  env.PATH=path.join(jh,'bin')+path.delimiter+env.PATH;
  const aapt=['/usr/bin/aapt'];
  const sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME||'/opt/android_sdk';
  const bt=path.join(sdk,'build-tools');
  try{for(const v of fs.readdirSync(bt).sort().reverse())aapt.push(path.join(bt,v,'aapt'));}catch(_){}
  let a=null;for(const c of aapt){try{execFileSync(c,['v'],{stdio:'ignore'});a=c;break;}catch(_){}}
  badging=execFileSync(a,['dump','badging',apk],{encoding:'utf8'});
  assert(badging.includes("package: name='"),'cannot read badging');
  assert(badging.includes('application-label'), 'no label');
  assert(!badging.includes('uses-permission'),'no permissions allowed');
  const signer=(()=>{for(const v of fs.readdirSync(bt).sort().reverse()){
    const c=path.join(bt,v,'apksigner');if(fs.existsSync(c))return c;}throw new Error('no apksigner');})();
  const out=execFileSync(signer,['verify','--verbose',apk],{encoding:'utf8',env});
  assert(/Verified using v\\d scheme/i.test(out),'signature failed');});

section('Publish (browser-based download; no phone-storage copy)');
check('release.js publishes verified APK as release asset',()=>{
  const p=path.join(ROOT,'tools','release.js');
  assert(fs.existsSync(p),'missing tools/release.js');
  const s=fs.readFileSync(p,'utf8');
  assert(s.includes('DOWNLOAD AVAILABLE'),'release.js lacks final status line');
  assert(s.includes('uploads.github.com'),'does not upload release assets');});
check('no automatic phone-storage delivery remains',()=>{
  const pkgJson=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const scripts=Object.values(pkgJson.scripts||{}).join(' ');
  assert(!scripts.includes('deliver.js'),'package.json still invokes deliver.js');
  assert(!fs.existsSync(path.join(ROOT,'tools','deliver.js')),'deliver.js still present');
  const a=fs.readFileSync(path.join(ROOT,'AGENTS.md'),'utf8');
  assert(/never\\s+copies\\s+apks/i.test(a),'AGENTS.md does not prohibit automatic copies');
  assert(a.includes('APK READY'),'AGENTS.md missing APK READY status');});
check('AGENTS.md documents browser-based user-controlled download',()=>{
  const a=fs.readFileSync(path.join(ROOT,'AGENTS.md'),'utf8');
  assert(/default browser/i.test(a),'default-browser flow missing');
  assert(/user-controlled|USER-CONTROLLED/.test(a),'user-control principle missing');});

section('Cloud-first policy (thermal-safe)');
check('build.js enforces single-build lock + wall-clock protection',()=>{
  const b=fs.readFileSync(path.join(ROOT,'build.js'),'utf8');
  assert(b.includes('appfactory-android-build.lock'),'no factory build lock');
  assert(b.includes('OPENCODE_LOCAL_BUILD_TIMEOUT'),'no local build deadline guard');
  assert(b.includes('GitHub Actions'),'cloud-first banner missing');});
check('fetch-cloud-apk.js waits for Actions artifact of current HEAD',()=>{
  const p=path.join(ROOT,'tools','fetch-cloud-apk.js');
  assert(fs.existsSync(p),'missing tools/fetch-cloud-apk.js');
  const s=fs.readFileSync(p,'utf8');
  assert(s.includes('/actions/runs'),'does not query Actions runs');
  assert(s.includes('.apk')&&s.includes('inflateRawSync'),'cannot extract APK from artifact');
  assert(s.includes('versionName'),'does not verify version');});
check('AGENTS.md documents the thermal-safe cloud-first policy',()=>{
  const a=fs.readFileSync(path.join(ROOT,'AGENTS.md'),'utf8');
  assert(/thermal-safe cloud-first/i.test(a),'policy section missing');
  assert(/never\\s+bypass/i.test(a),'thermal-bypass prohibition missing');});

section('Factory orchestration (checkpoint/resume/multi-model/$0)');
check('orchestration modules inherited',()=>{
  ['checkpoint.js','models.js','perm.js','factory.js','net.js'].forEach(f=>
    assert(fs.existsSync(path.join(ROOT,'tools',f)),'missing tools/'+f));
  const Ckpt=require(path.join(ROOT,'tools','checkpoint'));
  const ModelsMod=require(path.join(ROOT,'tools','models'));
  const PermMod=require(path.join(ROOT,'tools','perm'));
  assert(Ckpt.STAGES.includes('DOWNLOAD_READY'),'stage list incomplete');
  assert(typeof ModelsMod.route==='function'&&typeof ModelsMod.redact==='function','models API missing');
  assert(typeof PermMod.probeWrite==='function','perm API missing');});
check('checkpoint roundtrip + resume skips completed stages',()=>{
  const os=require('os'),Ckpt=require(path.join(ROOT,'tools','checkpoint'));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ckpt-'));
  const s=Ckpt.fresh('idea x');
  Ckpt.save(dir,s);
  const loaded=Ckpt.load(dir);
  Ckpt.complete(dir,loaded,'TEST');
  const again=Ckpt.load(dir);
  assert(again.completed.TEST&&Ckpt.nextStage(again)==='LOCAL_VALIDATION','roundtrip broken');
  const st=Ckpt.fresh(null);
  st.stage='IDEA';
  const plan=Ckpt.resumePlan(st,{hasManifest:true,hasGit:true,distApks:[]});
  assert(plan.from==='TEST'&&!plan.skip.includes('TEST'),'resume plan wrong');});
check('free-first routing; paid never routed without explicit opt-in',()=>{
  const ModelsMod=require(path.join(ROOT,'tools','models'));
  const reg={models:[{ref:'openai/gpt-x',provider:'openai',cost:'paid'},
    {ref:'ollama/llama3',provider:'ollama',cost:'free'},
    {ref:'host/m',provider:'host',cost:'unknown'}]};
  const order=ModelsMod.route(reg,{});
  if(order[0].ref!=='ollama/llama3')throw new Error('free model not first');
  if(order.some(m=>m.cost==='paid'))throw new Error('paid leaked into route');
  let msg=null;
  try{ModelsMod.route({models:[{ref:'anthropic/c',provider:'anthropic',cost:'paid'}]},{});}catch(e){msg=e.message;}
  assert(msg&&/Paid model\\/provider would be required\\./.test(msg),'paid prevention message wrong: '+msg);});
check('model fallback on unavailable + rate limit; finite exhaustion',()=>{
  const r=spawnSync(process.execPath,['-e',
    'const path=require("path");const Models=require(path.join(process.argv[1],"tools","models"));'+
    'const reg={models:[{ref:"a/dead",provider:"a",cost:"free"},'+
    '{ref:"b/lim",provider:"b",cost:"free"},{ref:"c/ok",provider:"c",cost:"free"}]};'+
    'const invoker=async ref=>{if(ref==="a/dead")throw Object.assign(new Error("command not found"),{kind:"unavailable"});'+
    'if(ref==="b/lim")throw Object.assign(new Error("rate limit (429)"),{kind:"ratelimit"});return "ok-out";};'+
    'Models.invoke({prompt:"t"},{registry:reg,health:{},invoker,validate:()=>true}).then(res=>{'+
    'if(res.model!=="c/ok"||res.tried.length!==2)process.exit(1);'+
    'let n=0;const reg2={models:[{ref:"x/d",provider:"x",cost:"free"}]};'+
    'Models.invoke({prompt:"t"},{registry:reg2,health:{},validate:()=>true,'+
    'invoker:async()=>{n++;throw new Error("unavailable");}})'+
    '.then(()=>process.exit(1)).catch(e=>{if(/MODEL_EXHAUSTED/.test(e.message)&&n<=3)console.log("FALLBACK_OK");else process.exit(1);});})'+
    '.catch(e=>{console.error(e.message);process.exit(1);});',
    ROOT],{encoding:'utf8'});
  assert(r.status===0&&/FALLBACK_OK/.test(r.stdout),(r.stderr||r.stdout).trim());});
check('credential protection: redaction works, discovery skips secret keys',()=>{
  const os=require('os'),fs2=fs,ModelsMod=require(path.join(ROOT,'tools','models'));
  const clean=ModelsMod.redact('tok ghp_abcdefghijklmnopqrstuv1234567890 sk-abcdef123456 password=hunter2');
  assert(!/ghp_|sk-abcdef|hunter2/.test(clean),'redact missed secrets');
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'cfg-'));
  fs.mkdirSync(path.join(home,'.config','opencode'),{recursive:true});
  fs.writeFileSync(path.join(home,'.config','opencode','opencode.json'),
    JSON.stringify({model:'host/session-model',apiKey:'sk-SECRETVALUE'}));
  const disc=ModelsMod.discover({},home);
  assert(disc.models.some(m=>m.ref==='host/session-model'),'model not discovered');
  assert(!JSON.stringify(disc).includes('SECRETVALUE'),'secret leaked into discovery');});
check('permissions report exact requirements instead of prompting; no prompt code in tools',()=>{
  const PermMod=require(path.join(ROOT,'tools','perm'));
  const okRes=PermMod.probeWrite(require('os').tmpdir());
  assert(okRes.ok===true,'tmp writable dir reported blocked');
  const strip=src=>src.replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').replace(/^\\s*\\/\\/.*$/gm,'');
  fs.readdirSync(path.join(ROOT,'tools')).filter(f=>f.endsWith('.js')).forEach(f=>{
    const src=strip(fs.readFileSync(path.join(ROOT,'tools',f),'utf8'));
    [/require\\(\\s*['"]readline['"]\\s*\\)/,/readline\\s*\\.\\s*createInterface/,/\\bconfirm\\s*\\(/,/\\bprompt\\s*\\(/].forEach(p=>
      assert(!p.test(src),f+' appears to prompt interactively'));});
  const fsrc=strip(fs.readFileSync(path.join(ROOT,'tools','factory.js'),'utf8'));
  ['FACTORY_ALLOW_PAID','APK READY — DOWNLOAD AVAILABLE','--resume'].forEach(s=>
    assert(fsrc.includes(s),'factory.js missing: '+s));});

section('Network retry policy (TLS never disabled)');
check('net.js exists and exports the shared retry API',()=>{
  assert(fs.existsSync(path.join(ROOT,'tools','net.js')),'missing tools/net.js');
  const Net=require(path.join(ROOT,'tools','net.js'));
  assert(typeof Net.withRetry==='function','withRetry missing');
  assert(Net.MAX_ATTEMPTS===3,'MAX_ATTEMPTS must be 3');
  assert(typeof Net.classify==='function','classify missing');});
check('transient certificate failure retries; later attempt succeeds and workflow continues',()=>{
  const r=spawnSync(process.execPath,['-e',
    'const Net=require(process.argv[1]);let n=0;'+
    'Net.withRetry(()=>{n++;if(n<3){const e=new Error("certificate verification error: unable to verify the first certificate");throw e;}return "ok";},{delayMs:1,label:"t"})'+
    '.then(v=>{if(v==="ok"&&n===3)console.log("RECOVERED AUTOMATICALLY - attempt 3 succeeded");else process.exit(1);})'+
    '.catch(e=>{console.error(e.message);process.exit(1);});',
    path.join(ROOT,'tools','net.js')],{encoding:'utf8'});
  assert(r.status===0,'retry did not recover: '+r.stderr);
  assert(/RECOVERED AUTOMATICALLY/.test(r.stdout),'no recovery marker');});
check('maximum 3 attempts enforced with exact error report',()=>{
  const r=spawnSync(process.execPath,['-e',
    'const Net=require(process.argv[1]);let n=0;'+
    'Net.withRetry(()=>{n++;throw new Error("socket hang up");},{delayMs:1,label:"t"})'+
    '.then(()=>process.exit(1)).catch(e=>{if(n===3&&/FAILED AFTER 3 ATTEMPTS/.test(e.message))process.exit(0);process.exit(1);});',
    path.join(ROOT,'tools','net.js')],{encoding:'utf8'});
  assert(r.status===0,'expected exactly 3 attempts then FAILED AFTER 3 ATTEMPTS: '+r.stderr);});
check('permanent errors fail immediately (never retried)',()=>{
  const r=spawnSync(process.execPath,['-e',
    'const Net=require(process.argv[1]);let n=0;'+
    'Net.withRetry(()=>{n++;const e=new Error("Bad credentials");e.status=401;throw e;},{delayMs:1,label:"t"})'+
    '.then(()=>process.exit(1)).catch(e=>{if(n===1&&/PERMANENT FAILURE/.test(e.message))process.exit(0);process.exit(1);});',
    path.join(ROOT,'tools','net.js')],{encoding:'utf8'});
  assert(r.status===0,'401 must fail once without retry: '+r.stderr);});
check('classifier: cert/transient vs credentials/not-found permanent',()=>{
  const Net=require(path.join(ROOT,'tools','net.js'));
  assert(Net.classify({message:'certificate verification error'})==='transient','cert must be transient');
  assert(Net.classify({code:'ECONNRESET'})==='transient','ECONNRESET must be transient');
  assert(Net.classify({message:'rate limit exceeded',status:429})==='transient','429 must be transient');
  assert(Net.classify({message:'Bad credentials',status:401})==='permanent','401 must be permanent');
  assert(Net.classify({message:'Not Found',status:404})==='permanent','404 must be permanent');});
function assertNoTlsBypass(fileLabel, rawSrc){
  const s=rawSrc.replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').replace(/^\\s*\\/\\/.*$/gm,'');
  [/rejectUnauthorized\\s*:\\s*false/,/NODE_TLS_REJECT_UNAUTHORIZED/,/GIT_SSL_NO_VERIFY/,
   /--insecure/,/curl\\s+-k/,/sslVerify\\s*[:=]\\s*false/].forEach(p=>
    assert(!p.test(s),fileLabel+' disables TLS verification: '+p));}
check('TLS verification is never disabled anywhere in factory scripts',()=>{
  ['tools/net.js','tools/fetch-cloud-apk.js','tools/release.js','build.js'].forEach(f=>{
    assertNoTlsBypass(f,fs.readFileSync(path.join(ROOT,f),'utf8'));});});
check('TLS scanner: executable bypass is caught; comment-only mention passes',()=>{
  let caught=null;
  try{assertNoTlsBypass('synthetic-evil.js',
    'https.request({ hostname: "x", path: "/", rejectUnauthorized: false });');}catch(e){caught=e;}
  assert(caught&&/disables TLS verification/.test(caught.message),
    'executable rejectUnauthorized:false was NOT caught by scanner');
  assertNoTlsBypass('synthetic-doc.js',
    '/** docs: never set rejectUnauthorized:false anywhere */\\n'+
    '// see also: rejectUnauthorized: false is forbidden\\n'+
    'https.get("https://api.github.com");\\n');
  let caughtInString=null;
  try{assertNoTlsBypass('synthetic-string.js','const flag = "rejectUnauthorized: false";');}catch(_){caughtInString=true;}
  assert(caughtInString,'string-literal occurrence must stay flagged (conservative)');});
check('partial cloud APKs rejected: atomic publish, verify before rename, cleanup on failure',()=>{
  const s=fs.readFileSync(path.join(ROOT,'tools','fetch-cloud-apk.js'),'utf8');
  assert(s.includes('.part'),'no partial-file staging');
  assert(s.includes('renameSync'),'publish not atomic');
  assert(s.indexOf("'dump', 'badging'")<s.indexOf('renameSync'),'verification must precede publish');
  assert(s.includes('unlinkSync(partPath)'),'failed fetch leaves partial APK behind');
  assert(s.includes('Buffer.concat'),'download must buffer fully before use');
  assert(s.includes("withRetry"),'network calls not wrapped in retry policy');});

console.log('\\n========================================');
console.log('PASSED: '+passed+'  FAILED: '+failed);
if(failed){failures.forEach(f=>console.log(' - '+f));process.exit(1);}
console.log('ALL TESTS PASSED');
`;
}

function packageJsonTemplate(appSlugName) {
return `{
  "name": "${appSlugName}",
  "version": "1.0.0",
  "description": "Android app built with Node.js and Android SDK command-line tools",
  "private": true,
  "scripts": {
    "test": "node tests/run-tests.js",
    "build": "node build.js",
    "clean": "node tools/clean.js",
    "verify": "node tools/verify.js",
    "cloud": "node tools/fetch-cloud-apk.js",
    "publish": "node tools/release.js",
    "ship": "npm run cloud && npm run publish",
    "version": "node tools/version.js show",
    "icons": "node tools/genicons.js"
  },
  "license": "MIT",
  "engines": { "node": ">=14" }
}
`;
}

/* ---------- main ---------- */

function main() {
  const appName = process.argv[2];
  let target = process.argv[3];
  if (!appName) {
    console.error('usage: node tools/scaffold.js "App Name" [targetDir]');
    process.exit(2);
  }
  target = target || path.join(path.dirname(SOURCE_ROOT), slugify(appName));
  if (fs.existsSync(target) && fs.readdirSync(target).length) {
    throw new Error(`target dir not empty: ${target}`);
  }
  const pkg = javaPackage(appName, DEFAULT_PREFIX);
  const slug = slugify(appName);
  const pkgPath = pkg.split('.').join('/');
  const T = path.join(target);

  const dirs = [
    '', 'res/values', ...['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].map(d => `res/mipmap-${d}`),
    `src/${pkgPath}`, 'www/js', 'www/css', 'tools', 'tests', '.github/workflows'
  ];
  dirs.forEach(d => fs.mkdirSync(path.join(T, d), { recursive: true }));

  // App-specific files
  fs.writeFileSync(path.join(T, 'AndroidManifest.xml'), manifestTemplate(pkg));
  fs.writeFileSync(path.join(T, 'res', 'values', 'strings.xml'), stringsTemplate(appName));
  fs.writeFileSync(path.join(T, 'res', 'values', 'colors.xml'),
    colorsTemplate('#10131a', '#10131a'));
  fs.writeFileSync(path.join(T, 'res', 'values', 'styles.xml'), STYLES_XML);
  fs.writeFileSync(path.join(T, `src/${pkgPath}/MainActivity.java`), activityTemplate(pkg));
  fs.writeFileSync(path.join(T, 'www', 'index.html'), indexHtmlTemplate(appName));
  fs.writeFileSync(path.join(T, 'www', 'css', 'styles.css'), STYLES_CSS);
  fs.writeFileSync(path.join(T, 'www', 'js', 'app.js'), APP_JS);
  fs.writeFileSync(path.join(T, 'tools', 'genicons.js'),
    geniconsTemplate(slug.charAt(0).toUpperCase(), '#f4f6fb', '#333a58', '#14181f'));
  fs.writeFileSync(path.join(T, 'tests', 'run-tests.js'), runTestsTemplate(appName, pkg));
  fs.writeFileSync(path.join(T, 'package.json'), packageJsonTemplate(slug));

  // App-agnostic infrastructure copied from this proven project
  fs.writeFileSync(path.join(T, 'build.js'), mustRead('build.js'));
  fs.writeFileSync(path.join(T, 'tools', 'zipalign.js'), mustRead('tools/zipalign.js'));
  fs.writeFileSync(path.join(T, 'tools', 'clean.js'), mustRead('tools/clean.js'));
  fs.writeFileSync(path.join(T, 'tools', 'version.js'), mustRead('tools/version.js'));
  fs.writeFileSync(path.join(T, 'tools', 'release.js'), mustRead('tools/release.js'));
  fs.writeFileSync(path.join(T, 'tools', 'net.js'), mustRead('tools/net.js'));
  fs.writeFileSync(path.join(T, 'tools', 'checkpoint.js'), mustRead('tools/checkpoint.js'));
  fs.writeFileSync(path.join(T, 'tools', 'models.js'), mustRead('tools/models.js'));
  fs.writeFileSync(path.join(T, 'tools', 'perm.js'), mustRead('tools/perm.js'));
  fs.writeFileSync(path.join(T, 'tools', 'factory.js'), mustRead('tools/factory.js'));
  fs.writeFileSync(path.join(T, 'tools', 'verify.js'), verifyTemplate());
  fs.writeFileSync(path.join(T, 'tools', 'fetch-cloud-apk.js'), mustRead('tools/fetch-cloud-apk.js'));
  fs.writeFileSync(path.join(T, '.github', 'workflows', 'build.yml'),
    mustRead('.github/workflows/build.yml')
      .replace('name: Build Simple Calculator APK', `name: Build ${appName} APK`)
      .replace('name: Simple-Calculator-apk', `name: ${slug}-apk`));

  // .gitignore with secret protection + factory rules
  fs.writeFileSync(path.join(T, '.gitignore'), mustRead('.gitignore'));
  fs.writeFileSync(path.join(T, 'AGENTS.md'), mustRead('AGENTS.md'));

  // Generate launcher icons immediately so the first build works
  execFileSync(process.execPath, [path.join(T, 'tools', 'genicons.js')],
    { stdio: ['ignore', 'ignore', 'inherit'] });

  console.log(`Created ${appName} -> ${T}`);
  console.log(`package:     ${pkg}`);
  console.log(`version:     1.0.0 (code 1)`);
  console.log('next steps:');
  console.log('  1. edit tools/genicons.js THEME/GLYPH for the app concept; node tools/genicons.js');
  console.log('  2. implement www/');
  console.log('  3. npm test && npm run build');
  console.log('  4. commit, push, confirm Actions, ship via browser download (npm run ship)');
}

try { main(); } catch (err) { console.error('SCAFFOLD FAILED:', err.message); process.exit(1); }
