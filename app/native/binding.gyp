{
  "includes": ["opencv.gypi"],
  "targets": [
    {
      "target_name": "rawelectron_engine",
      "sources": ["../src/native-engine/addon.cpp"],
      "defines": ["NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++17"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/std:c++17", "/EHsc"]
        }
      }
    }
  ]
}
