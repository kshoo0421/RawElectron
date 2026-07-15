#include <Interfaces/image_pipeline.hpp>
#include <Interfaces/engine_services.hpp>

#include <type_traits>

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

  return preview.image_id != 0 && context.output_size.has_value() ? 0 : 1;
}
