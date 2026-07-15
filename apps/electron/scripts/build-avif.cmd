@echo off
setlocal
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 || exit /b 1
cmake -S "%~1" -B "%~2" -G "Visual Studio 17 2022" -A x64 -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded -DBUILD_SHARED_LIBS=OFF -DAVIF_CODEC_DAV1D=LOCAL -DAVIF_LIBYUV=OFF -DRAWELECTRON_DAV1D_ROOT="%~3" -DAVIF_BUILD_APPS=OFF -DAVIF_BUILD_TESTS=OFF -DAVIF_ENABLE_WERROR=OFF || exit /b 1
cmake --build "%~2" --config Release --target avif || exit /b 1
