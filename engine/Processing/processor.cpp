#include <Processing/processor.hpp>

#include <algorithm>
#include <cmath>
#include <cstdint>

#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

namespace rawelectron::processing {
namespace {

double normalized(double value) {
  return std::clamp(value, -100.0, 100.0) / 100.0;
}

double positive_normalized(double value) {
  return std::clamp(value, 0.0, 100.0) / 100.0;
}

double smoothstep(double edge0, double edge1, double value) {
  const double t = std::clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

double luminance(double red, double green, double blue) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

double apply_curve(const std::vector<image_core::Adjustment::CurvePoint>& custom_points, double value) {
  if (custom_points.empty()) return std::clamp(value, 0.0, 1.0);
  std::vector<image_core::Adjustment::CurvePoint> points;
  points.reserve(custom_points.size() + 2);
  points.push_back({0.0, 0.0});
  points.insert(points.end(), custom_points.begin(), custom_points.end());
  points.push_back({1.0, 1.0});
  std::sort(points.begin(), points.end(), [](const auto& left, const auto& right) {
    return left.x < right.x;
  });

  const double x = std::clamp(value, 0.0, 1.0);
  std::size_t segment = 0;
  while (segment + 2 < points.size() && x > points[segment + 1].x) ++segment;
  const auto& left = points[segment];
  const auto& right = points[segment + 1];
  const double width = std::max(1e-6, right.x - left.x);
  const double t = std::clamp((x - left.x) / width, 0.0, 1.0);
  const auto slope = [&](std::size_t index) {
    if (index == 0) {
      return (points[1].y - points[0].y) / std::max(1e-6, points[1].x - points[0].x);
    }
    if (index + 1 == points.size()) {
      return (points[index].y - points[index - 1].y) /
          std::max(1e-6, points[index].x - points[index - 1].x);
    }
    return (points[index + 1].y - points[index - 1].y) /
        std::max(1e-6, points[index + 1].x - points[index - 1].x);
  };
  const double m0 = slope(segment) * width;
  const double m1 = slope(segment + 1) * width;
  const double t2 = t * t;
  const double t3 = t2 * t;
  return std::clamp(
      (2.0 * t3 - 3.0 * t2 + 1.0) * left.y +
      (t3 - 2.0 * t2 + t) * m0 +
      (-2.0 * t3 + 3.0 * t2) * right.y +
      (t3 - t2) * m1,
      0.0,
      1.0);
}

bool is_identity(const image_core::Adjustment& value) {
  return value.exposure == 0.0 && value.contrast == 0.0 && value.highlights == 0.0 &&
      value.shadows == 0.0 && value.whites == 0.0 && value.blacks == 0.0 &&
      value.temperature == 0.0 && value.tint == 0.0 && value.vibrance == 0.0 &&
      value.saturation == 0.0 && value.texture == 0.0 && value.clarity == 0.0 &&
      value.dehaze == 0.0 && value.vignette == 0.0 && value.grain == 0.0 &&
      value.sharpening == 0.0 && value.luminance_noise == 0.0 && value.color_noise == 0.0 &&
      value.moire == 0.0 && value.defringe == 0.0 &&
      !value.remove_chromatic_aberration && !value.lens_correction &&
      value.curve_rgb.empty() && value.curve_red.empty() &&
      value.curve_green.empty() && value.curve_blue.empty();
}

void apply_spatial_detail(
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& bitmap) {
  const double texture = normalized(adjustment.texture);
  const double clarity = normalized(adjustment.clarity);
  const double sharpening = std::clamp(adjustment.sharpening, 0.0, 150.0) / 100.0;
  const double luminance_noise = positive_normalized(adjustment.luminance_noise);
  const double color_noise = positive_normalized(adjustment.color_noise);
  if (texture == 0.0 && clarity == 0.0 && sharpening == 0.0 &&
      luminance_noise == 0.0 && color_noise == 0.0) {
    return;
  }

  cv::Mat source(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      bitmap.pixels.data());
  cv::Mat fine_blur;
  cv::Mat local_blur;
  cv::GaussianBlur(source, fine_blur, cv::Size(0, 0), 1.0);
  cv::GaussianBlur(source, local_blur, cv::Size(0, 0), 4.0);

  for (std::uint32_t y = 0; y < bitmap.size.height; ++y) {
    auto* destination = source.ptr<cv::Vec4b>(static_cast<int>(y));
    const auto* fine = fine_blur.ptr<cv::Vec4b>(static_cast<int>(y));
    const auto* local = local_blur.ptr<cv::Vec4b>(static_cast<int>(y));
    for (std::uint32_t x = 0; x < bitmap.size.width; ++x) {
      for (int channel = 0; channel < 3; ++channel) {
        double value = destination[x][channel];
        value += (value - fine[x][channel]) * (texture * 0.8 + sharpening * 1.25);
        value += (value - local[x][channel]) * clarity * 0.65;
        const double smoothing = channel == 1 ? luminance_noise : std::max(luminance_noise, color_noise);
        value += (fine[x][channel] - value) * smoothing * 0.65;
        destination[x][channel] = cv::saturate_cast<std::uint8_t>(value);
      }
    }
  }
}

}  // namespace

image_core::Status BasicProcessor::process(
    const image_core::Bitmap& input,
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& output) {
  if (!input.valid() || input.format != image_core::PixelFormat::rgba8) {
    return {image_core::StatusCode::invalid_argument, "Processor requires a valid RGBA8 input"};
  }

  if (is_identity(adjustment)) {
    output = input;
    return image_core::Status::success();
  }

  output = input;
  const double exposure = std::pow(2.0, std::clamp(adjustment.exposure, -5.0, 5.0));
  const double contrast = normalized(adjustment.contrast);
  const double highlights = normalized(adjustment.highlights);
  const double shadows = normalized(adjustment.shadows);
  const double whites = normalized(adjustment.whites);
  const double blacks = normalized(adjustment.blacks);
  const double temperature = normalized(adjustment.temperature);
  const double tint = normalized(adjustment.tint);
  const double saturation = normalized(adjustment.saturation);
  const double vibrance = normalized(adjustment.vibrance);
  const double dehaze = normalized(adjustment.dehaze);
  const double vignette = normalized(adjustment.vignette);
  const double grain = positive_normalized(adjustment.grain);
  const double artifact_reduction =
      (positive_normalized(adjustment.moire) + positive_normalized(adjustment.defringe)) * 0.2;
  const double center_x = (output.size.width - 1) * 0.5;
  const double center_y = (output.size.height - 1) * 0.5;
  const double maximum_radius = std::max(1.0, std::sqrt(center_x * center_x + center_y * center_y));

  for (std::size_t offset = 0; offset + 3 < output.pixels.size(); offset += 4) {
    double red = input.pixels[offset] / 255.0;
    double green = input.pixels[offset + 1] / 255.0;
    double blue = input.pixels[offset + 2] / 255.0;

    red *= exposure;
    green *= exposure;
    blue *= exposure;
    red = (red - 0.5) * (1.0 + contrast) + 0.5;
    green = (green - 0.5) * (1.0 + contrast) + 0.5;
    blue = (blue - 0.5) * (1.0 + contrast) + 0.5;

    const double lightness = std::clamp(luminance(red, green, blue), 0.0, 1.0);
    const double highlight_mask = smoothstep(0.45, 1.0, lightness);
    const double shadow_mask = 1.0 - smoothstep(0.0, 0.55, lightness);
    const double white_mask = smoothstep(0.72, 1.0, lightness);
    const double black_mask = 1.0 - smoothstep(0.0, 0.28, lightness);
    const double tone_delta = highlights * highlight_mask * 0.34 +
        shadows * shadow_mask * 0.34 + whites * white_mask * 0.24 + blacks * black_mask * 0.24;
    red += tone_delta;
    green += tone_delta;
    blue += tone_delta;

    // Approximate photographic temperature/tint adaptation in linear RGB.
    red += temperature * 0.18 + tint * 0.055;
    green -= tint * 0.12;
    blue -= temperature * 0.18 - tint * 0.055;

    const double adjusted_luminance = luminance(red, green, blue);
    const double chroma = std::max({red, green, blue}) - std::min({red, green, blue});
    const double vibrance_gain = vibrance * (1.0 - std::clamp(chroma, 0.0, 1.0));
    const double color_gain = std::max(0.0, 1.0 + saturation + vibrance_gain - artifact_reduction);
    red = adjusted_luminance + (red - adjusted_luminance) * color_gain;
    green = adjusted_luminance + (green - adjusted_luminance) * color_gain;
    blue = adjusted_luminance + (blue - adjusted_luminance) * color_gain;

    // Dehaze expands local black/white separation; unlike ordinary contrast it
    // also lowers the veiling-light floor for positive values.
    red = (red - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;
    green = (green - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;
    blue = (blue - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;

    const std::size_t pixel = offset / 4;
    const double x = static_cast<double>(pixel % output.size.width) - center_x;
    const double y = static_cast<double>(pixel / output.size.width) - center_y;
    const double radius = std::sqrt(x * x + y * y) / maximum_radius;
    const double vignette_factor = 1.0 - vignette * smoothstep(0.25, 1.0, radius) * 0.72;
    red *= vignette_factor;
    green *= vignette_factor;
    blue *= vignette_factor;

    if (grain > 0.0) {
      const std::uint32_t hash = static_cast<std::uint32_t>(pixel * 1664525u + 1013904223u);
      const double noise = (static_cast<double>(hash & 0xffffu) / 65535.0 - 0.5) * grain * 0.09;
      red += noise;
      green += noise;
      blue += noise;
    }

    red = apply_curve(adjustment.curve_red, apply_curve(adjustment.curve_rgb, red));
    green = apply_curve(adjustment.curve_green, apply_curve(adjustment.curve_rgb, green));
    blue = apply_curve(adjustment.curve_blue, apply_curve(adjustment.curve_rgb, blue));

    output.pixels[offset] = static_cast<std::uint8_t>(std::clamp(red, 0.0, 1.0) * 255.0 + 0.5);
    output.pixels[offset + 1] = static_cast<std::uint8_t>(std::clamp(green, 0.0, 1.0) * 255.0 + 0.5);
    output.pixels[offset + 2] = static_cast<std::uint8_t>(std::clamp(blue, 0.0, 1.0) * 255.0 + 0.5);
  }

  apply_spatial_detail(adjustment, output);
  return image_core::Status::success();
}

}  // namespace rawelectron::processing
