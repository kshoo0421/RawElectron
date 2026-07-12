const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const sourceDir = path.join(workspaceRoot, 'third_party', 'opencv');
const buildDir = path.join(sourceDir, 'build');
const installDir = path.join(sourceDir, 'install');

const vcvarsCandidates = [
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat',
];

function quote(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function findVcvars() {
  const configuredPath = process.env.RAWELECTRON_VCVARS64;

  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const foundPath = vcvarsCandidates.find((candidate) => fs.existsSync(candidate));

  if (!foundPath) {
    throw new Error('Could not find Visual Studio vcvars64.bat. Set RAWELECTRON_VCVARS64 to the full path.');
  }

  return foundPath;
}

function runInVsEnv(commands) {
  const vcvars = findVcvars();
  const scriptPath = path.join(buildDir, 'run-build-opencv.cmd');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(
    scriptPath,
    [
      '@echo off',
      `call ${quote(vcvars)}`,
      'if errorlevel 1 exit /b %errorlevel%',
      ...commands.flatMap((command) => [command, 'if errorlevel 1 exit /b %errorlevel%']),
      '',
    ].join('\r\n'),
  );

  const result = spawnSync('cmd.exe', ['/d', '/c', scriptPath], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(path.join(sourceDir, 'CMakeLists.txt'))) {
  throw new Error(`OpenCV source was not found at ${sourceDir}`);
}

runInVsEnv([
  [
    'cmake',
    '--fresh',
    '-S',
    quote(sourceDir),
    '-B',
    quote(buildDir),
    '-G',
    quote('Visual Studio 17 2022'),
    '-A',
    'x64',
    '-T',
    'v143',
    `-DCMAKE_INSTALL_PREFIX=${quote(installDir)}`,
    '-DBUILD_LIST=core,imgcodecs,imgproc',
    '-DBUILD_SHARED_LIBS=ON',
    '-DBUILD_TESTS=OFF',
    '-DBUILD_PERF_TESTS=OFF',
    '-DBUILD_EXAMPLES=OFF',
    '-DBUILD_DOCS=OFF',
    '-DBUILD_opencv_apps=OFF',
    '-DBUILD_JAVA=OFF',
    '-DBUILD_opencv_gapi=OFF',
    '-DBUILD_opencv_python_bindings_generator=OFF',
    '-DOPENCV_PYTHON_SKIP_DETECTION=ON',
    '-DWITH_FFMPEG=OFF',
    '-DWITH_IPP=OFF',
  ].join(' '),
  `cmake --build ${quote(buildDir)} --config Release --target INSTALL`,
]);
