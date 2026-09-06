const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

exports.default = async function (context) {
  // Only sign on Windows builds
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  console.log(`\n[after-pack] Starting Castlabs VMP signing for: ${appOutDir}`);

  const projectDir = context.packager.projectDir;
  const py = path.join(projectDir, '.venv', 'Scripts', 'python.exe');
  const pythonBin = fs.existsSync(py) ? py : 'python';

  const res = spawnSync(
    pythonBin,
    ['-m', 'castlabs_evs.vmp', 'sign-pkg', appOutDir],
    { stdio: 'inherit', cwd: projectDir }
  );

  if (res.status !== 0) {
    console.error(`[after-pack] Castlabs VMP signing failed with exit code ${res.status}`);
    throw new Error('Castlabs VMP signing failed');
  }

  console.log('[after-pack] Castlabs VMP signing completed successfully!\n');
};
