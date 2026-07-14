# macOS Build Verification

Version: 0.1

Target: Apple Silicon (`arm64`) and Intel Mac (`x86_64`)

## 1. Purpose

This checklist verifies that a clean macOS checkout can build RawElectron and
all vendored native image dependencies without consuming Windows/MSVC build
artifacts. Run it once per supported Mac architecture and attach the generated
logs when reporting a failure.

## 2. Required environment

Install Xcode Command Line Tools and verify the common build tools:

```bash
xcode-select --install
python3 --version
cmake --version
ninja --version
node --version
npm --version
clang --version
uname -m
sw_vers
```

Expected:

- `uname -m` is `arm64` on Apple Silicon or `x86_64` on an Intel Mac.
- `xcode-select -p` prints a valid developer directory.
- Python 3, CMake, Ninja, Node.js/npm and Apple Clang are available.
- The build is run in a native terminal. Do not run the `arm64` test under
  Rosetta; `arch` and `uname -m` must agree.

Install the pinned Python build dependency:

```bash
python3 -m pip install -r requirements-build.txt
python3 -m mesonbuild.mesonmain --version
```

Expected Meson version: `1.7.2`.

## 3. Repository integrity

From the repository root:

```bash
git status --short
test -f third_party/opencv/CMakeLists.txt
test -f third_party/libavif/CMakeLists.txt
test -f third_party/dav1d/meson.build
test -f third_party/nasm/CMakeLists.txt
```

Expected:

- The checkout has no unexpected local changes.
- All four commands exit successfully.
- No Windows build output was copied to a macOS install prefix.

## 4. Clean complete build

For the strongest verification, start with no local build output:

```bash
rm -rf build/engine build/tools \
  third_party/opencv/build/macos-* \
  third_party/opencv/install/macos-* \
  apps/electron/native/build \
  apps/electron/out

set -o pipefail
python3 build.py 2>&1 | tee macos-build.log
```

Expected:

- The command exits with status `0`.
- OpenCV is configured, compiled and installed from `third_party/opencv`.
- The engine and Electron native addon compile with Apple Clang.
- dav1d and libavif compile and link successfully.
- Electron Forge creates a macOS ZIP under `apps/electron/out/make`.
- No `cl.exe`, `nmake.exe`, `.lib` or `.dll` is referenced in
  `macos-build.log`.

## 5. Architecture-specific checks

Determine the expected OpenCV prefix:

```bash
if [ "$(uname -m)" = "arm64" ]; then
  export RE_OPENCV_PREFIX="$PWD/third_party/opencv/install/macos-arm64"
else
  export RE_OPENCV_PREFIX="$PWD/third_party/opencv/install/macos-x64"
fi
echo "$RE_OPENCV_PREFIX"
```

### 5.1 Apple Silicon

```bash
grep -E "Host machine cpu|enable_asm|Program nasm" macos-build.log
find build/engine/_deps/dav1d-build -type f \
  \( -name '*.S.o' -o -name '*arm*.o' -o -name '*neon*.o' \) | head
```

Expected:

- Host CPU is ARM64/AArch64.
- `enable_asm` is `true`.
- NASM is not required; dav1d uses its ARM assembly path.
- At least one ARM assembly object is present in the dav1d build tree.

### 5.2 Intel Mac

```bash
find build/tools/nasm -type f -perm -111 -name nasm -print
"$(find build/tools/nasm -type f -perm -111 -name nasm | head -n 1)" -v
grep -E "Program nasm found: YES|enable_asm" macos-build.log
```

Expected:

- Vendored NASM reports version `3.01`.
- Meson reports `Program nasm found: YES`.
- dav1d reports `enable_asm: true` and generates x86 SIMD objects.

## 6. Native binary and OpenCV linkage

```bash
ADDON="apps/electron/native/build/Release/rawelectron_engine.node"
test -f "$ADDON"
file "$ADDON"
lipo -info "$ADDON"
otool -L "$ADDON"

find "$RE_OPENCV_PREFIX" -type f -name 'libopencv_*.dylib' -print
find "$RE_OPENCV_PREFIX" -type f -name 'libopencv_*.dylib' \
  -exec file {} \;
otool -l "$ADDON" | grep -A2 LC_RPATH
```

Expected:

- The addon architecture matches `uname -m`.
- OpenCV dylibs have the same architecture.
- `otool -L` lists OpenCV core, imgcodecs and imgproc without Windows paths.
- The addon contains `@loader_path` or
  `@executable_path/../Resources` as an `LC_RPATH` entry.
- There are no references to `D:\\`, `.dll`, `.lib`, Homebrew OpenCV or another
  machine-specific path.

## 7. Native engine smoke tests

```bash
cd apps/electron
npm run test:shared-bitmap
npm run test:engine-handle
npm run test:engine-worker
cd ../..
```

Expected:

- All commands exit with status `0`.
- Shared bitmap output reports `zeroCopy: true`.
- Engine information reports `cpp-opencv`, not the pass-through/stub engine.
- Image open, original preview and exported-image reopen all succeed.

## 8. Real image preview regression

Copy a representative JPEG or RAW file to the Mac, then run:

```bash
cd apps/electron
npm run test:preview-file -- "/absolute/path/to/test-image.jpg" 1200 800
cd ../..
```

Expected JSON stages:

- `open`: positive width and height
- `proxy`: `nonZero: true`
- `preview-file`: positive byte count and PNG signature `89504e470d0a1a0a`
- `original`: `nonZero: true` and completion before the 120-second timeout

Then launch the unpacked application:

```bash
APP_PATH="$(find apps/electron/out -type d -name 'rawelectron.app' | head -n 1)"
open "$APP_PATH"
```

In the UI verify:

- The selected image appears instead of remaining at “generating”.
- Proxy preview appears during slider manipulation.
- Each edit tab has Cancel/Confirm behavior.
- Confirm applies a full-quality render; Cancel restores the previous state.
- Repeated slider movement does not terminate the worker or blank the image.
- Closing and reopening the image releases the old image handle.

## 9. Packaged application verification

```bash
find apps/electron/out/make -type f -print
APP_PATH="$(find apps/electron/out -type d -name 'rawelectron.app' | head -n 1)"
find "$APP_PATH/Contents/Resources" \
  \( -name 'rawelectron_engine.node' -o -name 'libopencv_*.dylib' \) -print
codesign --verify --deep --strict "$APP_PATH"
```

Expected:

- The Resources directory contains the native addon and required OpenCV
  dylibs.
- The packaged app launches without a missing-library error.
- `codesign --verify` succeeds for the local ad-hoc/development package.
- Gatekeeper notarization is not part of this local build test.

## 10. Failure diagnostics

When a step fails, collect:

```bash
git rev-parse HEAD > macos-verification-info.txt
uname -a >> macos-verification-info.txt
sw_vers >> macos-verification-info.txt
xcode-select -p >> macos-verification-info.txt
clang --version >> macos-verification-info.txt
cmake --version >> macos-verification-info.txt
ninja --version >> macos-verification-info.txt
python3 --version >> macos-verification-info.txt
node --version >> macos-verification-info.txt
npm --version >> macos-verification-info.txt

find build/engine -path '*meson-logs/meson-log.txt' -print \
  -exec cp {} ./dav1d-meson-log.txt \;
```

Attach these files:

- `macos-build.log`
- `macos-verification-info.txt`
- `dav1d-meson-log.txt`, if created
- The failing command and its complete terminal output
- Mac model, CPU architecture and macOS version

## 11. Acceptance checklist

- [ ] Clean `python3 build.py` succeeds.
- [ ] OpenCV is built under the correct macOS-specific prefix.
- [ ] dav1d assembly is enabled for the current CPU.
- [ ] Native addon and OpenCV architectures match.
- [ ] No MSVC/Windows artifact is linked or packaged.
- [ ] Native engine smoke tests pass.
- [ ] Proxy and original previews contain non-zero pixels.
- [ ] The UI no longer stalls at preview generation.
- [ ] Slider, Cancel and Confirm behavior is correct.
- [ ] The packaged `.app` contains and loads its native dependencies.
- [ ] The generated macOS ZIP opens on the same architecture.
