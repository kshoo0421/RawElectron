const { spawnSync } = require('node:child_process');
const path = require('node:path');

const command = process.argv[2];
if (!command) {
  console.error('Usage: node scripts/run-forge.cjs <forge-command>');
  process.exit(1);
}

const forgeBin = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-forge');
const preload = path.join(__dirname, 'packager-unzip-fallback.cjs');
const env = { ...process.env };

if (process.platform === 'darwin') {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${preload}`].filter(Boolean).join(' ');
}

const result = spawnSync(forgeBin, [command], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
