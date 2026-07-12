#include <rawelectron/engine/engine_api.hpp>
#include <rawelectron/codec/codec.hpp>
#include <rawelectron/processing/processor.hpp>
#include <rawelectron/renderer/renderer.hpp>

namespace rawelectron::engine {

EngineInfo EngineApi::info() const { return {"RawElectron", "0.1", true}; }

image_core::Status EngineApi::open_image(const std::string& path, image_core::ImageId& image_id) {
  if (path.empty()) {
    return {image_core::StatusCode::invalid_argument, "Image path is empty"};
  }
  image_core::Bitmap original;
  codec::OpenCvDecoder decoder;
  const auto decode_status = decoder.decode(path, original);
  if (!decode_status.ok()) return decode_status;
  std::lock_guard<std::mutex> lock(mutex_);
  image_id = next_image_id_++;
  images_.emplace(image_id, ImageDocument{path, std::move(original), {}});
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
    image_core::Bitmap& output) {
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
  processing::BasicProcessor processor;
  image_core::Bitmap processed;
  auto status = processor.process(original, adjustment, processed);
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
    image_core::BitmapView& output) {
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
  processing::BasicProcessor processor;
  image_core::Bitmap processed;
  const auto status = processor.process(original, adjustment, processed);
  if (!status.ok()) return status;
  renderer::ProxyRenderer renderer;
  return renderer.render_preview_into(processed, maximum_size, output);
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
  processing::BasicProcessor processor;
  image_core::Bitmap processed;
  const auto status = processor.process(original, adjustment, processed);
  if (!status.ok()) return status;
  return codec::encode_file(processed, output_path);
}

}  // namespace rawelectron::engine
