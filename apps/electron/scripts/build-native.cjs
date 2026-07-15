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

function buildLibRaw() {
  if (process.platform !== 'win32') return;
  const project = path.resolve(projectRoot, '..', '..', 'third_party', 'libraw', 'buildfiles', 'libraw.vcxproj');
  if (!fs.existsSync(project)) return;
  const env = {};
  let combinedPath = '';
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase() === 'path') combinedPath = [combinedPath, value].filter(Boolean).join(';');
    else env[key] = value;
  }
  env.Path = combinedPath;
  run(readConfiguredMsBuildPath(), [
    project,
    '/t:Build',
    '/nologo',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/p:PlatformToolset=v143',
    '/p:WindowsTargetPlatformVersion=10.0',
  ], { shell: false, env });
}

function normalizedWindowsEnv() {
  const env = {};
  let combinedPath = '';
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase() === 'path') combinedPath = [combinedPath, value].filter(Boolean).join(';');
    else env[key] = value;
  }
  env.Path = combinedPath;
  return env;
}

function buildJxr() {
  if (process.platform !== 'win32') return;
  const root = path.resolve(projectRoot, '..', '..', 'third_party', 'jxrlib');
  const projects = [
    path.join(root, 'image', 'vc12projects', 'CommonLib_vc12.vcxproj'),
    path.join(root, 'image', 'vc12projects', 'DecodeLib_vc12.vcxproj'),
    path.join(root, 'image', 'vc12projects', 'EncodeLib_vc12.vcxproj'),
    path.join(root, 'jxrgluelib', 'JXRGlueLib_vc12.vcxproj'),
  ];
  if (!projects.every((project) => fs.existsSync(project))) return;
  for (const project of projects) {
    run(readConfiguredMsBuildPath(), [
      project,
      '/t:Build',
      '/nologo',
      '/p:Configuration=Release',
      '/p:Platform=x64',
      '/p:PlatformToolset=v143',
      '/p:WindowsTargetPlatformVersion=10.0',
    ], { shell: false, env: normalizedWindowsEnv() });
  }
}

function buildAvif() {
  if (process.platform !== 'win32') return;
  const workspaceRoot = path.resolve(projectRoot, '..', '..');
  const source = path.join(workspaceRoot, 'third_party', 'libavif');
  const dav1d = path.join(workspaceRoot, 'third_party', 'dav1d');
  const build = path.join(source, 'build-windows-x64');
  if (!fs.existsSync(path.join(source, 'CMakeLists.txt')) || !fs.existsSync(path.join(dav1d, 'meson.build'))) return;
  run(path.join(projectRoot, 'scripts', 'build-avif.cmd'), [source, build, dav1d], {
    shell: true,
    env: normalizedWindowsEnv(),
  });
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

function copyOpenCvRuntimeLibraries() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return;
  }

  const opencvRoot = path.resolve(projectRoot, '..', '..', 'third_party', 'opencv');
  const runtimeLibraries = findFiles(opencvRoot, (name) => {
    if (process.platform === 'win32') {
      return /^opencv_.*\.dll$/i.test(name);
    }
    return /^libopencv_.*\.dylib$/i.test(name);
  });

  if (!runtimeLibraries.length) {
    return;
  }

  const outputDir = path.join(nativeDir, 'build', 'Release');
  fs.mkdirSync(outputDir, { recursive: true });

  for (const library of runtimeLibraries) {
    fs.copyFileSync(library, path.join(outputDir, path.basename(library)));
  }
  const librawDll = path.resolve(projectRoot, '..', '..', 'third_party', 'libraw', 'buildfiles', 'release-x86_64', 'libraw.dll');
  if (process.platform === 'win32' && fs.existsSync(librawDll)) {
    fs.copyFileSync(librawDll, path.join(outputDir, 'libraw.dll'));
  }
}

if (process.platform !== 'win32') {
  run(process.execPath, [writeOpenCvGypi]);
  nodeGyp(['rebuild']);
  copyOpenCvRuntimeLibraries();
  process.exit(0);
}

// On this Windows setup node-gyp selects ClangCL from the Node header config,
// while only the normal MSVC v143 toolset is installed. Keep node-gyp's normal
// project generation, then ask MSBuild to use the installed MSVC toolset.
run(process.execPath, [writeOpenCvGypi]);
nodeGyp(['configure']);
buildLibRaw();
buildJxr();
buildAvif();
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
copyOpenCvRuntimeLibraries();
