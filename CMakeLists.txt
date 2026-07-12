cmake_minimum_required(VERSION 3.24)

project(RawElectronEngine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(RAWELECTRON_BUILD_TESTS "Build engine tests" ON)

add_subdirectory(engine)

if(RAWELECTRON_BUILD_TESTS)
  enable_testing()
  add_subdirectory(test)
endif()
