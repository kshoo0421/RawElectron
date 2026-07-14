{
  "includes": ["opencv.gypi"],
  "targets": [
    {
      "target_name": "rawelectron_engine",
      "sources": [
        "../src/native-engine/addon.cpp",
        "../../../engine/Codec/src/module_anchor.cpp",
        "../../../engine/Processing/src/module_anchor.cpp",
        "../../../engine/Renderer/src/module_anchor.cpp",
        "../../../engine/Engine/src/module_anchor.cpp",
        "../../../engine/IPC/src/module_anchor.cpp"
      ],
      "include_dirs": [
        "../../../engine/Interfaces/include",
        "../../../engine/ImageCore/include",
        "../../../engine/Codec/include",
        "../../../engine/Processing/include",
        "../../../engine/Renderer/include",
        "../../../engine/Engine/include",
        "../../../engine/IPC/include"
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
