# RawElectron Native Build

This folder contains the native build configuration and build output.
The editable C++ engine source lives under:

```text
apps/electron/src/native-engine
```

## Build

```powershell
cd D:\RawElectron\app
npm.cmd run build:native
```

The build output is:

```text
apps/electron/native/build/Release/rawelectron_engine.node
```

## Optional OpenCV Processing

The native engine builds without OpenCV by default and passes images through.
If OpenCV is available, `npm.cmd run build:native` enables it automatically and
uses C++ for preview/export processing.

For vendored project-local libraries, put OpenCV under:

```text
third_party/opencv
```

The build script also checks:

```text
third_party/opencv/build
third_party/opencv/install
```

On Windows, you can also point one of these environment variables at the OpenCV
root or build folder:

```powershell
$env:RAWELECTRON_OPENCV_DIR = "C:\opencv\build"
# or
$env:OPENCV_DIR = "C:\opencv\build\x64\vc16"
```

The OpenCV root must contain:

- `include/opencv2/opencv.hpp`
- `opencv_world*.lib`, or `opencv_core*.lib`, `opencv_imgcodecs*.lib`, and
  `opencv_imgproc*.lib`

At runtime, the matching OpenCV DLL folder also needs to be on `PATH`, for
example:

```powershell
$env:PATH = "C:\opencv\build\x64\vc16\bin;$env:PATH"
```

## Runtime Flow

```text
React UI
-> preload
-> main process
-> EngineWorker
-> apps/electron/src/native-engine/addon.cpp
-> rawelectron_engine.node
```

`EngineWorker` automatically uses the native addon when the `.node` file exists.
If the addon is missing, it falls back to the TypeScript stub.

## C++ Entry Points

- `renderPreview(request)`
- `exportRenderedImage(request)`

Both receive the same request shape used by `apps/electron/src/shared/engineTypes.ts`.

With OpenCV enabled, preview rendering decodes the source image, applies a small
set of edit parameters, resizes for preview, and returns a PNG buffer to the UI.
Export rendering runs the same C++ edit path and writes to `outputPath`.

This is the extension point for adding format-specific decoders such as LibRaw:
decode RAW files into an OpenCV `cv::Mat`, then pass that matrix into the same
processing/export path.
