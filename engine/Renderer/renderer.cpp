#include <Renderer/renderer.hpp>

#include <algorithm>
#include <cstddef>

#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

namespace rawelectron::renderer {

namespace {
image_core::Size preview_size(const image_core::Bitmap& input, image_core::Size maximum_size) {
  const double width_scale = maximum_size.width == 0
      ? 1.0
      : static_cast<double>(maximum_size.width) / input.size.width;
  const double height_scale = maximum_size.height == 0
      ? 1.0
      : static_cast<double>(maximum_size.height) / input.size.height;
  const double scale = std::min(1.0, std::min(width_scale, height_scale));
  return {
      std::max(1u, static_cast<std::uint32_t>(input.size.width * scale)),
      std::max(1u, static_cast<std::uint32_t>(input.size.height * scale)),
  };
}

image_core::Status resize_rgba(
    const image_core::Bitmap& input,
    image_core::Size output_size,
    std::uint8_t* output_data,
    size_t output_bytes) {
  const size_t required = static_cast<size_t>(output_size.width) * output_size.height * 4;
  if (output_data == nullptr || output_bytes < required) {
    return {image_core::StatusCode::invalid_argument, "Preview output storage is too small"};
  }
  const cv::Mat source(
      static_cast<int>(input.size.height),
      static_cast<int>(input.size.width),
      CV_8UC4,
      const_cast<std::uint8_t*>(input.pixels.data()));
  cv::Mat destination(
      static_cast<int>(output_size.height),
      static_cast<int>(output_size.width),
      CV_8UC4,
      output_data);
  if (input.size.width == output_size.width && input.size.height == output_size.height) {
    source.copyTo(destination);
  } else {
    cv::resize(source, destination, destination.size(), 0.0, 0.0, cv::INTER_AREA);
  }
  return image_core::Status::success();
}
}  // namespace

image_core::Status ProxyRenderer::render_preview(
    const image_core::Bitmap& input,
    image_core::Size maximum_size,
    image_core::Bitmap& output) {
  if (input.format != image_core::PixelFormat::rgba8 || input.size.width == 0 || input.size.height == 0) {
    return {image_core::StatusCode::invalid_argument, "Renderer requires a non-empty RGBA8 bitmap"};
  }

  output.reset(preview_size(input, maximum_size), image_core::PixelFormat::rgba8, input.color_space);

  return resize_rgba(input, output.size, output.pixels.data(), output.pixels.size());
}

image_core::Status ProxyRenderer::render_preview_into(
    const image_core::Bitmap& input,
    image_core::Size maximum_size,
    image_core::BitmapView& output) {
  if (input.format != image_core::PixelFormat::rgba8 || input.size.width == 0 || input.size.height == 0 ||
      output.data == nullptr) {
    return {image_core::StatusCode::invalid_argument, "Renderer requires RGBA8 input and output storage"};
  }
  const auto size = preview_size(input, maximum_size);
  const std::uint32_t output_width = size.width;
  const std::uint32_t output_height = size.height;
  const std::uint32_t output_stride = output_width * 4;
  const size_t required = static_cast<size_t>(output_stride) * output_height;
  if (output.byte_length < required) {
    return {image_core::StatusCode::invalid_argument, "Shared preview storage is too small"};
  }

  output.size = {output_width, output_height};
  output.format = image_core::PixelFormat::rgba8;
  output.stride = output_stride;
  return resize_rgba(input, output.size, output.data, output.byte_length);
}

}  // namespace rawelectron::renderer
