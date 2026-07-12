#include <rawelectron/renderer/renderer.hpp>

#include <algorithm>
#include <cstddef>

namespace rawelectron::renderer {

image_core::Status ProxyRenderer::render_preview(
    const image_core::Bitmap& input,
    image_core::Size maximum_size,
    image_core::Bitmap& output) {
  if (input.format != image_core::PixelFormat::rgba8 || input.size.width == 0 || input.size.height == 0) {
    return {image_core::StatusCode::invalid_argument, "Renderer requires a non-empty RGBA8 bitmap"};
  }

  const double width_scale = maximum_size.width == 0
      ? 1.0
      : static_cast<double>(maximum_size.width) / input.size.width;
  const double height_scale = maximum_size.height == 0
      ? 1.0
      : static_cast<double>(maximum_size.height) / input.size.height;
  const double scale = std::min(1.0, std::min(width_scale, height_scale));
  output.size.width = std::max(1u, static_cast<std::uint32_t>(input.size.width * scale));
  output.size.height = std::max(1u, static_cast<std::uint32_t>(input.size.height * scale));
  output.format = image_core::PixelFormat::rgba8;
  output.pixels.resize(static_cast<size_t>(output.size.width) * output.size.height * 4);

  for (std::uint32_t y = 0; y < output.size.height; ++y) {
    const std::uint32_t source_y = std::min(input.size.height - 1, y * input.size.height / output.size.height);
    for (std::uint32_t x = 0; x < output.size.width; ++x) {
      const std::uint32_t source_x = std::min(input.size.width - 1, x * input.size.width / output.size.width);
      const size_t source_offset = (static_cast<size_t>(source_y) * input.size.width + source_x) * 4;
      const size_t output_offset = (static_cast<size_t>(y) * output.size.width + x) * 4;
      std::copy_n(input.pixels.data() + source_offset, 4, output.pixels.data() + output_offset);
    }
  }
  return image_core::Status::success();
}

}  // namespace rawelectron::renderer
