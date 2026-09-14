// 依存なしで PWA 用の PNG アイコンを生成する（npm run icons）
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [15, 143, 134];
const FG = [255, 255, 255];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// 0..1 座標のポリライン（右肩下がりの折れ線）
const LINE = [
  [0.22, 0.36],
  [0.4, 0.5],
  [0.54, 0.44],
  [0.78, 0.66],
];
const distToSeg = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const SS = 4;
  const half = 0.045;
  const dotR = 0.075;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          let d = Infinity;
          for (let i = 0; i < LINE.length - 1; i++) d = Math.min(d, distToSeg(px, py, LINE[i], LINE[i + 1]));
          const end = LINE[LINE.length - 1];
          if (d <= half || Math.hypot(px - end[0], py - end[1]) <= dotR) cover++;
        }
      }
      const a = cover / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, render(size));
}

const pts = LINE.map(([x, y]) => `${x * 512},${y * 512}`).join(' ');
const [ex, ey] = LINE[LINE.length - 1];
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="rgb(${BG.join(',')})"/><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${ex * 512}" cy="${ey * 512}" r="38" fill="#fff"/></svg>\n`,
);
console.log('icons generated');
