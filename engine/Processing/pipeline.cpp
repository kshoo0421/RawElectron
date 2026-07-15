#include <Processing/pipeline.hpp>

#include <utility>

#include <Processing/processor.hpp>

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
  output = std::move(current);
  return image_core::Status::success();
}

std::span<const std::shared_ptr<const interfaces::IPipelineStage>>
CpuImagePipeline::stages() const noexcept {
  return stages_;
}

}  // namespace rawelectron::processing
