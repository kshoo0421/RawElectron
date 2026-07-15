#include <Processing/pipeline.hpp>

#include <utility>

#include <Processing/processor.hpp>

namespace rawelectron::processing {
namespace {

class GlobalAdjustmentStage final : public interfaces::IPipelineStage {
 public:
  [[nodiscard]] interfaces::PipelineStageKind kind() const noexcept override {
    return interfaces::PipelineStageKind::global_adjustment;
  }

  [[nodiscard]] std::string_view name() const noexcept override {
    return "global-adjustment";
  }

  image_core::Status process(
      const image_core::Bitmap& input,
      const interfaces::PipelineContext& context,
      image_core::Bitmap& output) const override {
    BasicProcessor processor;
    return processor.process(input, context.adjustment, output);
  }
};

}  // namespace

CpuImagePipeline::CpuImagePipeline() {
  stages_.push_back(std::make_shared<GlobalAdjustmentStage>());
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
