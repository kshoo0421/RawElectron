#include <rawelectron/processing/processor.hpp>

#include <algorithm>
#include <cmath>

namespace rawelectron::processing {

image_core::Status BasicProcessor::process(
    const image_core::Bitmap& input,
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& output) {
  if (input.format != image_core::PixelFormat::rgba8) {
    return {image_core::StatusCode::invalid_argument, "Processor requires RGBA8 input"};
  }
  output = input;
  const double exposure = std::pow(2.0, std::clamp(adjustment.exposure, -5.0, 5.0));
  const double contrast = 1.0 + std::clamp(adjustment.contrast, -100.0, 100.0) / 100.0;
  const double saturation = 1.0 + std::clamp(adjustment.saturation, -100.0, 100.0) / 100.0;

  for (size_t offset = 0; offset + 3 < output.pixels.size(); offset += 4) {
    double red = output.pixels[offset] / 255.0;
    double green = output.pixels[offset + 1] / 255.0;
    double blue = output.pixels[offset + 2] / 255.0;
    red = ((red - 0.5) * contrast + 0.5) * exposure;
    green = ((green - 0.5) * contrast + 0.5) * exposure;
    blue = ((blue - 0.5) * contrast + 0.5) * exposure;
    const double luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    red = luminance + (red - luminance) * saturation;
    green = luminance + (green - luminance) * saturation;
    blue = luminance + (blue - luminance) * saturation;
    output.pixels[offset] = static_cast<std::uint8_t>(std::clamp(red, 0.0, 1.0) * 255.0);
    output.pixels[offset + 1] = static_cast<std::uint8_t>(std::clamp(green, 0.0, 1.0) * 255.0);
    output.pixels[offset + 2] = static_cast<std::uint8_t>(std::clamp(blue, 0.0, 1.0) * 255.0);
  }
  return image_core::Status::success();
}

}  // namespace rawelectron::processing
