{
  "includes": ["opencv.gypi"],
  "targets": [
    {
      "target_name": "rawelectron_engine",
      "sources": [
        "../src/native-engine/addon.cpp",
        "../../../engine/Codec/codec.cpp",
        "../../../engine/Processing/processor.cpp",
        "../../../engine/Processing/pipeline.cpp",
        "../../../engine/Renderer/renderer.cpp",
        "../../../engine/Engine/engine_api.cpp",
        "../../../engine/IPC/engine_bridge.cpp"
      ],
      "include_dirs": [
        "../../../engine"
      ],
      "defines": ["NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++20"],
      "cflags_cc!": ["-fno-exceptions"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/std:c++20", "/EHsc"]
        }
      },
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "LD_RUNPATH_SEARCH_PATHS": ["@loader_path", "@executable_path/../Resources"]
      }
    }
  ]
}
