/**
 * Generate Tauri app icons from a source sprite.
 *
 * Uses sharp (already in the project) to produce the PNG sizes Tauri needs,
 * plus a hand-rolled ICO encoder for Windows. macOS .icns is optional and
 * skipped here — Windows is the primary target for keepAlive.ps1.
 *
 * Run: bun run gen:icons
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "public", "pets", "animal-cat.png");
const OUT = path.join(__dirname, "..", "build");

const SIZES = [
  ["icon.png", 256],          // tray + electron-builder default
  ["icon.ico", 256],          // Windows installer/taskbar
  ["icon-16.png", 16],
  ["icon-32.png", 32],
  ["icon-48.png", 48],
  ["icon-128.png", 128],
];

// PNG-in-ICO encoder (Vista+). One 256 entry is enough for modern Windows.
function encodeIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count = 1
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bitcount
  entry.writeUInt32LE(pngBuf.length, 8); // bytes
  entry.writeUInt32LE(6 + 16, 12); // offset = header + entry
  return Buffer.concat([header, entry, pngBuf]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, size] of SIZES) {
    if (name.endsWith(".ico")) {
      const png256 = await sharp(SRC)
        .resize(size, size, { kernel: "nearest" })
        .png()
        .toBuffer();
      const ico = encodeIco(png256, size);
      fs.writeFileSync(path.join(OUT, name), ico);
      console.log("✓", name, size + "x" + size);
    } else {
      await sharp(SRC)
        .resize(size, size, { kernel: "nearest" })
        .png()
        .toFile(path.join(OUT, name));
      console.log("✓", name, size + "x" + size);
    }
  }
  console.log("\nDone. Icons in", path.relative(process.cwd(), OUT));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
