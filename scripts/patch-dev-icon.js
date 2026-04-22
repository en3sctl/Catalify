#!/usr/bin/env node
/**
 * Dev-only: patches node_modules/electron/dist/electron.exe so that Windows
 * shows the cat icon in the taskbar / window chrome while running `npm run
 * dev`. Without this the taskbar shows Electron's default icon because
 * Windows reads the icon from the .exe's PE resource table — not from
 * `mainWindow.setIcon()`, which only updates the Alt+Tab switcher.
 *
 * WARNING: rcedit rewrites the PE's resource section, which invalidates
 * the Castlabs VMP signature we applied earlier. So this script also
 * re-invokes `castlabs-evs vmp sign-pkg` afterwards so Apple's DRM server
 * still accepts the binary (otherwise playback fails with errorCode
 * 190601). Needs the `.venv` created earlier (where castlabs-evs was
 * installed).
 *
 * Re-run after every `npm install` — npm reinstalls electron from
 * scratch, wiping both the icon patch and the VMP signature.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const ICO = path.join(ROOT, 'assets', 'cat-icon.ico');
const PY = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');

if (process.platform !== 'win32') {
  console.log('[patch-dev-icon] skipping — not Windows');
  process.exit(0);
}
if (!fs.existsSync(EXE)) {
  console.error(`[patch-dev-icon] electron.exe missing at ${EXE}`);
  process.exit(1);
}
if (!fs.existsSync(ICO)) {
  console.error(`[patch-dev-icon] icon missing at ${ICO} — run \`npm run prepare-icons\` first`);
  process.exit(1);
}

async function run() {
  console.log(`[patch-dev-icon] patching ${path.relative(ROOT, EXE)}`);
  const { rcedit } = require('rcedit');
  await rcedit(EXE, {
    icon: ICO,
    'version-string': {
      ProductName: 'Çatalify',
      FileDescription: 'Çatalify',
      CompanyName: 'Enes',
      LegalCopyright: '',
    },
  });
  console.log('[patch-dev-icon] rcedit done — VMP signature now invalid');

  if (!fs.existsSync(PY)) {
    console.warn(
      '[patch-dev-icon] .venv python not found; SKIPPING VMP re-sign.\n' +
      '  Playback will fail with errorCode 190601 until you run:\n' +
      '  python -m castlabs_evs.vmp sign-pkg node_modules/electron/dist'
    );
    return;
  }

  console.log('[patch-dev-icon] re-signing with castlabs-evs…');
  await new Promise((resolve, reject) => {
    const child = spawn(
      PY,
      ['-m', 'castlabs_evs.vmp', 'sign-pkg', ELECTRON_DIST],
      { stdio: 'inherit', cwd: ROOT },
    );
    child.on('exit', (code) =>
      code === 0 ? resolve(null) : reject(new Error(`vmp sign-pkg exited ${code}`)),
    );
    child.on('error', reject);
  });
  console.log('[patch-dev-icon] done — taskbar should now show the cat');
}

run().catch((err) => {
  console.error('[patch-dev-icon] failed:', err);
  process.exit(1);
});
