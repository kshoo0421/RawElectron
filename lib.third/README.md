# Vendored Third-Party Libraries

Put third-party library source trees, local builds, or install prefixes here.
This folder is for code that comes from outside the app, such as OpenCV or
LibRaw.

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
