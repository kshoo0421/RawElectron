#include <rawelectron/codec/codec.hpp>

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iterator>

#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

namespace rawelectron::codec {

namespace {
std::filesystem::path utf8_path(const std::string& value) {
  const std::u8string utf8(
      reinterpret_cast<const char8_t*>(value.data()),
      reinterpret_cast<const char8_t*>(value.data() + value.size()));
  return std::filesystem::path(utf8);
}

image_core::Status read_file(const std::string& path, std::vector<std::uint8_t>& bytes) {
  std::ifstream stream(utf8_path(path), std::ios::binary);
  if (!stream) {
    return {image_core::StatusCode::invalid_argument, "Failed to open image file"};
  }
  bytes.assign(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
  if (bytes.empty()) {
    return {image_core::StatusCode::invalid_argument, "Image file is empty"};
  }
  return image_core::Status::success();
}

image_core::Status write_file(const std::string& path, const std::vector<std::uint8_t>& bytes) {
  std::ofstream stream(utf8_path(path), std::ios::binary | std::ios::trunc);
  if (!stream) {
    return {image_core::StatusCode::internal_error, "Failed to open output file"};
  }
  stream.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  if (!stream) {
    return {image_core::StatusCode::internal_error, "Failed to write output file"};
  }
  return image_core::Status::success();
}
}  // namespace

image_core::Status OpenCvDecoder::decode(const std::string& path, image_core::Bitmap& output) {
  std::vector<std::uint8_t> file_bytes;
  const auto read_status = read_file(path, file_bytes);
  if (!read_status.ok()) return read_status;
  cv::Mat decoded = cv::imdecode(file_bytes, cv::IMREAD_UNCHANGED);
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
  if (extension.empty()) extension = ".png";
  std::vector<std::uint8_t> file_bytes;
  if (!cv::imencode(extension, encoded, file_bytes)) {
    return {image_core::StatusCode::internal_error, "Failed to encode output image"};
  }
  return write_file(output_path, file_bytes);
}

}  // namespace rawelectron::codec
