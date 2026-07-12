#include <rawelectron/renderer/renderer.hpp>

namespace rawelectron::renderer {

image_core::Status StubRenderer::render_preview(
    image_core::ImageId,
    image_core::Size,
    image_core::Bitmap&) {
  return image_core::Status::success();
}

}  // namespace rawelectron::renderer
