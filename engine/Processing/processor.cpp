#include <Processing/processor.hpp>

#include <algorithm>
#include <array>
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

std::array<double, 3> hue_color(double degrees) {
  const double hue = std::fmod(std::max(0.0, degrees), 360.0) / 60.0;
  const int sector = static_cast<int>(hue) % 6;
  const double fraction = hue - std::floor(hue);
  switch (sector) {
    case 0: return {1.0, fraction, 0.0};
    case 1: return {1.0 - fraction, 1.0, 0.0};
    case 2: return {0.0, 1.0, fraction};
    case 3: return {0.0, 1.0 - fraction, 1.0};
    case 4: return {fraction, 0.0, 1.0};
    default: return {1.0, 0.0, 1.0 - fraction};
  }
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
      value.saturation == 0.0 && value.red_hue == 0.0 && value.red_saturation == 0.0 &&
      value.green_hue == 0.0 && value.green_saturation == 0.0 &&
      value.blue_hue == 0.0 && value.blue_saturation == 0.0 &&
      value.shadow_saturation == 0.0 && value.midtone_saturation == 0.0 &&
      value.highlight_saturation == 0.0 && value.texture == 0.0 && value.clarity == 0.0 &&
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
  const double sharpening_radius = std::clamp(adjustment.sharpening_radius, 0.5, 3.0);
  const double sharpening_detail = positive_normalized(adjustment.sharpening_detail);
  const double sharpening_masking = positive_normalized(adjustment.sharpening_masking);
  const double luminance_noise = positive_normalized(adjustment.luminance_noise);
  const double luminance_detail = positive_normalized(adjustment.luminance_noise_detail);
  const double luminance_contrast = positive_normalized(adjustment.luminance_noise_contrast);
  const double color_noise = positive_normalized(adjustment.color_noise);
  const double color_detail = positive_normalized(adjustment.color_noise_detail);
  const double color_smoothness = positive_normalized(adjustment.color_noise_smoothness);
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
  cv::GaussianBlur(source, fine_blur, cv::Size(0, 0), sharpening_radius);
  cv::GaussianBlur(source, local_blur, cv::Size(0, 0), 4.0);

  for (std::uint32_t y = 0; y < bitmap.size.height; ++y) {
    auto* destination = source.ptr<cv::Vec4b>(static_cast<int>(y));
    const auto* fine = fine_blur.ptr<cv::Vec4b>(static_cast<int>(y));
    const auto* local = local_blur.ptr<cv::Vec4b>(static_cast<int>(y));
    for (std::uint32_t x = 0; x < bitmap.size.width; ++x) {
      for (int channel = 0; channel < 3; ++channel) {
        double value = destination[x][channel];
        const double edge = std::abs(value - fine[x][channel]) / 255.0;
        const double sharpen_mask = smoothstep(sharpening_masking * 0.22, sharpening_masking * 0.22 + 0.08, edge);
        value += (value - fine[x][channel]) *
            (texture * 0.8 + sharpening * (0.65 + sharpening_detail) * sharpen_mask);
        value += (value - local[x][channel]) * clarity * 0.65;
        const double luminance_smoothing = luminance_noise * (0.85 - luminance_detail * 0.45);
        const double chroma_smoothing = color_noise * (0.45 + color_smoothness * 0.5) * (1.0 - color_detail * edge);
        const double smoothing = channel == 1
            ? luminance_smoothing
            : std::max(luminance_smoothing, chroma_smoothing);
        value += (fine[x][channel] - value) * smoothing * (0.55 + luminance_contrast * edge);
        destination[x][channel] = cv::saturate_cast<std::uint8_t>(value);
      }
    }
  }
}

void apply_color_artifact_reduction(
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& bitmap) {
  const double moire = positive_normalized(adjustment.moire);
  const double defringe = positive_normalized(adjustment.defringe);
  if (moire == 0.0 && defringe == 0.0) return;

  cv::Mat rgba(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      bitmap.pixels.data());
  cv::Mat alpha;
  cv::extractChannel(rgba, alpha, 3);
  cv::Mat rgb;
  cv::cvtColor(rgba, rgb, cv::COLOR_RGBA2RGB);

  if (moire > 0.0) {
    // Moire is primarily a rapidly oscillating chroma artifact. Smooth only
    // the chroma planes so fine luminance detail remains intact.
    cv::Mat ycrcb;
    cv::cvtColor(rgb, ycrcb, cv::COLOR_RGB2YCrCb);
    std::vector<cv::Mat> planes;
    cv::split(ycrcb, planes);
    const double sigma = 0.8 + moire * 2.4;
    for (int channel = 1; channel <= 2; ++channel) {
      cv::Mat smoothed;
      cv::GaussianBlur(planes[channel], smoothed, cv::Size(0, 0), sigma);
      cv::addWeighted(
          planes[channel], 1.0 - moire * 0.82,
          smoothed, moire * 0.82,
          0.0, planes[channel]);
    }
    cv::merge(planes, ycrcb);
    cv::cvtColor(ycrcb, rgb, cv::COLOR_YCrCb2RGB);
  }

  if (defringe > 0.0) {
    // Defringe only targets strongly purple/magenta or green pixels near an
    // edge. Neutral areas and ordinary saturated colours are left alone.
    cv::Mat blurred;
    cv::GaussianBlur(rgb, blurred, cv::Size(0, 0), 1.2);
    for (int y = 0; y < rgb.rows; ++y) {
      auto* row = rgb.ptr<cv::Vec3b>(y);
      const auto* nearby = blurred.ptr<cv::Vec3b>(y);
      for (int x = 0; x < rgb.cols; ++x) {
        const double red = row[x][0] / 255.0;
        const double green = row[x][1] / 255.0;
        const double blue = row[x][2] / 255.0;
        const double local_red = nearby[x][0] / 255.0;
        const double local_green = nearby[x][1] / 255.0;
        const double local_blue = nearby[x][2] / 255.0;
        const double chroma = std::max({red, green, blue}) - std::min({red, green, blue});
        const double purple_excess = (red + blue) * 0.5 - green;
        const double green_excess = green - (red + blue) * 0.5;
        const double fringe_colour = std::max(purple_excess, green_excess);
        const double edge_delta = std::max({
            std::abs(red - local_red),
            std::abs(green - local_green),
            std::abs(blue - local_blue),
        });
        const double mask = defringe *
            smoothstep(0.04, 0.22, fringe_colour) *
            smoothstep(0.06, 0.35, chroma) *
            smoothstep(0.015, 0.16, edge_delta);
        if (mask <= 0.0) continue;
        const double local_luminance = luminance(local_red, local_green, local_blue);
        row[x][0] = cv::saturate_cast<std::uint8_t>(
            (red * (1.0 - mask) + local_luminance * mask) * 255.0);
        row[x][1] = cv::saturate_cast<std::uint8_t>(
            (green * (1.0 - mask) + local_luminance * mask) * 255.0);
        row[x][2] = cv::saturate_cast<std::uint8_t>(
            (blue * (1.0 - mask) + local_luminance * mask) * 255.0);
      }
    }
  }

  cv::cvtColor(rgb, rgba, cv::COLOR_RGB2RGBA);
  cv::insertChannel(alpha, rgba, 3);
}

void apply_lens_corrections(
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& bitmap) {
  if (!adjustment.remove_chromatic_aberration && !adjustment.lens_correction) return;
  cv::Mat rgba(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      bitmap.pixels.data());
  cv::Mat source = rgba.clone();
  const double center_x = (source.cols - 1) * 0.5;
  const double center_y = (source.rows - 1) * 0.5;
  const double scale_x = std::max(1.0, center_x);
  const double scale_y = std::max(1.0, center_y);
  cv::Mat map_x(source.rows, source.cols, CV_32F);
  cv::Mat map_y(source.rows, source.cols, CV_32F);
  for (int y = 0; y < source.rows; ++y) {
    auto* x_map = map_x.ptr<float>(y);
    auto* y_map = map_y.ptr<float>(y);
    for (int x = 0; x < source.cols; ++x) {
      const double nx = (x - center_x) / scale_x;
      const double ny = (y - center_y) / scale_y;
      const double radius2 = nx * nx + ny * ny;
      const double radial = adjustment.lens_correction ? 1.0 - 0.035 * radius2 : 1.0;
      x_map[x] = static_cast<float>(center_x + nx * radial * scale_x);
      y_map[x] = static_cast<float>(center_y + ny * radial * scale_y);
    }
  }
  cv::remap(source, rgba, map_x, map_y, cv::INTER_LINEAR, cv::BORDER_REFLECT101);

  if (adjustment.remove_chromatic_aberration) {
    std::vector<cv::Mat> channels;
    cv::split(rgba, channels);
    auto remap_channel = [&](int channel, double chroma_scale) {
      for (int y = 0; y < source.rows; ++y) {
        auto* x_map = map_x.ptr<float>(y);
        auto* y_map = map_y.ptr<float>(y);
        for (int x = 0; x < source.cols; ++x) {
          x_map[x] = static_cast<float>(center_x + (x - center_x) * chroma_scale);
          y_map[x] = static_cast<float>(center_y + (y - center_y) * chroma_scale);
        }
      }
      cv::Mat corrected;
      cv::remap(channels[channel], corrected, map_x, map_y, cv::INTER_LINEAR, cv::BORDER_REFLECT101);
      channels[channel] = std::move(corrected);
    };
    remap_channel(0, 0.9985);
    remap_channel(2, 1.0015);
    cv::merge(channels, rgba);
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
  const double red_hue = normalized(adjustment.red_hue);
  const double red_saturation = normalized(adjustment.red_saturation);
  const double green_hue = normalized(adjustment.green_hue);
  const double green_saturation = normalized(adjustment.green_saturation);
  const double blue_hue = normalized(adjustment.blue_hue);
  const double blue_saturation = normalized(adjustment.blue_saturation);
  const auto shadow_color = hue_color(adjustment.shadow_hue);
  const auto midtone_color = hue_color(adjustment.midtone_hue);
  const auto highlight_color = hue_color(adjustment.highlight_hue);
  const double shadow_saturation = positive_normalized(adjustment.shadow_saturation);
  const double midtone_saturation = positive_normalized(adjustment.midtone_saturation);
  const double highlight_saturation = positive_normalized(adjustment.highlight_saturation);
  const double grading_blending = positive_normalized(adjustment.color_grading_blending);
  const double grading_balance = normalized(adjustment.color_grading_balance);
  const double dehaze = normalized(adjustment.dehaze);
  const double vignette = normalized(adjustment.vignette);
  const double vignette_midpoint = positive_normalized(adjustment.vignette_midpoint);
  const double vignette_roundness = normalized(adjustment.vignette_roundness);
  const double vignette_feather = positive_normalized(adjustment.vignette_feather);
  const double vignette_highlights = positive_normalized(adjustment.vignette_highlights);
  const double grain = positive_normalized(adjustment.grain);
  const double grain_size = std::max(0.25, positive_normalized(adjustment.grain_size) * 4.0);
  const double grain_roughness = positive_normalized(adjustment.grain_roughness);
  const double center_x = (output.size.width - 1) * 0.5;
  const double center_y = (output.size.height - 1) * 0.5;
  const bool has_tone = highlights != 0.0 || shadows != 0.0 || whites != 0.0 || blacks != 0.0;
  const bool has_white_balance = temperature != 0.0 || tint != 0.0;
  const bool has_saturation = saturation != 0.0 || vibrance != 0.0;
  const bool has_channel_mixer = red_hue != 0.0 || red_saturation != 0.0 ||
      green_hue != 0.0 || green_saturation != 0.0 || blue_hue != 0.0 || blue_saturation != 0.0;
  const bool has_grading = shadow_saturation != 0.0 || midtone_saturation != 0.0 ||
      highlight_saturation != 0.0;
  const bool has_curves = !adjustment.curve_rgb.empty() || !adjustment.curve_red.empty() ||
      !adjustment.curve_green.empty() || !adjustment.curve_blue.empty();
  const bool has_basic_pixel_adjustment = exposure != 1.0 || contrast != 0.0 || has_tone ||
      has_white_balance || has_saturation || has_channel_mixer || has_grading || dehaze != 0.0 ||
      vignette != 0.0 || grain != 0.0 || has_curves;

  if (has_basic_pixel_adjustment) {
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

    if (has_tone) {
      const double lightness = std::clamp(luminance(red, green, blue), 0.0, 1.0);
      const double highlight_mask = highlights == 0.0 ? 0.0 : smoothstep(0.45, 1.0, lightness);
      const double shadow_mask = shadows == 0.0 ? 0.0 : 1.0 - smoothstep(0.0, 0.55, lightness);
      const double white_mask = whites == 0.0 ? 0.0 : smoothstep(0.72, 1.0, lightness);
      const double black_mask = blacks == 0.0 ? 0.0 : 1.0 - smoothstep(0.0, 0.28, lightness);
      const double tone_delta = highlights * highlight_mask * 0.34 +
          shadows * shadow_mask * 0.34 + whites * white_mask * 0.24 + blacks * black_mask * 0.24;
      red += tone_delta;
      green += tone_delta;
      blue += tone_delta;
    }

    // Approximate photographic temperature/tint adaptation in linear RGB.
    if (has_white_balance) {
      red += temperature * 0.18 + tint * 0.055;
      green -= tint * 0.12;
      blue -= temperature * 0.18 - tint * 0.055;
    }

    if (has_saturation) {
      const double adjusted_luminance = luminance(red, green, blue);
      const double chroma = std::max({red, green, blue}) - std::min({red, green, blue});
      const double vibrance_gain = vibrance * (1.0 - std::clamp(chroma, 0.0, 1.0));
      const double color_gain = std::max(0.0, 1.0 + saturation + vibrance_gain);
      red = adjusted_luminance + (red - adjusted_luminance) * color_gain;
      green = adjusted_luminance + (green - adjusted_luminance) * color_gain;
      blue = adjusted_luminance + (blue - adjusted_luminance) * color_gain;
    }

    if (has_channel_mixer) {
      const double adjusted_luminance = luminance(red, green, blue);
      const double channel_total = std::max(1e-6, std::max(0.0, red) + std::max(0.0, green) + std::max(0.0, blue));
      const double red_weight = std::max(0.0, red) / channel_total;
      const double green_weight = std::max(0.0, green) / channel_total;
      const double blue_weight = std::max(0.0, blue) / channel_total;
      red += red_weight * red_hue * (blue - green) * 0.45;
      green += green_weight * green_hue * (red - blue) * 0.45;
      blue += blue_weight * blue_hue * (green - red) * 0.45;
      red = adjusted_luminance + (red - adjusted_luminance) * (1.0 + red_saturation * red_weight);
      green = adjusted_luminance + (green - adjusted_luminance) * (1.0 + green_saturation * green_weight);
      blue = adjusted_luminance + (blue - adjusted_luminance) * (1.0 + blue_saturation * blue_weight);
    }

    if (has_grading) {
    const double grade_luminance = std::clamp(luminance(red, green, blue), 0.0, 1.0);
    const double split = grading_balance * 0.18;
    const double shadow_weight = 1.0 - smoothstep(0.05 + split, 0.55 + split, grade_luminance);
    const double highlight_weight = smoothstep(0.45 + split, 0.95 + split, grade_luminance);
    const double midtone_weight = std::max(0.0, 1.0 - shadow_weight - highlight_weight) *
        (0.65 + grading_blending * 0.35);
    const auto grade_channel = [&](int channel) {
      return shadow_color[channel] * shadow_saturation * shadow_weight +
          midtone_color[channel] * midtone_saturation * midtone_weight +
          highlight_color[channel] * highlight_saturation * highlight_weight;
    };
    const double grade_amount = shadow_saturation * shadow_weight +
        midtone_saturation * midtone_weight + highlight_saturation * highlight_weight;
    if (grade_amount > 0.0) {
      red = red * (1.0 - std::min(0.45, grade_amount * 0.35)) + grade_channel(0) * grade_luminance * 0.35;
      green = green * (1.0 - std::min(0.45, grade_amount * 0.35)) + grade_channel(1) * grade_luminance * 0.35;
      blue = blue * (1.0 - std::min(0.45, grade_amount * 0.35)) + grade_channel(2) * grade_luminance * 0.35;
    }
    }

    // Dehaze expands local black/white separation; unlike ordinary contrast it
    // also lowers the veiling-light floor for positive values.
    if (dehaze != 0.0) {
      red = (red - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;
      green = (green - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;
      blue = (blue - 0.45) * (1.0 + dehaze * 0.9) + 0.45 - dehaze * 0.035;
    }

    const std::size_t pixel = offset / 4;
    if (vignette != 0.0) {
    const double x = static_cast<double>(pixel % output.size.width) - center_x;
    const double y = static_cast<double>(pixel / output.size.width) - center_y;
    const double normalized_x = std::abs(x) / std::max(1.0, center_x);
    const double normalized_y = std::abs(y) / std::max(1.0, center_y);
    const double round_power = 2.0 + vignette_roundness * 1.5;
    const double radius = std::pow(
        (std::pow(normalized_x, round_power) + std::pow(normalized_y, round_power)) * 0.5,
        1.0 / round_power);
    const double vignette_start = 0.15 + vignette_midpoint * 0.65;
    const double vignette_end = std::min(1.0, vignette_start + 0.08 + vignette_feather * 0.55);
    const double highlight_protection = 1.0 - vignette_highlights *
        smoothstep(0.55, 1.0, luminance(red, green, blue));
    const double vignette_factor = 1.0 - vignette *
        smoothstep(vignette_start, vignette_end, radius) * 0.72 * highlight_protection;
    red *= vignette_factor;
    green *= vignette_factor;
    blue *= vignette_factor;
    }

    if (grain > 0.0) {
      const auto grain_x = static_cast<std::uint32_t>((pixel % output.size.width) / grain_size);
      const auto grain_y = static_cast<std::uint32_t>((pixel / output.size.width) / grain_size);
      const std::uint32_t hash = (grain_x * 73856093u) ^ (grain_y * 19349663u) ^ 1013904223u;
      const double noise = (static_cast<double>(hash & 0xffffu) / 65535.0 - 0.5) *
          grain * (0.055 + grain_roughness * 0.07);
      red += noise;
      green += noise;
      blue += noise;
    }

    if (has_curves) {
      red = apply_curve(adjustment.curve_red, apply_curve(adjustment.curve_rgb, red));
      green = apply_curve(adjustment.curve_green, apply_curve(adjustment.curve_rgb, green));
      blue = apply_curve(adjustment.curve_blue, apply_curve(adjustment.curve_rgb, blue));
    }

    output.pixels[offset] = static_cast<std::uint8_t>(std::clamp(red, 0.0, 1.0) * 255.0 + 0.5);
    output.pixels[offset + 1] = static_cast<std::uint8_t>(std::clamp(green, 0.0, 1.0) * 255.0 + 0.5);
    output.pixels[offset + 2] = static_cast<std::uint8_t>(std::clamp(blue, 0.0, 1.0) * 255.0 + 0.5);
  }
  }

  apply_color_artifact_reduction(adjustment, output);
  apply_lens_corrections(adjustment, output);
  apply_spatial_detail(adjustment, output);
  return image_core::Status::success();
}

}  // namespace rawelectron::processing
