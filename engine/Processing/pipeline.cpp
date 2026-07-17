#include <Processing/pipeline.hpp>

#include <algorithm>
#include <cmath>
#include <utility>

#include <Processing/processor.hpp>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

namespace rawelectron::processing {
namespace {

using AdjustmentSelector = image_core::Adjustment (*)(const image_core::Adjustment&);
bool has_pixel_adjustment(const image_core::Adjustment& value);

class AdjustmentStage final : public interfaces::IPipelineStage {
 public:
  AdjustmentStage(
      interfaces::PipelineStageKind stage_kind,
      std::string_view stage_name,
      AdjustmentSelector selector)
      : kind_(stage_kind), name_(stage_name), selector_(selector) {}

  [[nodiscard]] interfaces::PipelineStageKind kind() const noexcept override { return kind_; }
  [[nodiscard]] std::string_view name() const noexcept override { return name_; }
  [[nodiscard]] bool active(const interfaces::PipelineContext& context) const override {
    return has_pixel_adjustment(selector_(context.adjustment));
  }

  image_core::Status process(
      const image_core::Bitmap& input,
      const interfaces::PipelineContext& context,
      image_core::Bitmap& output) const override {
    BasicProcessor processor;
    return processor.process(input, selector_(context.adjustment), output);
  }

 private:
  interfaces::PipelineStageKind kind_;
  std::string_view name_;
  AdjustmentSelector selector_;
};

bool has_pixel_adjustment(const image_core::Adjustment& value) {
  return value.exposure != 0.0 || value.contrast != 0.0 || value.highlights != 0.0 ||
      value.shadows != 0.0 || value.whites != 0.0 || value.blacks != 0.0 ||
      value.temperature != 0.0 || value.tint != 0.0 || value.vibrance != 0.0 ||
      value.saturation != 0.0 || value.red_hue != 0.0 || value.red_saturation != 0.0 ||
      value.green_hue != 0.0 || value.green_saturation != 0.0 ||
      value.blue_hue != 0.0 || value.blue_saturation != 0.0 ||
      value.shadow_saturation != 0.0 || value.midtone_saturation != 0.0 ||
      value.highlight_saturation != 0.0 || value.texture != 0.0 || value.clarity != 0.0 ||
      value.dehaze != 0.0 || value.vignette != 0.0 || value.grain != 0.0 ||
      value.sharpening != 0.0 || value.luminance_noise != 0.0 || value.color_noise != 0.0 ||
      value.moire != 0.0 || value.defringe != 0.0 || value.remove_chromatic_aberration ||
      value.lens_correction || !value.curve_rgb.empty() || !value.curve_red.empty() ||
      !value.curve_green.empty() || !value.curve_blue.empty();
}

image_core::Adjustment select_global(const image_core::Adjustment& source) {
  image_core::Adjustment result;
  result.exposure = source.exposure;
  result.contrast = source.contrast;
  result.dehaze = source.dehaze;
  return result;
}

image_core::Adjustment select_tone(const image_core::Adjustment& source) {
  image_core::Adjustment result;
  result.highlights = source.highlights;
  result.shadows = source.shadows;
  result.whites = source.whites;
  result.blacks = source.blacks;
  return result;
}

image_core::Adjustment select_color(const image_core::Adjustment& source) {
  image_core::Adjustment result;
  result.temperature = source.temperature;
  result.tint = source.tint;
  result.vibrance = source.vibrance;
  result.saturation = source.saturation;
  result.red_hue = source.red_hue;
  result.red_saturation = source.red_saturation;
  result.green_hue = source.green_hue;
  result.green_saturation = source.green_saturation;
  result.blue_hue = source.blue_hue;
  result.blue_saturation = source.blue_saturation;
  result.shadow_hue = source.shadow_hue;
  result.shadow_saturation = source.shadow_saturation;
  result.midtone_hue = source.midtone_hue;
  result.midtone_saturation = source.midtone_saturation;
  result.highlight_hue = source.highlight_hue;
  result.highlight_saturation = source.highlight_saturation;
  result.color_grading_blending = source.color_grading_blending;
  result.color_grading_balance = source.color_grading_balance;
  result.moire = source.moire;
  result.defringe = source.defringe;
  result.remove_chromatic_aberration = source.remove_chromatic_aberration;
  result.curve_rgb = source.curve_rgb;
  result.curve_red = source.curve_red;
  result.curve_green = source.curve_green;
  result.curve_blue = source.curve_blue;
  return result;
}

image_core::Adjustment select_detail(const image_core::Adjustment& source) {
  image_core::Adjustment result;
  result.texture = source.texture;
  result.clarity = source.clarity;
  result.vignette = source.vignette;
  result.vignette_midpoint = source.vignette_midpoint;
  result.vignette_roundness = source.vignette_roundness;
  result.vignette_feather = source.vignette_feather;
  result.vignette_highlights = source.vignette_highlights;
  result.grain = source.grain;
  result.grain_size = source.grain_size;
  result.grain_roughness = source.grain_roughness;
  result.sharpening = source.sharpening;
  result.sharpening_radius = source.sharpening_radius;
  result.sharpening_detail = source.sharpening_detail;
  result.sharpening_masking = source.sharpening_masking;
  result.luminance_noise = source.luminance_noise;
  result.luminance_noise_detail = source.luminance_noise_detail;
  result.luminance_noise_contrast = source.luminance_noise_contrast;
  result.color_noise = source.color_noise;
  result.color_noise_detail = source.color_noise_detail;
  result.color_noise_smoothness = source.color_noise_smoothness;
  result.lens_correction = source.lens_correction;
  return result;
}

void apply_geometry(const image_core::Adjustment& adjustment, image_core::Bitmap& bitmap) {
  if (!adjustment.crop_enabled || !bitmap.valid()) return;
  cv::Mat current(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      bitmap.pixels.data());
  cv::Mat transformed = current.clone();

  const int turns = ((adjustment.quarter_turns % 4) + 4) % 4;
  if (turns == 1) cv::rotate(transformed, transformed, cv::ROTATE_90_CLOCKWISE);
  else if (turns == 2) cv::rotate(transformed, transformed, cv::ROTATE_180);
  else if (turns == 3) cv::rotate(transformed, transformed, cv::ROTATE_90_COUNTERCLOCKWISE);

  if (adjustment.flip_horizontal || adjustment.flip_vertical) {
    const int flip_code = adjustment.flip_horizontal && adjustment.flip_vertical
        ? -1 : adjustment.flip_horizontal ? 1 : 0;
    cv::flip(transformed, transformed, flip_code);
  }

  if (std::abs(adjustment.rotation) > 0.001) {
    const cv::Point2f center(
        static_cast<float>(transformed.cols) * 0.5F,
        static_cast<float>(transformed.rows) * 0.5F);
    cv::Mat matrix = cv::getRotationMatrix2D(center, adjustment.rotation, 1.0);
    const double radians = std::abs(adjustment.rotation) * CV_PI / 180.0;
    const int expanded_width = std::max(
        1,
        static_cast<int>(std::ceil(
            transformed.cols * std::cos(radians) + transformed.rows * std::sin(radians))));
    const int expanded_height = std::max(
        1,
        static_cast<int>(std::ceil(
            transformed.cols * std::sin(radians) + transformed.rows * std::cos(radians))));
    matrix.at<double>(0, 2) += (expanded_width - transformed.cols) * 0.5;
    matrix.at<double>(1, 2) += (expanded_height - transformed.rows) * 0.5;
    cv::Mat rotated;
    cv::warpAffine(
        transformed,
        rotated,
        matrix,
        cv::Size(expanded_width, expanded_height),
        cv::INTER_LINEAR,
        cv::BORDER_CONSTANT,
        cv::Scalar(0, 0, 0, 255));
    transformed = std::move(rotated);
  }

  if (adjustment.apply_crop) {
    const int x = std::clamp(
        static_cast<int>(std::round(adjustment.crop_x * transformed.cols)),
        0,
        std::max(0, transformed.cols - 1));
    const int y = std::clamp(
        static_cast<int>(std::round(adjustment.crop_y * transformed.rows)),
        0,
        std::max(0, transformed.rows - 1));
    const int width = std::clamp(
        static_cast<int>(std::round(adjustment.crop_width * transformed.cols)),
        1,
        transformed.cols - x);
    const int height = std::clamp(
        static_cast<int>(std::round(adjustment.crop_height * transformed.rows)),
        1,
        transformed.rows - y);
    transformed = transformed(cv::Rect(x, y, width, height)).clone();
  }

  bitmap.reset(
      {static_cast<std::uint32_t>(transformed.cols), static_cast<std::uint32_t>(transformed.rows)},
      image_core::PixelFormat::rgba8,
      bitmap.color_space);
  std::copy(transformed.datastart, transformed.dataend, bitmap.pixels.begin());
}

}  // namespace

CpuImagePipeline::CpuImagePipeline() {
  stages_.push_back(std::make_shared<AdjustmentStage>(
      interfaces::PipelineStageKind::global_adjustment, "global-adjustment", select_global));
  stages_.push_back(std::make_shared<AdjustmentStage>(
      interfaces::PipelineStageKind::tone_adjustment, "tone-adjustment", select_tone));
  stages_.push_back(std::make_shared<AdjustmentStage>(
      interfaces::PipelineStageKind::color_adjustment, "color-adjustment", select_color));
  stages_.push_back(std::make_shared<AdjustmentStage>(
      interfaces::PipelineStageKind::detail, "detail-adjustment", select_detail));
}

image_core::Status CpuImagePipeline::execute(
    const image_core::Bitmap& input,
    const interfaces::PipelineContext& context,
    image_core::Bitmap& output) const {
  if (!input.valid()) {
    return {image_core::StatusCode::invalid_argument, "Pipeline requires a valid bitmap"};
  }

  // BasicProcessor already supports the complete adjustment model. Running it
  // once avoids four full-frame copies and four generic pixel passes for the
  // light, tone, colour and detail stage metadata exposed by stages().
  image_core::Bitmap current;
  BasicProcessor processor;
  const auto processing_status = processor.process(input, context.adjustment, current);
  if (!processing_status.ok()) return processing_status;
  apply_geometry(context.adjustment, current);
  output = std::move(current);
  return image_core::Status::success();
}

std::span<const std::shared_ptr<const interfaces::IPipelineStage>>
CpuImagePipeline::stages() const noexcept {
  return stages_;
}

}  // namespace rawelectron::processing
