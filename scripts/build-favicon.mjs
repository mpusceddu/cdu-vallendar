// Usage: node scripts/build-favicon.mjs /absolute/path/to/sharp/dist/index.cjs
// Rebuild browser and iOS raster fallbacks from the code-native SVG master.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { default: sharp } = await import(process.argv[2] || 'sharp');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'assets/favicon.svg'));
const images = [];
for (const size of [16, 32, 48, 180]) {
  const png = await sharp(svg, { density: 288 }).resize(size, size).png().toBuffer();
  writeFileSync(resolve(root, size === 180 ? 'assets/apple-touch-icon.png' : `assets/favicon-${size}.png`), png);
  if (size !== 180) images.push({ size, png });
}
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, png }, i) => {
  const p = 6 + i * 16;
  header[p] = size; header[p + 1] = size;
  header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12);
  offset += png.length;
});
writeFileSync(resolve(root, 'favicon.ico'), Buffer.concat([header, ...images.map(x => x.png)]));
console.log('Built favicon.ico (16/32/48), PNG fallbacks and Apple touch icon.');
