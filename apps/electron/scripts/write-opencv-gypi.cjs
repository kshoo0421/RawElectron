const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const thirdPartyDir = path.join(workspaceRoot, 'third_party');
const nativeDir = path.resolve(__dirname, '..', 'native');
const outputPath = path.join(nativeDir, 'opencv.gypi');

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function exists(itemPath) {
  return itemPath && fs.existsSync(itemPath);
}

function walkForFiles(root, predicate, limit = 2000) {
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

function candidateRoots() {
  const installRoot = path.join(thirdPartyDir, 'opencv', 'install');
  const platformInstallRoot =
    process.platform === 'darwin'
      ? path.join(installRoot, `macos-${process.arch === 'x64' ? 'x64' : process.arch}`)
      : process.platform === 'linux'
        ? path.join(installRoot, `linux-${process.arch === 'x64' ? 'x64' : process.arch}`)
        : null;

  const envRoots = [
    process.env.RAWELECTRON_OPENCV_DIR,
    process.env.OpenCV_DIR,
    process.env.OPENCV_DIR,
  ];

  const vendoredRoots = [
    platformInstallRoot,
    path.join(thirdPartyDir, 'opencv'),
    path.join(thirdPartyDir, 'opencv', 'build'),
    installRoot,
  ];

  const commonRoots =
    process.platform === 'win32'
      ? ['C:\\opencv', 'C:\\tools\\opencv', 'C:\\dev\\opencv']
      : ['/usr', '/usr/local', '/opt/homebrew', '/opt/local'];

  return unique([...envRoots, ...vendoredRoots, ...commonRoots]).map((root) => path.resolve(root));
}

function findIncludeDir(root) {
  const candidates = [
    path.join(root, 'install', 'include'),
    path.join(root, 'install', 'include', 'opencv4'),
    path.join(root, 'build', 'install', 'include'),
    path.join(root, 'build', 'install', 'include', 'opencv4'),
    path.join(root, 'include'),
    path.join(root, 'include', 'opencv4'),
    path.join(root, '..', '..', 'include'),
    path.join(root, '..', '..', 'include', 'opencv4'),
    path.join(root, '..', 'include'),
    path.join(root, '..', 'include', 'opencv4'),
  ];

  return candidates.find((candidate) => exists(path.join(candidate, 'opencv2', 'opencv.hpp'))) ?? null;
}

function findWindowsLibs(root) {
  const libs = walkForFiles(
    root,
    (name) => /^opencv_world\d+\.lib$/i.test(name) || /^opencv_(core|imgcodecs|imgproc)\d+\.lib$/i.test(name),
  );
  const world = libs.find((lib) => /^opencv_world\d+\.lib$/i.test(path.basename(lib)));

  if (world) {
    return [world];
  }

  const requiredNames = ['core', 'imgcodecs', 'imgproc'];
  const selected = requiredNames
    .map((part) => libs.find((lib) => new RegExp(`^opencv_${part}\\d+\\.lib$`, 'i').test(path.basename(lib))))
    .filter(Boolean);

  return selected.length === requiredNames.length ? selected : [];
}

function findUnixLibs(root) {
  const candidates = [
    path.join(root, 'lib'),
    path.join(root, 'lib64'),
    path.join(root, 'lib', 'x86_64-linux-gnu'),
  ];
  const libDir = candidates.find((candidate) => exists(candidate));

  if (!libDir) {
    return null;
  }

  return {
    libDir,
    libs: ['-lopencv_core', '-lopencv_imgcodecs', '-lopencv_imgproc'],
  };
}

function writeGypi(config) {
  const librawRoot = path.join(thirdPartyDir, 'libraw');
  const librawLibrary = path.join(librawRoot, 'buildfiles', 'release-x86_64', 'libraw.lib');
  if (exists(librawLibrary)) {
    const defaults = config.target_defaults ?? (config.target_defaults = {});
    defaults.defines = unique([...(defaults.defines ?? []), 'RAWELECTRON_WITH_LIBRAW']);
    defaults.include_dirs = unique([...(defaults.include_dirs ?? []), librawRoot]);
    defaults.libraries = unique([...(defaults.libraries ?? []), librawLibrary]);
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
}

function main() {
  for (const root of candidateRoots()) {
    const includeDir = findIncludeDir(root);

    if (!includeDir) {
      continue;
    }

    if (process.platform === 'win32') {
      const libs = findWindowsLibs(root);

      if (!libs.length) {
        continue;
      }

      writeGypi({
        target_defaults: {
          defines: ['RAWELECTRON_WITH_OPENCV'],
          include_dirs: [includeDir],
          libraries: libs,
        },
      });
      console.log(`OpenCV enabled: ${root}`);
      return;
    }

    const unix = findUnixLibs(root);

    if (unix) {
      writeGypi({
        target_defaults: {
          defines: ['RAWELECTRON_WITH_OPENCV'],
          include_dirs: [includeDir],
          library_dirs: [unix.libDir],
          libraries: unix.libs,
        },
      });
      console.log(`OpenCV enabled: ${root}`);
      return;
    }
  }

  writeGypi({ target_defaults: {} });
  console.log('OpenCV not found; building native engine in pass-through mode.');
}

main();
