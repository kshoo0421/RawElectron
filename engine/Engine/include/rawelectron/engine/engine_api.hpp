#pragma once

#include <string>

#include <rawelectron/image_core/types.hpp>

namespace rawelectron::engine {

struct EngineInfo {
  std::string name;
  std::string api_version;
  bool ready = false;
};

class EngineApi {
 public:
  [[nodiscard]] EngineInfo info() const;
  image_core::Status open_image(const std::string& path, image_core::ImageId& image_id);
  image_core::Status set_adjustment(image_core::ImageId image_id, const image_core::Adjustment& adjustment);
  image_core::Status render_preview(
      image_core::ImageId image_id,
      image_core::Size maximum_size,
      image_core::Bitmap& output);
  image_core::Status export_image(image_core::ImageId image_id, const std::string& output_path);
};

}  // namespace rawelectron::engine
