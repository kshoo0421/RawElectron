#pragma once

#include <string>
#include <mutex>
#include <unordered_map>

#include <rawelectron/image_core/types.hpp>

namespace rawelectron::engine {

struct EngineInfo {
  std::string name;
  std::string api_version;
  bool ready = false;
};

struct ImageInfo {
  image_core::ImageId id = 0;
  image_core::Size size;
  image_core::PixelFormat format = image_core::PixelFormat::unknown;
};

class EngineApi {
 public:
  [[nodiscard]] EngineInfo info() const;
  image_core::Status open_image(const std::string& path, image_core::ImageId& image_id);
  image_core::Status close_image(image_core::ImageId image_id);
  image_core::Status get_image_info(image_core::ImageId image_id, ImageInfo& info) const;
  image_core::Status set_adjustment(image_core::ImageId image_id, const image_core::Adjustment& adjustment);
  image_core::Status get_image_state(
      image_core::ImageId image_id,
      std::string& path,
      image_core::Adjustment& adjustment) const;
  image_core::Status render_preview(
      image_core::ImageId image_id,
      image_core::Size maximum_size,
      image_core::Bitmap& output);
  image_core::Status render_preview_png(
      image_core::ImageId image_id,
      image_core::Size maximum_size,
      std::vector<std::uint8_t>& output);
  image_core::Status render_preview_into(
      image_core::ImageId image_id,
      image_core::Size maximum_size,
      image_core::BitmapView& output);
  image_core::Status export_image(image_core::ImageId image_id, const std::string& output_path);

 private:
  struct ImageDocument {
    std::string path;
    image_core::Bitmap original;
    image_core::Adjustment adjustment;
  };

  mutable std::mutex mutex_;
  std::unordered_map<image_core::ImageId, ImageDocument> images_;
  image_core::ImageId next_image_id_ = 1;
};

}  // namespace rawelectron::engine
