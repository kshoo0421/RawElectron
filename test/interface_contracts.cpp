#include <Interfaces/image_pipeline.hpp>
#include <Interfaces/engine_services.hpp>
#include <Processing/pipeline.hpp>

#include <type_traits>
#include <array>

using namespace rawelectron;

static_assert(std::has_virtual_destructor_v<interfaces::IEngineServices>);
static_assert(std::has_virtual_destructor_v<interfaces::IPipelineStage>);
static_assert(std::has_virtual_destructor_v<interfaces::IImagePipeline>);
static_assert(static_cast<int>(interfaces::PipelineStageKind::color_initialization) <
              static_cast<int>(interfaces::PipelineStageKind::geometry));

int main() {
  interfaces::RenderRequest preview;
  preview.image_id = 1;
  preview.maximum_size = {1200, 1200};
  preview.source = interfaces::PreviewSource::proxy;

  interfaces::PipelineContext context;
  context.purpose = interfaces::PipelinePurpose::preview;
  context.output_size = preview.maximum_size;

  image_core::Bitmap input({3, 3}, image_core::PixelFormat::rgba8);
  for (std::size_t pixel = 0; pixel < 9; ++pixel) {
    input.pixels[pixel * 4] = static_cast<std::uint8_t>(32 + pixel * 20);
    input.pixels[pixel * 4 + 1] = static_cast<std::uint8_t>(64 + pixel * 12);
    input.pixels[pixel * 4 + 2] = static_cast<std::uint8_t>(160 - pixel * 10);
    input.pixels[pixel * 4 + 3] = 255;
  }
  context.adjustment.exposure = 1.0;
  context.adjustment.highlights = 50.0;
  context.adjustment.temperature = 50.0;
  context.adjustment.sharpening = 50.0;

  processing::CpuImagePipeline pipeline;
  image_core::Bitmap output;
  const auto status = pipeline.execute(input, context, output);
  const std::array expected_stages{
      interfaces::PipelineStageKind::global_adjustment,
      interfaces::PipelineStageKind::tone_adjustment,
      interfaces::PipelineStageKind::color_adjustment,
      interfaces::PipelineStageKind::detail,
  };
  const auto stages = pipeline.stages();
  bool ordered_stages = stages.size() == expected_stages.size();
  bool every_stage_changes_pixels = ordered_stages;
  for (std::size_t index = 0; ordered_stages && index < stages.size(); ++index) {
    ordered_stages = stages[index]->kind() == expected_stages[index];
    image_core::Bitmap stage_output;
    const auto stage_status = stages[index]->process(input, context, stage_output);
    every_stage_changes_pixels = every_stage_changes_pixels && stage_status.ok() &&
        stage_output.valid() && stage_output.pixels != input.pixels;
  }
  const bool pipeline_changed_pixels = status.ok() && output.valid() && output.pixels != input.pixels;
  return preview.image_id != 0 && context.output_size.has_value() && pipeline_changed_pixels &&
      ordered_stages && every_stage_changes_pixels ? 0 : 1;
}
