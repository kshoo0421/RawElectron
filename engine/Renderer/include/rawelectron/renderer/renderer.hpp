#pragma once

#include <rawelectron/interfaces/image_services.hpp>

namespace rawelectron::renderer {

class StubRenderer final : public interfaces::IRenderer {
 public:
  image_core::Status render_preview(
      image_core::ImageId image_id,
      image_core::Size maximum_size,
      image_core::Bitmap& output) override;
};

}  // namespace rawelectron::renderer
