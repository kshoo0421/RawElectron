#include <node_api.h>

#include <algorithm>
#include <cstdint>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <IPC/engine_bridge.hpp>
#include <Codec/codec.hpp>

namespace {
constexpr bool kOpenCvEnabled = true;

struct SharedBitmapData {
  std::uint8_t* data = nullptr;
  size_t byte_length = 0;
  int32_t width = 0;
  int32_t height = 0;
  int32_t stride = 0;
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
  result.resize(length + 1);
  Check(
      env,
      napi_get_value_string_utf8(env, value, result.data(), result.size(), &length),
      "Failed to read string");
  result.resize(length);
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

bool GetBoolProperty(napi_env env, napi_value object, const char* name, bool fallback = false) {
  if (!HasProperty(env, object, name)) return fallback;
  bool result = fallback;
  Check(env, napi_get_value_bool(env, GetProperty(env, object, name), &result), "Failed to read bool");
  return result;
}

rawelectron::image_core::ImageId GetImageIdProperty(napi_env env, napi_value object) {
  int64_t value = 0;
  Check(env, napi_get_value_int64(env, GetProperty(env, object, "imageId"), &value), "Failed to read imageId");
  if (value <= 0) {
    throw std::invalid_argument("imageId must be positive");
  }
  return static_cast<rawelectron::image_core::ImageId>(value);
}

void ThrowIfFailed(napi_env, const rawelectron::image_core::Status& status) {
  if (!status.ok()) {
    throw std::runtime_error(status.message);
  }
}

SharedBitmapData GetSharedBitmapData(napi_env env, napi_value bitmap) {
  SharedBitmapData result;
  result.width = GetIntProperty(env, bitmap, "width");
  result.height = GetIntProperty(env, bitmap, "height");
  result.stride = GetIntProperty(env, bitmap, "stride");

  if (result.width <= 0 || result.height <= 0 || result.stride < result.width * 4) {
    throw std::invalid_argument("Invalid shared bitmap dimensions");
  }

  napi_value data_value = GetProperty(env, bitmap, "data");
  napi_typedarray_type type;
  size_t element_count = 0;
  void* data = nullptr;
  napi_value array_buffer;
  size_t byte_offset = 0;
  Check(
      env,
      napi_get_typedarray_info(
          env, data_value, &type, &element_count, &data, &array_buffer, &byte_offset),
      "Shared bitmap data must be a Uint8Array");

  if (type != napi_uint8_array && type != napi_uint8_clamped_array) {
    throw std::invalid_argument("Shared bitmap data must be a Uint8Array");
  }

  const size_t required = static_cast<size_t>(result.stride) * static_cast<size_t>(result.height);
  if (element_count < required) {
    throw std::invalid_argument("Shared bitmap buffer is smaller than its dimensions");
  }

  result.data = static_cast<std::uint8_t*>(data);
  result.byte_length = element_count;
  return result;
}

rawelectron::image_core::Adjustment ReadEditParams(napi_env env, napi_value request) {
  rawelectron::image_core::Adjustment params;

  if (!HasProperty(env, request, "params")) {
    return params;
  }

  napi_value value = GetProperty(env, request, "params");
  params.exposure = GetDoubleProperty(env, value, "exposure");
  params.contrast = GetDoubleProperty(env, value, "contrast");
  params.highlights = GetDoubleProperty(env, value, "highlights");
  params.shadows = GetDoubleProperty(env, value, "shadows");
  params.whites = GetDoubleProperty(env, value, "whites");
  params.blacks = GetDoubleProperty(env, value, "blacks");
  params.temperature = GetDoubleProperty(env, value, "temperature");
  params.tint = GetDoubleProperty(env, value, "tint");
  params.vibrance = GetDoubleProperty(env, value, "vibrance");
  params.saturation = GetDoubleProperty(env, value, "saturation");
  params.texture = GetDoubleProperty(env, value, "texture");
  params.clarity = GetDoubleProperty(env, value, "clarity");
  params.dehaze = GetDoubleProperty(env, value, "dehaze");
  params.vignette = GetDoubleProperty(env, value, "vignette");
  params.grain = GetDoubleProperty(env, value, "grain");
  params.sharpening = GetDoubleProperty(env, value, "sharpening");
  params.luminance_noise = GetDoubleProperty(env, value, "luminanceNoise");
  params.color_noise = GetDoubleProperty(env, value, "colorNoise");
  params.moire = GetDoubleProperty(env, value, "moire");
  params.defringe = GetDoubleProperty(env, value, "defringe");
  params.remove_chromatic_aberration = GetBoolProperty(env, value, "removeCa");
  params.lens_correction = GetBoolProperty(env, value, "lensCorrection");

  return params;
}

rawelectron::engine::PreviewSource ReadPreviewSource(napi_env env, napi_value request) {
  if (HasProperty(env, request, "quality") &&
      GetStringProperty(env, request, "quality") == "original") {
    return rawelectron::engine::PreviewSource::original;
  }
  return rawelectron::engine::PreviewSource::proxy;
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
    const auto image_id = GetImageIdProperty(env, request);
    const auto preview_source = ReadPreviewSource(env, request);
    const auto adjustment = ReadEditParams(env, request);
    ThrowIfFailed(env, rawelectron::ipc::set_adjustment(image_id, adjustment));

    int32_t max_width = 1600;
    int32_t max_height = 1200;

    if (HasProperty(env, request, "preview")) {
      napi_value preview = GetProperty(env, request, "preview");
      max_width = GetIntProperty(env, preview, "maxWidth", max_width);
      max_height = GetIntProperty(env, preview, "maxHeight", max_height);
    }

    rawelectron::image_core::Bitmap bitmap;
    ThrowIfFailed(
        env,
        rawelectron::ipc::render_preview(
            image_id,
            {static_cast<std::uint32_t>(std::max(0, max_width)),
             static_cast<std::uint32_t>(std::max(0, max_height))},
            bitmap,
            preview_source));

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create result object");

    napi_value request_id_value;
    Check(env, napi_create_int32(env, request_id, &request_id_value), "Failed to create requestId");
    Check(env, napi_set_named_property(env, result, "requestId", request_id_value), "Failed to set requestId");

    napi_value engine_value;
    Check(env, napi_create_string_utf8(env, kOpenCvEnabled ? "cpp-opencv" : "cpp", NAPI_AUTO_LENGTH, &engine_value), "Failed to create engine name");
    Check(env, napi_set_named_property(env, result, "engine", engine_value), "Failed to set engine");

    napi_value width_value;
    Check(env, napi_create_uint32(env, bitmap.size.width, &width_value), "Failed to create bitmap width");
    Check(env, napi_set_named_property(env, result, "width", width_value), "Failed to set bitmap width");
    napi_value height_value;
    Check(env, napi_create_uint32(env, bitmap.size.height, &height_value), "Failed to create bitmap height");
    Check(env, napi_set_named_property(env, result, "height", height_value), "Failed to set bitmap height");
    napi_value stride_value;
    Check(env, napi_create_uint32(env, bitmap.size.width * 4, &stride_value), "Failed to create bitmap stride");
    Check(env, napi_set_named_property(env, result, "stride", stride_value), "Failed to set bitmap stride");

    void* pixel_storage = nullptr;
    napi_value array_buffer;
    Check(
        env,
        napi_create_arraybuffer(env, bitmap.pixels.size(), &pixel_storage, &array_buffer),
        "Failed to create bitmap ArrayBuffer");
    std::copy(bitmap.pixels.begin(), bitmap.pixels.end(), static_cast<std::uint8_t*>(pixel_storage));
    napi_value pixel_view;
    Check(
        env,
        napi_create_typedarray(
            env, napi_uint8_clamped_array, bitmap.pixels.size(), array_buffer, 0, &pixel_view),
        "Failed to create bitmap pixel view");
    Check(env, napi_set_named_property(env, result, "data", pixel_view), "Failed to set bitmap data");

    return result;
  } catch (const std::exception& error) {
    napi_throw_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value RenderPreviewInto(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read renderPreviewInto arguments");
  if (argc < 2) {
    napi_throw_type_error(env, nullptr, "renderPreviewInto requires a request and shared bitmap");
    return nullptr;
  }

  try {
    napi_value request = args[0];
    const int32_t request_id = GetIntProperty(env, request, "requestId");
    const auto image_id = GetImageIdProperty(env, request);
    const auto preview_source = ReadPreviewSource(env, request);
    const auto adjustment = ReadEditParams(env, request);
    ThrowIfFailed(env, rawelectron::ipc::set_adjustment(image_id, adjustment));

    int32_t max_width = 1600;
    int32_t max_height = 1200;
    if (HasProperty(env, request, "preview")) {
      napi_value preview = GetProperty(env, request, "preview");
      max_width = GetIntProperty(env, preview, "maxWidth", max_width);
      max_height = GetIntProperty(env, preview, "maxHeight", max_height);
    }

    const SharedBitmapData storage = GetSharedBitmapData(env, args[1]);
    rawelectron::image_core::BitmapView output;
    output.data = storage.data;
    output.byte_length = storage.byte_length;
    output.stride = static_cast<std::uint32_t>(storage.stride);
    ThrowIfFailed(
        env,
        rawelectron::ipc::render_preview_into(
            image_id,
            {static_cast<std::uint32_t>(std::max(0, max_width)),
             static_cast<std::uint32_t>(std::max(0, max_height))},
            output,
            preview_source));

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create shared preview result");
    napi_value value;
    Check(env, napi_create_int32(env, request_id, &value), "Failed to create requestId");
    Check(env, napi_set_named_property(env, result, "requestId", value), "Failed to set requestId");
    Check(env, napi_create_uint32(env, output.size.width, &value), "Failed to create width");
    Check(env, napi_set_named_property(env, result, "width", value), "Failed to set width");
    Check(env, napi_create_uint32(env, output.size.height, &value), "Failed to create height");
    Check(env, napi_set_named_property(env, result, "height", value), "Failed to set height");
    Check(env, napi_create_uint32(env, output.stride, &value), "Failed to create stride");
    Check(env, napi_set_named_property(env, result, "stride", value), "Failed to set stride");
    Check(env, napi_create_string_utf8(env, "cpp-opencv", NAPI_AUTO_LENGTH, &value), "Failed to create engine");
    Check(env, napi_set_named_property(env, result, "engine", value), "Failed to set engine");
    return result;
  } catch (const std::exception& error) {
    napi_throw_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value RenderPreviewFile(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read renderPreviewFile arguments");
  if (argc < 2) {
    napi_throw_type_error(env, nullptr, "renderPreviewFile requires a request and output path");
    return nullptr;
  }
  try {
    napi_value request = args[0];
    const int32_t request_id = GetIntProperty(env, request, "requestId");
    const auto image_id = GetImageIdProperty(env, request);
    const auto preview_source = ReadPreviewSource(env, request);
    const auto adjustment = ReadEditParams(env, request);
    ThrowIfFailed(env, rawelectron::ipc::set_adjustment(image_id, adjustment));

    napi_value path_value = args[1];
    size_t path_length = 0;
    Check(env, napi_get_value_string_utf8(env, path_value, nullptr, 0, &path_length), "Failed to measure output path");
    std::string output_path(path_length + 1, '\0');
    Check(env, napi_get_value_string_utf8(env, path_value, output_path.data(), output_path.size(), &path_length), "Failed to read output path");
    output_path.resize(path_length);

    int32_t max_width = 1600;
    int32_t max_height = 1200;
    if (HasProperty(env, request, "preview")) {
      napi_value preview = GetProperty(env, request, "preview");
      max_width = GetIntProperty(env, preview, "maxWidth", max_width);
      max_height = GetIntProperty(env, preview, "maxHeight", max_height);
    }
    rawelectron::image_core::Bitmap bitmap;
    ThrowIfFailed(env, rawelectron::ipc::render_preview(
        image_id,
        {static_cast<std::uint32_t>(std::max(1, max_width)), static_cast<std::uint32_t>(std::max(1, max_height))},
        bitmap,
        preview_source));
    std::vector<std::uint8_t> png;
    ThrowIfFailed(env, rawelectron::codec::encode_png(bitmap, png));
    std::ofstream stream(output_path, std::ios::binary | std::ios::trunc);
    if (!stream) throw std::runtime_error("Failed to open preview output file");
    stream.write(reinterpret_cast<const char*>(png.data()), static_cast<std::streamsize>(png.size()));
    if (!stream) throw std::runtime_error("Failed to write preview output file");

    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create preview file result");
    napi_value value;
    Check(env, napi_create_int32(env, request_id, &value), "Failed to create requestId");
    Check(env, napi_set_named_property(env, result, "requestId", value), "Failed to set requestId");
    Check(env, napi_create_uint32(env, bitmap.size.width, &value), "Failed to create width");
    Check(env, napi_set_named_property(env, result, "width", value), "Failed to set width");
    Check(env, napi_create_uint32(env, bitmap.size.height, &value), "Failed to create height");
    Check(env, napi_set_named_property(env, result, "height", value), "Failed to set height");
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
    const auto image_id = GetImageIdProperty(env, request);
    const std::string output_path = GetStringProperty(env, request, "outputPath");
    const auto adjustment = ReadEditParams(env, request);
    ThrowIfFailed(env, rawelectron::ipc::set_adjustment(image_id, adjustment));
    ThrowIfFailed(env, rawelectron::ipc::export_image(image_id, output_path));

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

napi_value OpenImage(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read openImage arguments");
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "openImage requires an image path");
    return nullptr;
  }

  try {
    size_t length = 0;
    Check(env, napi_get_value_string_utf8(env, args[0], nullptr, 0, &length), "Failed to measure image path");
    std::string path(length + 1, '\0');
    Check(env, napi_get_value_string_utf8(env, args[0], path.data(), path.size(), &length), "Failed to read image path");
    path.resize(length);
    rawelectron::image_core::ImageId image_id = 0;
    ThrowIfFailed(env, rawelectron::ipc::open_image(path, image_id));
    rawelectron::engine::ImageInfo image_info;
    ThrowIfFailed(env, rawelectron::ipc::get_image_info(image_id, image_info));
    napi_value result;
    Check(env, napi_create_object(env, &result), "Failed to create image info");
    napi_value value;
    Check(env, napi_create_int64(env, static_cast<int64_t>(image_id), &value), "Failed to create imageId");
    Check(env, napi_set_named_property(env, result, "id", value), "Failed to set imageId");
    Check(env, napi_create_uint32(env, image_info.size.width, &value), "Failed to create width");
    Check(env, napi_set_named_property(env, result, "width", value), "Failed to set width");
    Check(env, napi_create_uint32(env, image_info.size.height, &value), "Failed to create height");
    Check(env, napi_set_named_property(env, result, "height", value), "Failed to set height");
    Check(env, napi_create_string_utf8(env, "rgba8", NAPI_AUTO_LENGTH, &value), "Failed to create pixel format");
    Check(env, napi_set_named_property(env, result, "pixelFormat", value), "Failed to set pixel format");
    return result;
  } catch (const std::exception& error) {
    napi_throw_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value CloseImage(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read closeImage arguments");
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "closeImage requires an imageId");
    return nullptr;
  }

  int64_t value = 0;
  Check(env, napi_get_value_int64(env, args[0], &value), "Failed to read imageId");
  const auto status = rawelectron::ipc::close_image(static_cast<rawelectron::image_core::ImageId>(value));
  if (!status.ok()) {
    napi_throw_error(env, nullptr, status.message.c_str());
    return nullptr;
  }
  napi_value result;
  Check(env, napi_get_boolean(env, true, &result), "Failed to create close result");
  return result;
}

napi_value CreateSharedBitmap(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read bitmap dimensions");

  if (argc < 2) {
    napi_throw_type_error(env, nullptr, "createSharedBitmap requires width and height");
    return nullptr;
  }

  int32_t width = 0;
  int32_t height = 0;
  Check(env, napi_get_value_int32(env, args[0], &width), "Invalid bitmap width");
  Check(env, napi_get_value_int32(env, args[1], &height), "Invalid bitmap height");

  if (width <= 0 || height <= 0 || width > 32768 || height > 32768) {
    napi_throw_range_error(env, nullptr, "Bitmap dimensions are out of range");
    return nullptr;
  }

  const size_t stride = static_cast<size_t>(width) * 4;
  if (static_cast<size_t>(height) > SIZE_MAX / stride) {
    napi_throw_range_error(env, nullptr, "Bitmap allocation is too large");
    return nullptr;
  }

  const size_t byte_length = stride * static_cast<size_t>(height);
  void* pixels = nullptr;
  napi_value array_buffer;
  Check(env, napi_create_arraybuffer(env, byte_length, &pixels, &array_buffer), "Failed to allocate bitmap buffer");
  std::fill_n(static_cast<std::uint8_t*>(pixels), byte_length, 0);

  napi_value data;
  Check(
      env,
      napi_create_typedarray(env, napi_uint8_clamped_array, byte_length, array_buffer, 0, &data),
      "Failed to create bitmap view");

  napi_value result;
  Check(env, napi_create_object(env, &result), "Failed to create shared bitmap");

  napi_value value;
  Check(env, napi_create_int32(env, width, &value), "Failed to create width");
  Check(env, napi_set_named_property(env, result, "width", value), "Failed to set width");
  Check(env, napi_create_int32(env, height, &value), "Failed to create height");
  Check(env, napi_set_named_property(env, result, "height", value), "Failed to set height");
  Check(env, napi_create_int64(env, static_cast<int64_t>(stride), &value), "Failed to create stride");
  Check(env, napi_set_named_property(env, result, "stride", value), "Failed to set stride");
  Check(env, napi_create_string_utf8(env, "rgba8", NAPI_AUTO_LENGTH, &value), "Failed to create pixel format");
  Check(env, napi_set_named_property(env, result, "pixelFormat", value), "Failed to set pixel format");
  Check(env, napi_set_named_property(env, result, "data", data), "Failed to set bitmap data");
  return result;
}

napi_value FillSharedBitmap(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read fill arguments");

  if (argc < 2) {
    napi_throw_type_error(env, nullptr, "fillSharedBitmap requires a bitmap and packed RGBA color");
    return nullptr;
  }

  try {
    const SharedBitmapData bitmap = GetSharedBitmapData(env, args[0]);
    uint32_t rgba = 0;
    Check(env, napi_get_value_uint32(env, args[1], &rgba), "Invalid packed RGBA color");
    const std::uint8_t red = static_cast<std::uint8_t>((rgba >> 24) & 0xff);
    const std::uint8_t green = static_cast<std::uint8_t>((rgba >> 16) & 0xff);
    const std::uint8_t blue = static_cast<std::uint8_t>((rgba >> 8) & 0xff);
    const std::uint8_t alpha = static_cast<std::uint8_t>(rgba & 0xff);

    for (int32_t y = 0; y < bitmap.height; ++y) {
      std::uint8_t* row = bitmap.data + static_cast<size_t>(y) * bitmap.stride;
      for (int32_t x = 0; x < bitmap.width; ++x) {
        std::uint8_t* pixel = row + static_cast<size_t>(x) * 4;
        pixel[0] = red;
        pixel[1] = green;
        pixel[2] = blue;
        pixel[3] = alpha;
      }
    }
    return args[0];
  } catch (const std::exception& error) {
    napi_throw_type_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value ChecksumSharedBitmap(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  Check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Failed to read checksum arguments");

  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "checksumSharedBitmap requires a bitmap");
    return nullptr;
  }

  try {
    const SharedBitmapData bitmap = GetSharedBitmapData(env, args[0]);
    uint32_t checksum = 2166136261u;
    const size_t visible_bytes = static_cast<size_t>(bitmap.width) * 4;
    for (int32_t y = 0; y < bitmap.height; ++y) {
      const std::uint8_t* row = bitmap.data + static_cast<size_t>(y) * bitmap.stride;
      for (size_t index = 0; index < visible_bytes; ++index) {
        checksum = (checksum ^ row[index]) * 16777619u;
      }
    }

    napi_value result;
    Check(env, napi_create_uint32(env, checksum, &result), "Failed to create bitmap checksum");
    return result;
  } catch (const std::exception& error) {
    napi_throw_type_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor engine_properties[] = {
      {"openImage", nullptr, OpenImage, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"closeImage", nullptr, CloseImage, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"renderPreviewInto", nullptr, RenderPreviewInto, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"renderPreviewFile", nullptr, RenderPreviewFile, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  Check(env, napi_define_properties(env, exports, 4, engine_properties), "Failed to export engine functions");

  napi_property_descriptor bitmap_properties[] = {
      {"createSharedBitmap", nullptr, CreateSharedBitmap, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"fillSharedBitmap", nullptr, FillSharedBitmap, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"checksumSharedBitmap", nullptr, ChecksumSharedBitmap, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  Check(
      env,
      napi_define_properties(env, exports, 3, bitmap_properties),
      "Failed to export shared bitmap functions");

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
