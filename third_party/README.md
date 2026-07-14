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
| `libavif` | 1.4.2 | Codec | Requires AOM, dav1d, or another AV1 codec |
| `dav1d` | 1.5.3 | Codec | AVIF decode backend selected for libavif |
| `jxrlib` | 2019.10.9 | Codec | Legacy build system requires an adapter |

`ThirdPartyVersions.cmake` publishes a stable `RAWELECTRON_*_ROOT` cache path
for each source tree. AVIF decoding is wired into `rawelectron_codec` with
libavif and dav1d; upstream applications and tests are disabled. dav1d is a
decoder only, so AVIF export will require a separate encoder later.

The dav1d build requires Meson and Ninja. The repository pins the verified
Meson version in `requirements-build.txt`; install it once with:

```powershell
python -m pip install -r requirements-build.txt
```

NASM is optional. When it is absent, the build remains functional but dav1d
uses portable C code and AVIF decoding is slower. Set
`RAWELECTRON_ENABLE_AVIF=OFF` only when intentionally building without AVIF.

Third-party headers remain private implementation details of their owning
module: LibRaw/Exiv2 belong to `Codec`, OpenCV to `Processing`/`Renderer`, and
Little CMS to color management.

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
