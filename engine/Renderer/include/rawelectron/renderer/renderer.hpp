#pragma once

#include <rawelectron/interfaces/image_services.hpp>

namespace rawelectron::renderer {

class ProxyRenderer final : public interfaces::IRenderer {
 public:
  image_core::Status render_preview(
      const image_core::Bitmap& input,
      image_core::Size maximum_size,
      image_core::Bitmap& output) override;
  image_core::Status render_preview_into(
      const image_core::Bitmap& input,
      image_core::Size maximum_size,
      image_core::BitmapView& output) override;
};

}  // namespace rawelectron::renderer
