#pragma once

#include <Interfaces/image_pipeline.hpp>

namespace rawelectron::processing {

class CpuImagePipeline final : public interfaces::IImagePipeline {
 public:
  CpuImagePipeline();

  image_core::Status execute(
      const image_core::Bitmap& input,
      const interfaces::PipelineContext& context,
      image_core::Bitmap& output) const override;

  [[nodiscard]] std::span<const std::shared_ptr<const interfaces::IPipelineStage>>
  stages() const noexcept override;

 private:
  std::vector<std::shared_ptr<const interfaces::IPipelineStage>> stages_;
};

}  // namespace rawelectron::processing
