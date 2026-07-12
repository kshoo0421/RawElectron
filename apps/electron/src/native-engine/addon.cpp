#include <node_api.h>

#include <algorithm>
#include <cmath>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <rawelectron/ipc/engine_bridge.hpp>

#ifdef RAWELECTRON_WITH_OPENCV
#include <opencv2/core.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#endif

namespace {

#ifdef RAWELECTRON_WITH_OPENCV
constexpr bool kOpenCvEnabled = true;
#else
constexpr bool kOpenCvEnabled = false;
#endif

struct EditParams {
  double exposure = 0.0;
  double contrast = 0.0;
  double temperature = 0.0;
  double tint = 0.0;
  double vibrance = 0.0;
  double saturation = 0.0;
  double sharpening = 0.0;
};

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

std::string ExtensionFromPath(const std::string& file_path) {
  std::string extension = ".png";
  const size_t dot = file_path.find_last_of('.');

  if (dot != std::string::npos) {
    extension = file_path.substr(dot);
    std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
  }

  if (extension == ".jpg" || extension == ".jpeg" || extension == ".png" || extension == ".webp" ||
      extension == ".bmp" || extension == ".tif" || extension == ".tiff") {
    return extension;
  }

  return ".png";
}

EditParams ReadEditParams(napi_env env, napi_value request) {
  EditParams params;

  if (!HasProperty(env, request, "params")) {
    return params;
  }

  napi_value value = GetProperty(env, request, "params");
  params.exposure = GetDoubleProperty(env, value, "exposure");
  params.contrast = GetDoubleProperty(env, value, "contrast");
  params.temperature = GetDoubleProperty(env, value, "temperature");
  params.tint = GetDoubleProperty(env, value, "tint");
  params.vibrance = GetDoubleProperty(env, value, "vibrance");
  params.saturation = GetDoubleProperty(env, value, "saturation");
  params.sharpening = GetDoubleProperty(env, value, "sharpening");

  return params;
}

#ifdef RAWELECTRON_WITH_OPENCV
double Clamp(double value, double min_value, double max_value) {
  return std::max(min_value, std::min(max_value, value));
}

cv::Mat NormalizeImageForProcessing(const cv::Mat& source) {
  cv::Mat normalized;

  if (source.channels() == 1) {
    cv::cvtColor(source, normalized, cv::COLOR_GRAY2BGR);
  } else if (source.channels() == 4) {
    cv::cvtColor(source, normalized, cv::COLOR_BGRA2BGR);
  } else {
    normalized = source;
  }

  if (normalized.depth() == CV_8U) {
    return normalized;
  }

  double min_value = 0.0;
  double max_value = 0.0;
  cv::minMaxLoc(normalized, &min_value, &max_value);

  const double scale = max_value > 255.0 ? 255.0 / max_value : 1.0;
  cv::Mat eight_bit;
  normalized.convertTo(eight_bit, CV_8U, scale);
  return eight_bit;
}

void ResizeForPreview(cv::Mat& image, int32_t max_width, int32_t max_height) {
  if (max_width <= 0 || max_height <= 0 || (image.cols <= max_width && image.rows <= max_height)) {
    return;
  }

  const double scale =
      std::min(static_cast<double>(max_width) / image.cols, static_cast<double>(max_height) / image.rows);
  cv::Mat resized;
  cv::resize(image, resized, cv::Size(), scale, scale, cv::INTER_AREA);
  image = resized;
}

cv::Mat ApplyOpenCvEdits(const cv::Mat& source, const EditParams& params) {
  cv::Mat image = NormalizeImageForProcessing(source);

  image.convertTo(image, CV_32F, 1.0 / 255.0);

  const double exposure_gain = std::pow(2.0, Clamp(params.exposure, -5.0, 5.0));
  const double contrast_gain = 1.0 + Clamp(params.contrast, -100.0, 100.0) / 100.0;
  image = (image - 0.5) * contrast_gain + 0.5;
  image *= exposure_gain;

  std::vector<cv::Mat> channels;
  cv::split(image, channels);

  const double temperature_shift = Clamp(params.temperature, -100.0, 100.0) / 100.0 * 0.12;
  const double tint_shift = Clamp(params.tint, -100.0, 100.0) / 100.0 * 0.08;

  channels[0] -= temperature_shift;
  channels[2] += temperature_shift;
  channels[1] -= tint_shift;
  cv::merge(channels, image);
  cv::max(image, 0.0, image);
  cv::min(image, 1.0, image);

  const double saturation_gain =
      1.0 + Clamp(params.saturation + params.vibrance * 0.6, -100.0, 100.0) / 100.0;

  if (std::abs(saturation_gain - 1.0) > 0.001) {
    cv::Mat hsv;
    cv::cvtColor(image, hsv, cv::COLOR_BGR2HSV);
    cv::split(hsv, channels);
    channels[1] *= saturation_gain;
    cv::min(channels[1], 1.0, channels[1]);
    cv::merge(channels, hsv);
    cv::cvtColor(hsv, image, cv::COLOR_HSV2BGR);
  }

  cv::max(image, 0.0, image);
  cv::min(image, 1.0, image);
  image.convertTo(image, CV_8U, 255.0);

  if (params.sharpening > 0.0) {
    cv::Mat blurred;
    const double amount = Clamp(params.sharpening, 0.0, 150.0) / 150.0;
    cv::GaussianBlur(image, blurred, cv::Size(0, 0), 1.2);
    cv::addWeighted(image, 1.0 + amount, blurred, -amount, 0.0, image);
  }

  return image;
}

std::vector<unsigned char> EncodePreviewWithOpenCv(
    const std::string& image_path,
    const EditParams& params,
    int32_t max_width,
    int32_t max_height) {
  cv::Mat source = cv::imread(image_path, cv::IMREAD_UNCHANGED);

  if (source.empty()) {
    throw std::runtime_error("OpenCV failed to decode input image");
  }

  ResizeForPreview(source, max_width, max_height);
  cv::Mat edited = ApplyOpenCvEdits(source, params);

  std::vector<unsigned char> encoded;
  const std::vector<int> encode_params = {cv::IMWRITE_PNG_COMPRESSION, 3};

  if (!cv::imencode(".png", edited, encoded, encode_params)) {
    throw std::runtime_error("OpenCV failed to encode preview");
  }

  return encoded;
}

void ExportWithOpenCv(const std::string& image_path, const std::string& output_path, const EditParams& params) {
  cv::Mat source = cv::imread(image_path, cv::IMREAD_UNCHANGED);

  if (source.empty()) {
    throw std::runtime_error("OpenCV failed to decode input image");
  }

  cv::Mat edited = ApplyOpenCvEdits(source, params);
  const std::string extension = ExtensionFromPath(output_path);
  std::vector<int> write_params;

  if (extension == ".jpg" || extension == ".jpeg") {
    write_params = {cv::IMWRITE_JPEG_QUALITY, 95};
  } else if (extension == ".png") {
    write_params = {cv::IMWRITE_PNG_COMPRESSION, 3};
  }

  if (!cv::imwrite(output_path, edited, write_params)) {
    throw std::runtime_error("OpenCV failed to write output image");
  }
}
#endif

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
    const EditParams params = ReadEditParams(env, request);

    std::vector<char> file_buffer;
    std::string mime_type = MimeTypeFromPath(image_path);

#ifdef RAWELECTRON_WITH_OPENCV
    int32_t max_width = 1600;
    int32_t max_height = 1200;

    if (HasProperty(env, request, "preview")) {
      napi_value preview = GetProperty(env, request, "preview");
      max_width = GetIntProperty(env, preview, "maxWidth", max_width);
      max_height = GetIntProperty(env, preview, "maxHeight", max_height);
    }

    std::vector<unsigned char> encoded_preview =
        EncodePreviewWithOpenCv(image_path, params, max_width, max_height);
    file_buffer.assign(encoded_preview.begin(), encoded_preview.end());
    mime_type = "image/png";
#else
    file_buffer = ReadBinaryFile(image_path);
#endif

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create result object");

    napi_value request_id_value;
    Check(env, napi_create_int32(env, request_id, &request_id_value), "Failed to create requestId");
    Check(env, napi_set_named_property(env, result, "requestId", request_id_value), "Failed to set requestId");

    napi_value mime_type_value;
    Check(
        env,
        napi_create_string_utf8(env, mime_type.c_str(), mime_type.size(), &mime_type_value),
        "Failed to create mimeType");
    Check(env, napi_set_named_property(env, result, "mimeType", mime_type_value), "Failed to set mimeType");

    napi_value engine_value;
    Check(env, napi_create_string_utf8(env, kOpenCvEnabled ? "cpp-opencv" : "cpp", NAPI_AUTO_LENGTH, &engine_value), "Failed to create engine name");
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
    const EditParams params = ReadEditParams(env, request);

#ifdef RAWELECTRON_WITH_OPENCV
    ExportWithOpenCv(image_path, output_path, params);
#else
    CopyBinaryFile(image_path, output_path);
#endif

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

napi_value GetEngineInfo(napi_env env, napi_callback_info) {
  const auto info = rawelectron::ipc::get_engine_info();
  napi_value result;
  Check(env, napi_create_object(env, &result), "Failed to create engine info");

  napi_value name;
  Check(env, napi_create_string_utf8(env, info.name.c_str(), info.name.size(), &name), "Failed to create name");
  Check(env, napi_set_named_property(env, result, "name", name), "Failed to set name");

  napi_value api_version;
  Check(
      env,
      napi_create_string_utf8(env, info.api_version.c_str(), info.api_version.size(), &api_version),
      "Failed to create API version");
  Check(env, napi_set_named_property(env, result, "apiVersion", api_version), "Failed to set API version");

  napi_value ready;
  Check(env, napi_get_boolean(env, info.ready, &ready), "Failed to create ready state");
  Check(env, napi_set_named_property(env, result, "ready", ready), "Failed to set ready state");
  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value get_engine_info;
  Check(
      env,
      napi_create_function(env, "getEngineInfo", NAPI_AUTO_LENGTH, GetEngineInfo, nullptr, &get_engine_info),
      "Failed to create getEngineInfo");
  Check(env, napi_set_named_property(env, exports, "getEngineInfo", get_engine_info), "Failed to export getEngineInfo");

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
