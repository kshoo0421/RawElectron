#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <span>
#include <string_view>

#include <ImageCore/types.hpp>

namespace rawelectron::interfaces {

enum class PipelineStageKind : std::uint8_t {
  color_initialization,
  global_adjustment,
  tone_adjustment,
  color_adjustment,
  tone_curve,
  detail,
  lut,
  geometry,
};

enum class PipelinePurpose : std::uint8_t { preview, export_image };

struct PipelineContext {
  PipelinePurpose purpose = PipelinePurpose::preview;
  image_core::Adjustment adjustment;
  image_core::ColorSpace output_color_space = image_core::ColorSpace::srgb;
  std::optional<image_core::Rect> region;
  std::optional<image_core::Size> output_size;
};

class IPipelineStage {
 public:
  virtual ~IPipelineStage() = default;
  [[nodiscard]] virtual PipelineStageKind kind() const noexcept = 0;
  [[nodiscard]] virtual std::string_view name() const noexcept = 0;
  virtual image_core::Status process(
      const image_core::Bitmap& input,
      const PipelineContext& context,
      image_core::Bitmap& output) const = 0;
};

class IImagePipeline {
 public:
  virtual ~IImagePipeline() = default;
  virtual image_core::Status execute(
      const image_core::Bitmap& input,
      const PipelineContext& context,
      image_core::Bitmap& output) const = 0;
  [[nodiscard]] virtual std::span<const std::shared_ptr<const IPipelineStage>> stages() const noexcept = 0;
};

// Builder keeps stage construction outside execution and makes test pipelines
// easy to assemble from fakes. Implementations should reject duplicate or
// out-of-order built-in stages rather than silently reordering them.
class IImagePipelineBuilder {
 public:
  virtual ~IImagePipelineBuilder() = default;
  virtual image_core::Status add_stage(std::shared_ptr<const IPipelineStage> stage) = 0;
  virtual image_core::Status build(std::unique_ptr<IImagePipeline>& pipeline) = 0;
};

}  // namespace rawelectron::interfaces
