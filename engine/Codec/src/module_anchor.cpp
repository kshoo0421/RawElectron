#include <rawelectron/codec/codec.hpp>

#include <algorithm>
#include <cctype>

#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

namespace rawelectron::codec {

image_core::Status OpenCvDecoder::decode(const std::string& path, image_core::Bitmap& output) {
  cv::Mat decoded = cv::imread(path, cv::IMREAD_UNCHANGED);
  if (decoded.empty()) {
    return {image_core::StatusCode::invalid_argument, "Failed to decode image"};
  }

  cv::Mat rgba;
  if (decoded.channels() == 1) {
    cv::cvtColor(decoded, rgba, cv::COLOR_GRAY2RGBA);
  } else if (decoded.channels() == 3) {
    cv::cvtColor(decoded, rgba, cv::COLOR_BGR2RGBA);
  } else if (decoded.channels() == 4) {
    cv::cvtColor(decoded, rgba, cv::COLOR_BGRA2RGBA);
  } else {
    return {image_core::StatusCode::invalid_argument, "Unsupported channel count"};
  }

  if (rgba.depth() != CV_8U) {
    double minimum = 0.0;
    double maximum = 0.0;
    cv::minMaxLoc(rgba.reshape(1), &minimum, &maximum);
    cv::Mat converted;
    rgba.convertTo(converted, CV_8U, maximum > 255.0 ? 255.0 / maximum : 1.0);
    rgba = converted;
  }

  if (!rgba.isContinuous()) {
    rgba = rgba.clone();
  }
  output.size = {static_cast<std::uint32_t>(rgba.cols), static_cast<std::uint32_t>(rgba.rows)};
  output.format = image_core::PixelFormat::rgba8;
  output.pixels.assign(rgba.data, rgba.data + rgba.total() * rgba.elemSize());
  return image_core::Status::success();
}

namespace {
cv::Mat as_rgba_mat(const image_core::Bitmap& bitmap) {
  return cv::Mat(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      const_cast<std::uint8_t*>(bitmap.pixels.data()));
}

image_core::Status validate(const image_core::Bitmap& bitmap) {
  const size_t expected = static_cast<size_t>(bitmap.size.width) * bitmap.size.height * 4;
  if (bitmap.format != image_core::PixelFormat::rgba8 || bitmap.size.width == 0 ||
      bitmap.size.height == 0 || bitmap.pixels.size() < expected) {
    return {image_core::StatusCode::invalid_argument, "Codec requires a non-empty RGBA8 bitmap"};
  }
  return image_core::Status::success();
}
}  // namespace

image_core::Status encode_png(const image_core::Bitmap& bitmap, std::vector<std::uint8_t>& output) {
  const auto status = validate(bitmap);
  if (!status.ok()) return status;
  cv::Mat bgra;
  cv::cvtColor(as_rgba_mat(bitmap), bgra, cv::COLOR_RGBA2BGRA);
  if (!cv::imencode(".png", bgra, output, {cv::IMWRITE_PNG_COMPRESSION, 3})) {
    return {image_core::StatusCode::internal_error, "Failed to encode PNG preview"};
  }
  return image_core::Status::success();
}

image_core::Status encode_file(const image_core::Bitmap& bitmap, const std::string& output_path) {
  const auto status = validate(bitmap);
  if (!status.ok()) return status;
  std::string extension;
  const auto dot = output_path.find_last_of('.');
  if (dot != std::string::npos) extension = output_path.substr(dot);
  std::transform(extension.begin(), extension.end(), extension.begin(), [](unsigned char value) {
    return static_cast<char>(std::tolower(value));
  });
  cv::Mat encoded;
  if (extension == ".jpg" || extension == ".jpeg") {
    cv::cvtColor(as_rgba_mat(bitmap), encoded, cv::COLOR_RGBA2BGR);
  } else {
    cv::cvtColor(as_rgba_mat(bitmap), encoded, cv::COLOR_RGBA2BGRA);
  }
  if (!cv::imwrite(output_path, encoded)) {
    return {image_core::StatusCode::internal_error, "Failed to write output image"};
  }
  return image_core::Status::success();
}

}  // namespace rawelectron::codec
