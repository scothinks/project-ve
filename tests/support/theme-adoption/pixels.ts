import { createRequire } from 'node:module';
import path from 'node:path';

const dependencyRequire = createRequire(path.join(process.cwd(), 'package.json'));
// Reuse the PNG decoder shipped with the pinned Playwright dependency.
const { PNG } = dependencyRequire(path.join(path.dirname(dependencyRequire.resolve('playwright-core')), 'lib/utilsBundle.js'));
type RgbaImage = { width: number; height: number; data: Uint8Array };
export const decodePng = (bytes: Buffer): RgbaImage => PNG.sync.read(bytes);

function onEdge(image: RgbaImage, x: number, y: number) {
  const at = (y * image.width + x) * 4;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (x + dx < 0 || y + dy < 0 || x + dx >= image.width || y + dy >= image.height) continue;
    const other = ((y + dy) * image.width + x + dx) * 4;
    if ([0, 1, 2].some(c => Math.abs(image.data[at + c] - image.data[other + c]) > 16)) return true;
  }
  return false;
}

export function compareThemePixels(before: RgbaImage, after: RgbaImage) {
  if (before.width !== after.width || before.height !== after.height) return { passed: false, reason: 'Image dimensions changed' };
  let differentPixels = 0, antialiasPixels = 0, disallowedPixels = 0, maxChannelDelta = 0;
  for (let y = 0; y < before.height; y++) for (let x = 0; x < before.width; x++) {
    const at = (y * before.width + x) * 4;
    const delta = Math.max(...[0, 1, 2, 3].map(c => Math.abs(before.data[at + c] - after.data[at + c])));
    if (!delta) continue;
    differentPixels++; maxChannelDelta = Math.max(maxChannelDelta, delta);
    if (delta <= 2 && before.data[at + 3] === after.data[at + 3] && onEdge(before, x, y) && onEdge(after, x, y)) antialiasPixels++;
    else disallowedPixels++;
  }
  const maximumAntialiasPixels = Math.max(1, Math.floor(before.width * before.height * 0.0005));
  return { passed: disallowedPixels === 0 && antialiasPixels <= maximumAntialiasPixels, differentPixels, antialiasPixels, disallowedPixels, maxChannelDelta, maximumAntialiasPixels };
}
