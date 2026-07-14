add_library(rawelectron_interfaces INTERFACE)
target_include_directories(rawelectron_interfaces INTERFACE Interfaces/include)

function(rawelectron_module target directory)
  add_library(${target} STATIC ${directory}/src/module_anchor.cpp)
  target_include_directories(${target} PUBLIC ${directory}/include)
  target_link_libraries(${target} PUBLIC rawelectron_interfaces)
endfunction()

rawelectron_module(rawelectron_image_core ImageCore)
rawelectron_module(rawelectron_codec Codec)
rawelectron_module(rawelectron_processing Processing)
rawelectron_module(rawelectron_renderer Renderer)
rawelectron_module(rawelectron_engine Engine)
rawelectron_module(rawelectron_ipc IPC)

target_link_libraries(rawelectron_codec PUBLIC rawelectron_image_core)
target_link_libraries(rawelectron_codec PRIVATE opencv_core opencv_imgcodecs opencv_imgproc)
if(RAWELECTRON_ENABLE_AVIF)
  target_link_libraries(rawelectron_codec PRIVATE avif)
  target_compile_definitions(rawelectron_codec PRIVATE RAWELECTRON_WITH_AVIF=1)
endif()
target_link_libraries(rawelectron_processing PUBLIC rawelectron_image_core)
target_link_libraries(rawelectron_renderer PUBLIC rawelectron_image_core)
target_link_libraries(rawelectron_renderer PRIVATE opencv_core opencv_imgproc)
target_link_libraries(rawelectron_engine PUBLIC
  rawelectron_image_core
  rawelectron_codec
  rawelectron_processing
  rawelectron_renderer
)
target_link_libraries(rawelectron_ipc PUBLIC rawelectron_engine)
