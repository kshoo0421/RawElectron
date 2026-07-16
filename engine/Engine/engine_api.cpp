#include <Engine/engine_api.hpp>
#include <Codec/codec.hpp>
#include <Processing/pipeline.hpp>
#include <Renderer/renderer.hpp>

#include <cstring>

namespace rawelectron::engine {

EngineInfo EngineApi::info() const { return {"RawElectron", "0.1", true}; }

image_core::Status EngineApi::open_image(const std::string& path, image_core::ImageId& image_id) {
  if (path.empty()) {
    return {image_core::StatusCode::invalid_argument, "Image path is empty"};
  }
  image_core::Bitmap original;
  codec::ImageDecoder decoder;
  const auto decode_status = decoder.decode(path, original);
  if (!decode_status.ok()) return decode_status;
  renderer::ProxyRenderer renderer;
  image_core::Bitmap proxy;
  const auto proxy_status = renderer.render_preview(original, {2048, 2048}, proxy);
  if (!proxy_status.ok()) return proxy_status;
  std::lock_guard<std::mutex> lock(mutex_);
  image_id = next_image_id_++;
  images_.emplace(image_id, ImageDocument{path, std::move(original), std::move(proxy), {}});
  return image_core::Status::success();
}

image_core::Status EngineApi::close_image(image_core::ImageId image_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (images_.erase(image_id) == 0) {
    return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
  }
  return image_core::Status::success();
}

image_core::Status EngineApi::get_image_info(image_core::ImageId image_id, ImageInfo& info) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto found = images_.find(image_id);
  if (found == images_.end()) {
    return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
  }
  info.id = image_id;
  info.size = found->second.original.size;
  info.format = found->second.original.format;
  return image_core::Status::success();
}

image_core::Status EngineApi::set_adjustment(
    image_core::ImageId image_id,
    const image_core::Adjustment& adjustment) {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto found = images_.find(image_id);
  if (found == images_.end()) {
    return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
  }
  found->second.adjustment = adjustment;
  return image_core::Status::success();
}

image_core::Status EngineApi::get_image_state(
    image_core::ImageId image_id,
    std::string& path,
    image_core::Adjustment& adjustment) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto found = images_.find(image_id);
  if (found == images_.end()) {
    return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
  }
  path = found->second.path;
  adjustment = found->second.adjustment;
  return image_core::Status::success();
}

image_core::Status EngineApi::render_preview(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::Bitmap& output,
    PreviewSource source) {
  image_core::Bitmap input;
  image_core::Adjustment adjustment;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto found = images_.find(image_id);
    if (found == images_.end()) {
      return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
    }
    input = source == PreviewSource::original
        ? found->second.original
        : found->second.proxy;
    adjustment = found->second.adjustment;
  }
  image_core::Bitmap processed;
  // Interactive previews prioritize latency: shrink the engine-owned proxy to
  // the viewport before running adjustment stages. Original previews retain
  // the full-resolution pipeline and are resized only after processing.
  image_core::Bitmap pipeline_input;
  if (source == PreviewSource::proxy) {
    renderer::ProxyRenderer renderer;
    const auto resize_status = renderer.render_preview(input, maximum_size, pipeline_input);
    if (!resize_status.ok()) return resize_status;
  } else {
    pipeline_input = std::move(input);
  }

  processing::CpuImagePipeline pipeline;
  interfaces::PipelineContext context;
  context.purpose = interfaces::PipelinePurpose::preview;
  context.adjustment = adjustment;
  context.output_size = maximum_size;
  auto status = pipeline.execute(pipeline_input, context, processed);
  if (!status.ok()) return status;
  renderer::ProxyRenderer renderer;
  return renderer.render_preview(processed, maximum_size, output);
}

image_core::Status EngineApi::render_preview_png(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    std::vector<std::uint8_t>& output) {
  image_core::Bitmap preview;
  const auto status = render_preview(image_id, maximum_size, preview);
  if (!status.ok()) return status;
  return codec::encode_png(preview, output);
}

image_core::Status EngineApi::render_preview_into(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::BitmapView& output,
    PreviewSource source) {
  image_core::Bitmap processed;
  const auto status = render_preview(image_id, maximum_size, processed, source);
  if (!status.ok()) return status;

  const auto stride = processed.size.width * 4;
  const auto required = static_cast<std::size_t>(stride) * processed.size.height;
  if (output.data == nullptr || output.byte_length < required) {
    return {image_core::StatusCode::invalid_argument, "Shared preview storage is too small"};
  }
  std::memcpy(output.data, processed.pixels.data(), required);
  output.size = processed.size;
  output.format = processed.format;
  output.stride = stride;
  return image_core::Status::success();
}

image_core::Status EngineApi::export_image(image_core::ImageId image_id, const std::string& output_path) {
  image_core::Bitmap original;
  image_core::Adjustment adjustment;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto found = images_.find(image_id);
    if (found == images_.end()) {
      return {image_core::StatusCode::invalid_argument, "ImageId was not found"};
    }
    original = found->second.original;
    adjustment = found->second.adjustment;
  }
  image_core::Bitmap processed;
  processing::CpuImagePipeline pipeline;
  interfaces::PipelineContext context;
  context.purpose = interfaces::PipelinePurpose::export_image;
  context.adjustment = adjustment;
  const auto status = pipeline.execute(original, context, processed);
  if (!status.ok()) return status;
  return codec::encode_file(processed, output_path);
}

}  // namespace rawelectron::engine
