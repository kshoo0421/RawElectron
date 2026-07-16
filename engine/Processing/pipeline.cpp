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

class AdjustmentStage final : public interfaces::IPipelineStage {
 public:
  AdjustmentStage(
      interfaces::PipelineStageKind stage_kind,
      std::string_view stage_name,
      AdjustmentSelector selector)
      : kind_(stage_kind), name_(stage_name), selector_(selector) {}

  [[nodiscard]] interfaces::PipelineStageKind kind() const noexcept override { return kind_; }
  [[nodiscard]] std::string_view name() const noexcept override { return name_; }

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
  result.grain = source.grain;
  result.sharpening = source.sharpening;
  result.luminance_noise = source.luminance_noise;
  result.color_noise = source.color_noise;
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

  image_core::Bitmap current = input;
  for (const auto& stage : stages_) {
    image_core::Bitmap next;
    const auto status = stage->process(current, context, next);
    if (!status.ok()) return status;
    current = std::move(next);
  }
  apply_geometry(context.adjustment, current);
  output = std::move(current);
  return image_core::Status::success();
}

std::span<const std::shared_ptr<const interfaces::IPipelineStage>>
CpuImagePipeline::stages() const noexcept {
  return stages_;
}

}  // namespace rawelectron::processing
