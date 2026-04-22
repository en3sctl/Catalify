#!/usr/bin/env node
/**
 * One-shot: convert assets/cat-blinking.png to a multi-resolution .ico file
 * that Windows and electron-builder (NSIS + app exe icon) can consume.
 *
 * PNG alone is insufficient on Windows — the OS caches a 0×0 image if the
 * PNG doesn't match the expected icon sizes, and NSIS outright refuses PNG
 * for the installer header. `png-to-ico` generates a proper ICO with the
 * standard resolution set (16/24/32/48/64/128/256) at once.
 */
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

const SRC = path.join(__dirname, '..', 'assets', 'cat-blinking.png');
const OUT = path.join(__dirname, '..', 'assets', 'cat-icon.ico');

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[icons] source PNG missing: ${SRC}`);
    process.exit(1);
  }
  const buf = await pngToIco(SRC);
  fs.writeFileSync(OUT, buf);
  console.log(`[icons] wrote ${OUT} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error('[icons] failed:', err);
  process.exit(1);
});
