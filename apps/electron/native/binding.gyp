{
  "includes": ["opencv.gypi"],
  "targets": [
    {
      "target_name": "rawelectron_engine",
      "sources": [
        "../src/native-engine/addon.cpp",
        "../../../engine/Engine/src/module_anchor.cpp",
        "../../../engine/IPC/src/module_anchor.cpp"
      ],
      "include_dirs": [
        "../../../engine/Interfaces/include",
        "../../../engine/ImageCore/include",
        "../../../engine/Engine/include",
        "../../../engine/IPC/include"
      ],
      "defines": ["NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++20"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/std:c++20", "/EHsc"]
        }
      }
    }
  ]
}
