if(NOT RAWELECTRON_ENABLE_AVIF)
  return()
endif()

if(NOT EXISTS "${RAWELECTRON_LIBAVIF_ROOT}/CMakeLists.txt")
  message(FATAL_ERROR "Vendored libavif was not found: ${RAWELECTRON_LIBAVIF_ROOT}")
endif()
if(NOT EXISTS "${RAWELECTRON_DAV1D_ROOT}/meson.build")
  message(FATAL_ERROR "Vendored dav1d was not found: ${RAWELECTRON_DAV1D_ROOT}")
endif()

# libavif builds dav1d through Meson as an ExternalProject. Keep upstream tools,
# tests and shared libraries out of the desktop build.
find_program(MESON_EXECUTABLE meson REQUIRED)
set(BUILD_SHARED_LIBS OFF)
set(AVIF_CODEC_DAV1D LOCAL CACHE STRING "Use vendored dav1d for AVIF decoding" FORCE)
set(AVIF_LIBYUV OFF CACHE STRING "Disable optional libyuv conversion dependency" FORCE)
set(AVIF_ZLIBPNG OFF CACHE STRING "Disable optional PNG helper dependency" FORCE)
set(AVIF_JPEG OFF CACHE STRING "Disable optional JPEG helper dependency" FORCE)
set(AVIF_BUILD_APPS OFF CACHE BOOL "Build libavif command-line tools" FORCE)
set(AVIF_BUILD_TESTS OFF CACHE BOOL "Build libavif tests" FORCE)
set(AVIF_ENABLE_WERROR OFF CACHE BOOL "Treat libavif warnings as errors" FORCE)

add_subdirectory("${RAWELECTRON_LIBAVIF_ROOT}" libavif EXCLUDE_FROM_ALL)
