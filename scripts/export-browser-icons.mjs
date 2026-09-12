// Manual export from the approved vector master; no design generation or build.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const master = readFileSync(new URL('../public/brand/aperture-a2.svg', import.meta.url), 'utf8');
const geometry = master.match(/\bd="([^"]+)"/)[1];
for (const size of [32, 180, 192, 512, 96]) {
  const badge = size === 96;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-24 -24 144 144">${badge ? '' : '<rect x="-24" y="-24" width="144" height="144" fill="#f6f3ed"/>'}<path fill="${badge ? '#ffffff' : '#583c63'}" d="${geometry}"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(new URL(`../public/brand/aperture-a2-${badge ? 'badge-' : ''}${size}.png`, import.meta.url).pathname);
}
