cmake_minimum_required(VERSION 3.24)

project(RawElectronEngine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(RAWELECTRON_BUILD_TESTS "Build engine tests" ON)

find_package(OpenCV REQUIRED CONFIG
  PATHS "${CMAKE_SOURCE_DIR}/third_party/opencv/install"
  NO_DEFAULT_PATH
  COMPONENTS core imgcodecs imgproc
)

add_subdirectory(engine)

if(RAWELECTRON_BUILD_TESTS)
  enable_testing()
  add_subdirectory(test)
endif()
