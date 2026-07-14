cmake_minimum_required(VERSION 3.24)

project(RawElectronEngine VERSION 0.1.0 LANGUAGES C CXX)

include("${CMAKE_SOURCE_DIR}/third_party/ThirdPartyVersions.cmake")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(RAWELECTRON_BUILD_TESTS "Build engine tests" ON)
option(RAWELECTRON_ENABLE_AVIF "Build AVIF decoding with vendored libavif and dav1d" ON)

find_package(OpenCV REQUIRED CONFIG
  PATHS "${CMAKE_SOURCE_DIR}/third_party/opencv/install"
  NO_DEFAULT_PATH
  COMPONENTS core imgcodecs imgproc
)

add_subdirectory(third_party)
add_subdirectory(engine)

if(RAWELECTRON_BUILD_TESTS)
  enable_testing()
  add_subdirectory(test)
endif()
