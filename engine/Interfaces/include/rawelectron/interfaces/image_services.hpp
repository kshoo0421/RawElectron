#pragma once

#include <string>

#include <rawelectron/image_core/types.hpp>

namespace rawelectron::interfaces {

class IDecoder {
 public:
  virtual ~IDecoder() = default;
  virtual image_core::Status decode(const std::string& path, image_core::Bitmap& output) = 0;
};

class IProcessor {
 public:
  virtual ~IProcessor() = default;
  virtual image_core::Status process(
      const image_core::Bitmap& input,
      const image_core::Adjustment& adjustment,
      image_core::Bitmap& output) = 0;
};

class IRenderer {
 public:
  virtual ~IRenderer() = default;
  virtual image_core::Status render_preview(
      const image_core::Bitmap& input,
      image_core::Size maximum_size,
      image_core::Bitmap& output) = 0;
  virtual image_core::Status render_preview_into(
      const image_core::Bitmap& input,
      image_core::Size maximum_size,
      image_core::BitmapView& output) = 0;
};

}  // namespace rawelectron::interfaces
