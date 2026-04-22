#!/usr/bin/env node
/**
 * Wrapper that launches Electron with ELECTRON_RUN_AS_NODE *unset*.
 *
 * On this machine the user has `ELECTRON_RUN_AS_NODE=1` set at the shell /
 * system level. That flag tells the Electron binary to behave like a plain
 * Node.js — so `require('electron')` inside our main process returns the npm
 * wrapper's executable-path string instead of the real Electron API, and no
 * GUI window ever appears. Spawning Electron from a child process with that
 * variable removed fixes it without asking the user to touch their env.
 */
const { spawn } = require('child_process');
const path = require('path');

const electronBin = require('electron');
if (typeof electronBin !== 'string') {
  console.error('[run-electron] unexpected: require("electron") did not return a path');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// Default to development so main.js picks the dev URL.
if (!env.NODE_ENV) env.NODE_ENV = 'development';

const args = process.argv.slice(2);
if (args.length === 0) args.push('.');

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  env,
  cwd: path.resolve(__dirname, '..'),
  windowsHide: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[run-electron] spawn error:', err);
  process.exit(1);
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => child.kill(sig));
}
