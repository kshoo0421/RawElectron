add_library(rawelectron_interfaces INTERFACE)
target_include_directories(rawelectron_interfaces INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})

function(rawelectron_module target source)
  add_library(${target} STATIC ${source})
  target_include_directories(${target} PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
  target_link_libraries(${target} PUBLIC rawelectron_interfaces)
endfunction()

rawelectron_module(rawelectron_image_core ImageCore/image_core.cpp)
rawelectron_module(rawelectron_codec Codec/codec.cpp)
rawelectron_module(rawelectron_processing Processing/processor.cpp)
rawelectron_module(rawelectron_renderer Renderer/renderer.cpp)
rawelectron_module(rawelectron_engine Engine/engine_api.cpp)
rawelectron_module(rawelectron_ipc IPC/engine_bridge.cpp)

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
