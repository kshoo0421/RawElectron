# Vendored Third-Party Libraries

Put third-party library source trees, local builds, or install prefixes here.
This folder is for code that comes from outside the app, such as OpenCV or
LibRaw.

## Pinned source versions

| Directory | Version | Intended module | Notes |
|---|---:|---|---|
| `opencv` | existing project build | Processing / Renderer | Currently integrated |
| `libraw` | 0.22.1 | Codec | RAW decode |
| `exiv2` | 0.28.8 | Codec | EXIF/IPTC/XMP metadata |
| `lcms2` | 2.19.1 | Color management | ICC transforms |
| `libjpeg-turbo` | 3.1.4.1 | Codec | Direct JPEG path |
| `libpng` | 1.6.54 | Codec | Direct PNG path |
| `libtiff` | 4.7.1 | Codec | TIFF decode/export |
| `libavif` | 1.4.2 | Codec | AVIF container and API |
| `dav1d` | 1.5.3 | Codec | AVIF decode backend selected for libavif |
| `nasm` | 3.01 | Build tool | Builds dav1d x86/x64 SIMD assembly |
| `jxrlib` | 2019.10.9 | Codec | Legacy build system requires an adapter |

`ThirdPartyVersions.cmake` publishes a stable `RAWELECTRON_*_ROOT` cache path
for each source tree. AVIF decoding is wired into `rawelectron_codec` with
libavif and dav1d; upstream applications and tests are disabled. dav1d is a
decoder only, so AVIF export will require a separate encoder later.

The native build compiles the vendored NASM source with MSVC/NMAKE before
configuring dav1d. Meson then detects that executable and enables dav1d's
x86/x64 assembly optimizations. Meson itself is pinned in
`requirements-build.txt`; install it once with:

```powershell
python -m pip install -r requirements-build.txt
```

On macOS, `build.py` builds a native OpenCV installation under
`third_party/opencv/install/macos-arm64` or `macos-x64`. Intel Macs also build
the vendored NASM with CMake; Apple Silicon uses dav1d's ARM assembly directly
and does not require NASM. The Electron addon is rebuilt with Apple Clang, and
OpenCV dylibs are copied into the packaged app Resources directory with an
`@loader_path` runtime search path. Windows `.lib`, `.dll`, `.obj` and MSVC
settings are never consumed by the macOS build.

Platform prerequisites are intentionally limited to the native developer
toolchain: Xcode Command Line Tools on macOS, plus Python 3, CMake, Ninja,
Node.js/npm and the pinned Meson package. All image-library sources themselves
are vendored in this repository.

Set `RAWELECTRON_ENABLE_AVIF=OFF` only when intentionally building without
AVIF. Third-party headers remain private implementation details of their
owning modules.

For AVIF export, libaom is the default planned encoder because libavif supports
it directly for both encoding and decoding and it offers mature still-image
quality controls. rav1e is a reasonable quality-focused alternative but adds a
Rust toolchain, while SVT-AV1 is primarily attractive for high-throughput AV1
video workloads. dav1d remains the dedicated decode path.

The Windows build intentionally combines MSVC-compiled C/C++ with NASM output.
NASM emits Win64 COFF objects, so these can be linked into the same static
dav1d library. Keep architecture, MSVC runtime (`/MD` versus `/MT`), build
configuration and linker settings consistent across dependencies; do not mix
MinGW runtime libraries into this MSVC build.

Recommended layout:

```text
lib.third/
  opencv/
    source files or OpenCV install/build output
  libraw/
    source files or LibRaw install/build output
```

The app's editable engine code stays in:

```text
app/src/native-engine
```

Native build output stays in:

```text
app/native/build
```

For OpenCV, `npm.cmd run build:native` checks these paths automatically:

```text
lib.third/opencv
lib.third/opencv/build
lib.third/opencv/install
```

The OpenCV folder must eventually contain `include/opencv2/opencv.hpp` and the
matching compiled libraries such as `opencv_world*.lib`, or `opencv_core*.lib`,
`opencv_imgcodecs*.lib`, and `opencv_imgproc*.lib`.

To build the vendored OpenCV source on Windows:

```powershell
cd app
npm.cmd run build:opencv
npm.cmd run build:native
```

The Electron native loader prepends this OpenCV DLL folder to `PATH` when it
exists:

```text
lib.third/opencv/install/x64/vc17/bin
```
