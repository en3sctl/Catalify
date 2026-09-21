const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

exports.default = async function (context) {
  // Must run in afterSign, NOT afterPack: electron-builder rcedits the exe
  // (icon / version info) after afterPack, which invalidates the VMP signature.
  // Only sign on Windows builds
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  console.log(`\n[after-sign] Starting Castlabs VMP signing for: ${appOutDir}`);

  const projectDir = context.packager.projectDir;
  const py = path.join(projectDir, '.venv', 'Scripts', 'python.exe');
  if (!fs.existsSync(py)) {
    throw new Error(`[after-sign] Required Python venv not found at: ${py}. Cannot sign VMP package.`);
  }

  // 1. Sign package
  const signRes = spawnSync(
    py,
    ['-m', 'castlabs_evs.vmp', 'sign-pkg', appOutDir],
    { stdio: 'inherit', cwd: projectDir }
  );

  if (signRes.status !== 0) {
    console.error(`[after-sign] Castlabs VMP signing failed with exit code ${signRes.status}`);
    throw new Error('Castlabs VMP signing failed');
  }

  // 2. Immediately verify signature so a broken build never gets packaged
  console.log(`[after-sign] Verifying VMP signature for: ${appOutDir}`);
  const verifyRes = spawnSync(
    py,
    ['-m', 'castlabs_evs.vmp', 'verify-pkg', appOutDir],
    { stdio: 'inherit', cwd: projectDir }
  );

  if (verifyRes.status !== 0) {
    console.error(`[after-sign] VMP verification failed! Build will not proceed.`);
    throw new Error('Castlabs VMP signature verification failed after signing');
  }

  console.log('[after-sign] Castlabs VMP signing & verification completed successfully!\n');
};
