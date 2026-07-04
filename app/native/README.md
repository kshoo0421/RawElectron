# RawElectron Native Engine Example

This folder contains the first C++ connection point for the image engine.

## Build

```powershell
cd D:\RawElectron\app
npm.cmd run build:native
```

The build output is:

```text
app/native/build/Release/rawelectron_engine.node
```

## Runtime Flow

```text
React UI
-> preload
-> main process
-> EngineWorker
-> rawelectron_engine.node
```

`EngineWorker` automatically uses the native addon when the `.node` file exists.
If the addon is missing, it falls back to the TypeScript stub.

## C++ Entry Points

- `renderPreview(request)`
- `exportRenderedImage(request)`

Both receive the same request shape used by `app/src/shared/engineTypes.ts`.

The current C++ code reads `imagePath` and several `EditParams` values, then returns
the original image buffer. Replace that buffer path with the real RAW/JPEG decoding
and rendering pipeline when the engine is ready.
