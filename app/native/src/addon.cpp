#include <node_api.h>

#include <algorithm>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

void Check(napi_env env, napi_status status, const char* message) {
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, message);
  }
}

bool HasProperty(napi_env env, napi_value object, const char* name) {
  bool result = false;
  napi_status status = napi_has_named_property(env, object, name, &result);
  return status == napi_ok && result;
}

napi_value GetProperty(napi_env env, napi_value object, const char* name) {
  napi_value value;
  Check(env, napi_get_named_property(env, object, name, &value), "Failed to read object property");
  return value;
}

std::string GetStringProperty(napi_env env, napi_value object, const char* name) {
  napi_value value = GetProperty(env, object, name);
  size_t length = 0;
  Check(env, napi_get_value_string_utf8(env, value, nullptr, 0, &length), "Failed to measure string");

  std::string result(length, '\0');
  Check(
      env,
      napi_get_value_string_utf8(env, value, result.data(), result.size() + 1, &length),
      "Failed to read string");
  return result;
}

int32_t GetIntProperty(napi_env env, napi_value object, const char* name, int32_t fallback = 0) {
  if (!HasProperty(env, object, name)) {
    return fallback;
  }

  int32_t result = fallback;
  Check(env, napi_get_value_int32(env, GetProperty(env, object, name), &result), "Failed to read int");
  return result;
}

double GetDoubleProperty(napi_env env, napi_value object, const char* name, double fallback = 0.0) {
  if (!HasProperty(env, object, name)) {
    return fallback;
  }

  double result = fallback;
  Check(env, napi_get_value_double(env, GetProperty(env, object, name), &result), "Failed to read double");
  return result;
}

std::vector<char> ReadBinaryFile(const std::string& file_path) {
  std::ifstream stream(file_path, std::ios::binary);
  if (!stream) {
    throw std::runtime_error("Failed to open input image");
  }

  stream.seekg(0, std::ios::end);
  std::streamoff size = stream.tellg();
  stream.seekg(0, std::ios::beg);

  if (size < 0) {
    throw std::runtime_error("Failed to measure input image");
  }

  std::vector<char> buffer(static_cast<size_t>(size));
  stream.read(buffer.data(), size);
  return buffer;
}

void CopyBinaryFile(const std::string& source_path, const std::string& output_path) {
  std::ifstream source(source_path, std::ios::binary);
  if (!source) {
    throw std::runtime_error("Failed to open source image");
  }

  std::ofstream output(output_path, std::ios::binary);
  if (!output) {
    throw std::runtime_error("Failed to open output image");
  }

  output << source.rdbuf();
}

std::string MimeTypeFromPath(const std::string& file_path) {
  std::string extension;
  const size_t dot = file_path.find_last_of('.');
  if (dot != std::string::npos) {
    extension = file_path.substr(dot);
    std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
  }

  if (extension == ".jpg" || extension == ".jpeg") return "image/jpeg";
  if (extension == ".png") return "image/png";
  if (extension == ".webp") return "image/webp";
  if (extension == ".bmp") return "image/bmp";
  if (extension == ".gif") return "image/gif";
  if (extension == ".tif" || extension == ".tiff") return "image/tiff";
  return "application/octet-stream";
}

void TouchEditParams(napi_env env, napi_value request) {
  if (!HasProperty(env, request, "params")) {
    return;
  }

  napi_value params = GetProperty(env, request, "params");

  // This is the C++ side contract point. These reads prove the JS EditParams
  // struct is arriving in native code. Replace this section with the real
  // pipeline parameter mapping when the image engine is implemented.
  volatile double exposure = GetDoubleProperty(env, params, "exposure");
  volatile double contrast = GetDoubleProperty(env, params, "contrast");
  volatile double temperature = GetDoubleProperty(env, params, "temperature");
  volatile double saturation = GetDoubleProperty(env, params, "saturation");
  (void)exposure;
  (void)contrast;
  (void)temperature;
  (void)saturation;
}

napi_value RenderPreview(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read arguments");

  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "renderPreview requires one request object");
    return nullptr;
  }

  try {
    napi_value request = args[0];
    const int32_t request_id = GetIntProperty(env, request, "requestId");
    const std::string image_path = GetStringProperty(env, request, "imagePath");
    TouchEditParams(env, request);

    std::vector<char> file_buffer = ReadBinaryFile(image_path);

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create result object");

    napi_value request_id_value;
    Check(env, napi_create_int32(env, request_id, &request_id_value), "Failed to create requestId");
    Check(env, napi_set_named_property(env, result, "requestId", request_id_value), "Failed to set requestId");

    napi_value mime_type_value;
    const std::string mime_type = MimeTypeFromPath(image_path);
    Check(
        env,
        napi_create_string_utf8(env, mime_type.c_str(), mime_type.size(), &mime_type_value),
        "Failed to create mimeType");
    Check(env, napi_set_named_property(env, result, "mimeType", mime_type_value), "Failed to set mimeType");

    napi_value engine_value;
    Check(env, napi_create_string_utf8(env, "cpp", 3, &engine_value), "Failed to create engine name");
    Check(env, napi_set_named_property(env, result, "engine", engine_value), "Failed to set engine");

    napi_value image_buffer;
    Check(
        env,
        napi_create_buffer_copy(
            env,
            file_buffer.size(),
            file_buffer.empty() ? nullptr : file_buffer.data(),
            nullptr,
            &image_buffer),
        "Failed to create image buffer");
    Check(env, napi_set_named_property(env, result, "imageBuffer", image_buffer), "Failed to set imageBuffer");

    return result;
  } catch (const std::exception& error) {
    napi_throw_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value ExportRenderedImage(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read arguments");

  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "exportRenderedImage requires one request object");
    return nullptr;
  }

  try {
    napi_value request = args[0];
    const std::string image_path = GetStringProperty(env, request, "imagePath");
    const std::string output_path = GetStringProperty(env, request, "outputPath");
    TouchEditParams(env, request);

    CopyBinaryFile(image_path, output_path);

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create result object");

    napi_value output_path_value;
    Check(
        env,
        napi_create_string_utf8(env, output_path.c_str(), output_path.size(), &output_path_value),
        "Failed to create path");
    Check(env, napi_set_named_property(env, result, "path", output_path_value), "Failed to set path");

    return result;
  } catch (const std::exception& error) {
    napi_throw_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value render_preview;
  Check(
      env,
      napi_create_function(env, "renderPreview", NAPI_AUTO_LENGTH, RenderPreview, nullptr, &render_preview),
      "Failed to create renderPreview");
  Check(env, napi_set_named_property(env, exports, "renderPreview", render_preview), "Failed to export renderPreview");

  napi_value export_rendered_image;
  Check(
      env,
      napi_create_function(
          env,
          "exportRenderedImage",
          NAPI_AUTO_LENGTH,
          ExportRenderedImage,
          nullptr,
          &export_rendered_image),
      "Failed to create exportRenderedImage");
  Check(
      env,
      napi_set_named_property(env, exports, "exportRenderedImage", export_rendered_image),
      "Failed to export exportRenderedImage");

  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
