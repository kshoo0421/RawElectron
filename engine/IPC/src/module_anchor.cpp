#include <rawelectron/ipc/engine_bridge.hpp>

namespace rawelectron::ipc {

namespace {
engine::EngineApi& engine_instance() {
  static engine::EngineApi instance;
  return instance;
}
}  // namespace

engine::EngineInfo get_engine_info() {
  return engine_instance().info();
}

image_core::Status open_image(const std::string& path, image_core::ImageId& image_id) {
  return engine_instance().open_image(path, image_id);
}

image_core::Status close_image(image_core::ImageId image_id) {
  return engine_instance().close_image(image_id);
}

image_core::Status get_image_info(image_core::ImageId image_id, engine::ImageInfo& info) {
  return engine_instance().get_image_info(image_id, info);
}

image_core::Status set_adjustment(
    image_core::ImageId image_id,
    const image_core::Adjustment& adjustment) {
  return engine_instance().set_adjustment(image_id, adjustment);
}

image_core::Status get_image_state(
    image_core::ImageId image_id,
    std::string& path,
    image_core::Adjustment& adjustment) {
  return engine_instance().get_image_state(image_id, path, adjustment);
}

image_core::Status render_preview_png(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    std::vector<std::uint8_t>& output) {
  return engine_instance().render_preview_png(image_id, maximum_size, output);
}

image_core::Status render_preview(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::Bitmap& output,
    engine::PreviewSource source) {
  return engine_instance().render_preview(image_id, maximum_size, output, source);
}

image_core::Status render_preview_into(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::BitmapView& output,
    engine::PreviewSource source) {
  return engine_instance().render_preview_into(image_id, maximum_size, output, source);
}

image_core::Status export_image(image_core::ImageId image_id, const std::string& output_path) {
  return engine_instance().export_image(image_id, output_path);
}

}  // namespace rawelectron::ipc
