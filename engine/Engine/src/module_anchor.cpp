#include <rawelectron/engine/engine_api.hpp>

namespace rawelectron::engine {

EngineInfo EngineApi::info() const { return {"RawElectron", "0.1", true}; }

image_core::Status EngineApi::open_image(const std::string&, image_core::ImageId& image_id) {
  image_id = 1;
  return image_core::Status::success();
}

image_core::Status EngineApi::set_adjustment(image_core::ImageId, const image_core::Adjustment&) {
  return image_core::Status::success();
}

image_core::Status EngineApi::render_preview(
    image_core::ImageId,
    image_core::Size,
    image_core::Bitmap&) {
  return image_core::Status::success();
}

image_core::Status EngineApi::export_image(image_core::ImageId, const std::string&) {
  return image_core::Status::success();
}

}  // namespace rawelectron::engine
