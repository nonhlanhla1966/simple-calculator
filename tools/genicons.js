/*
 * Launcher icon generator - zero dependencies (uses Node's built-in zlib).
 * Draws a modern calculator glyph on a gradient tile and encodes PNGs by hand.
 * Generates ic_launcher.png + ic_launcher_round.png for every required density.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------- PNG encoding ---------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- Drawing ---------------- */

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

function lerp(a, b, t) { return a + (b - a) * t; }

function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/*
 * Icon design in a 48x48 design space:
 *  - dark blue gradient tile
 *  - light rounded calculator body
 *  - dark display with two green "digit" bars
 *  - 3x4 button grid, orange equals key
 */
function drawIcon(size, round) {
  const S = size / 48;
  const img = Buffer.alloc(size * size * 4);

  const bgTop = hex('#333a58'), bgBottom = hex('#14181f');
  const bodyC = hex('#f4f6fb');
  const dispC = hex('#1b2030');
  const barC = hex('#7ce38b');
  const btnNeutral = hex('#c9d1e4');
  const btnOp = hex('#a9b6d0');
  const btnEq = hex('#ff8a3d');

  // button grid geometry (design space)
  const gx = 11, gy = 20, gw = 26, gh = 18, gap = 1.7;
  const cw = (gw - 2 * gap) / 3;
  const ch = (gh - 3 * gap) / 4;

  function shapeAt(px, py) {
    // returns [r,g,b] in design space coordinates
    // background gradient
    let t = Math.min(1, Math.max(0, py / 48));
    let col = [
      Math.round(lerp(bgTop[0], bgBottom[0], t)),
      Math.round(lerp(bgTop[1], bgBottom[1], t)),
      Math.round(lerp(bgTop[2], bgBottom[2], t))
    ];
    // body
    if (inRoundRect(px, py, 8, 7, 32, 34, 5)) col = bodyC;
    // display
    if (inRoundRect(px, py, 11, 10, 26, 8, 2)) col = dispC;
    // digit bars inside display
    if (inRoundRect(px, py, 21.5, 12.1, 13, 1.5, 0.75)) col = barC;
    if (inRoundRect(px, py, 21.5, 14.6, 13, 1.5, 0.75)) col = barC;
    // buttons: 3 columns x 4 rows
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const bx = gx + c * (cw + gap);
        const by = gy + r * (ch + gap);
        if (inRoundRect(px, py, bx, by, cw, ch, 1)) {
          if (r === 3 && c === 2) col = btnEq;       // equals
          else if (c === 2) col = btnOp;             // operator column
          else col = btnNeutral;
        }
      }
    }
    return col;
  }

  const SS = 3; // 3x3 supersampling for smooth edges
  const R = 23.4; // round-mask radius
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dpx = (x + (sx + 0.5) / SS) / S;
          const dpy = (y + (sy + 0.5) / SS) / S;
          if (round) {
            const dx = dpx - 24, dy = dpy - 24;
            if (dx * dx + dy * dy > R * R) continue;
          }
          const c = shapeAt(dpx, dpy);
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      img[i] = a ? Math.round(r / a) : 0;
      img[i + 1] = a ? Math.round(g / a) : 0;
      img[i + 2] = a ? Math.round(b / a) : 0;
      img[i + 3] = Math.round((a / n) * 255);
    }
  }
  return img;
}

/* ---------------- Main ---------------- */

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const outRoot = path.join(__dirname, '..', 'res');

for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = path.join(outRoot, `mipmap-${density}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), encodePNG(size, size, drawIcon(size, false)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), encodePNG(size, size, drawIcon(size, true)));
  console.log(`mipmap-${density}: ${size}x${size} OK`);
}
console.log('Icons generated.');
