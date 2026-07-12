const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const nativeDir = path.join(projectRoot, 'native');
const writeOpenCvGypi = path.join(projectRoot, 'scripts', 'write-opencv-gypi.cjs');
const nodeGypBin = path.join(
  projectRoot,
  'node_modules',
  '@electron',
  'node-gyp',
  'bin',
  'node-gyp.js',
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: options.shell ?? false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function nodeGyp(args) {
  run(process.execPath, [nodeGypBin, ...args, '--directory', nativeDir]);
}

function readConfiguredMsBuildPath() {
  const configPath = path.join(nativeDir, 'build', 'config.gypi');
  const config = fs.readFileSync(configPath, 'utf8');
  const match = config.match(/['"]msbuild_path['"]:\s*['"]([^'"]+)['"]/);

  if (!match) {
    throw new Error(`Could not find msbuild_path in ${configPath}`);
  }

  return match[1].replace(/\\\\/g, '\\');
}

function findFiles(root, predicate, limit = 2000) {
  const results = [];
  const queue = [root];
  let visited = 0;

  while (queue.length && visited < limit) {
    const current = queue.shift();
    visited += 1;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (predicate(entry.name, entryPath)) {
        results.push(entryPath);
      }
    }
  }

  return results;
}

function copyOpenCvRuntimeDlls() {
  if (process.platform !== 'win32') {
    return;
  }

  const opencvRoot = path.resolve(projectRoot, '..', '..', 'third_party', 'opencv');
  const dlls = findFiles(opencvRoot, (name) => /^opencv_.*\.dll$/i.test(name));

  if (!dlls.length) {
    return;
  }

  const outputDir = path.join(nativeDir, 'build', 'Release');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const dll of dlls) {
    fs.copyFileSync(dll, path.join(outputDir, path.basename(dll)));
  }
}

if (process.platform !== 'win32') {
  run(process.execPath, [writeOpenCvGypi]);
  nodeGyp(['rebuild']);
  process.exit(0);
}

// On this Windows setup node-gyp selects ClangCL from the Node header config,
// while only the normal MSVC v143 toolset is installed. Keep node-gyp's normal
// project generation, then ask MSBuild to use the installed MSVC toolset.
run(process.execPath, [writeOpenCvGypi]);
nodeGyp(['configure']);
run(
  readConfiguredMsBuildPath(),
  [
    path.join(nativeDir, 'build', 'binding.sln'),
    '/t:Rebuild',
    '/nologo',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/p:PlatformToolset=v143',
  ],
  { shell: false },
);
copyOpenCvRuntimeDlls();
