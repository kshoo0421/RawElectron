#include <Processing/processor.hpp>

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
  const double vibrance = std::clamp(adjustment.vibrance, -100.0, 100.0) / 100.0;
  const double temperature = std::clamp(adjustment.temperature, -100.0, 100.0) / 1000.0;
  const double tint = std::clamp(adjustment.tint, -100.0, 100.0) / 1000.0;
  const double highlights = std::clamp(adjustment.highlights, -100.0, 100.0) / 100.0;
  const double shadows = std::clamp(adjustment.shadows, -100.0, 100.0) / 100.0;
  const double whites = std::clamp(adjustment.whites, -100.0, 100.0) / 200.0;
  const double blacks = std::clamp(adjustment.blacks, -100.0, 100.0) / 200.0;
  const double dehaze = std::clamp(adjustment.dehaze, -100.0, 100.0) / 200.0;
  const double vignette = std::clamp(adjustment.vignette, -100.0, 100.0) / 100.0;
  const double detail = (std::clamp(adjustment.texture, -100.0, 100.0) * 0.003 +
                         std::clamp(adjustment.clarity, -100.0, 100.0) * 0.004 +
                         std::clamp(adjustment.sharpening, 0.0, 100.0) * 0.005);
  const double smoothing = (std::clamp(adjustment.luminance_noise, 0.0, 100.0) +
                            std::clamp(adjustment.color_noise, 0.0, 100.0)) * 0.003;
  const double grain = std::clamp(adjustment.grain, 0.0, 100.0) / 2500.0;
  const double artifact_desaturation =
      (std::clamp(adjustment.moire, 0.0, 100.0) + std::clamp(adjustment.defringe, 0.0, 100.0)) / 400.0;

  const double center_x = (output.size.width - 1) * 0.5;
  const double center_y = (output.size.height - 1) * 0.5;
  const double maximum_radius = std::sqrt(center_x * center_x + center_y * center_y);

  for (size_t offset = 0; offset + 3 < output.pixels.size(); offset += 4) {
    double red = output.pixels[offset] / 255.0;
    double green = output.pixels[offset + 1] / 255.0;
    double blue = output.pixels[offset + 2] / 255.0;
    red = ((red - 0.5) * contrast + 0.5) * exposure;
    green = ((green - 0.5) * contrast + 0.5) * exposure;
    blue = ((blue - 0.5) * contrast + 0.5) * exposure;
    const double luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const double tone = highlights * luminance * luminance + shadows * (1.0 - luminance) * (1.0 - luminance);
    red += tone + whites * luminance + blacks * (1.0 - luminance);
    green += tone + whites * luminance + blacks * (1.0 - luminance);
    blue += tone + whites * luminance + blacks * (1.0 - luminance);
    red += temperature + tint * 0.5;
    green -= tint;
    blue -= temperature - tint * 0.5;
    const double channel_peak = std::max({red, green, blue});
    const double adaptive_saturation = saturation + vibrance * (1.0 - std::clamp(channel_peak - luminance, 0.0, 1.0)) - artifact_desaturation;
    red = luminance + (red - luminance) * adaptive_saturation;
    green = luminance + (green - luminance) * adaptive_saturation;
    blue = luminance + (blue - luminance) * adaptive_saturation;
    red = (red - 0.5) * (1.0 + dehaze) + 0.5;
    green = (green - 0.5) * (1.0 + dehaze) + 0.5;
    blue = (blue - 0.5) * (1.0 + dehaze) + 0.5;

    const size_t pixel = offset / 4;
    const size_t x_index = pixel % output.size.width;
    const size_t y_index = pixel / output.size.width;
    if ((detail != 0.0 || smoothing != 0.0) && output.size.width > 2 && output.size.height > 2) {
      const size_t left = (x_index == 0 ? pixel : pixel - 1) * 4;
      const size_t right = (x_index + 1 >= output.size.width ? pixel : pixel + 1) * 4;
      const size_t up = (y_index == 0 ? pixel : pixel - output.size.width) * 4;
      const size_t down = (y_index + 1 >= output.size.height ? pixel : pixel + output.size.width) * 4;
      for (size_t channel = 0; channel < 3; ++channel) {
        const double source = input.pixels[offset + channel] / 255.0;
        const double neighbours = (input.pixels[left + channel] + input.pixels[right + channel] +
                                   input.pixels[up + channel] + input.pixels[down + channel]) / 1020.0;
        double* value = channel == 0 ? &red : channel == 1 ? &green : &blue;
        *value += (source - neighbours) * detail;
        *value += (neighbours - *value) * std::clamp(smoothing, 0.0, 0.6);
      }
    }

    if (grain != 0.0) {
      const std::uint32_t hash = static_cast<std::uint32_t>((pixel * 1664525u + 1013904223u) & 0xffffffffu);
      const double noise = (static_cast<double>(hash & 0xffffu) / 65535.0 - 0.5) * grain;
      red += noise;
      green += noise;
      blue += noise;
    }

    if (vignette != 0.0 && maximum_radius > 0.0) {
      const double x = static_cast<double>(pixel % output.size.width) - center_x;
      const double y = static_cast<double>(pixel / output.size.width) - center_y;
      const double radius = std::sqrt(x * x + y * y) / maximum_radius;
      const double factor = 1.0 - vignette * radius * radius * 0.75;
      red *= factor;
      green *= factor;
      blue *= factor;
    }
    output.pixels[offset] = static_cast<std::uint8_t>(std::clamp(red, 0.0, 1.0) * 255.0);
    output.pixels[offset + 1] = static_cast<std::uint8_t>(std::clamp(green, 0.0, 1.0) * 255.0);
    output.pixels[offset + 2] = static_cast<std::uint8_t>(std::clamp(blue, 0.0, 1.0) * 255.0);
  }
  return image_core::Status::success();
}

}  // namespace rawelectron::processing
