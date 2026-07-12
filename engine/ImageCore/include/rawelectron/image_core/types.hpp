#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace rawelectron::image_core {

enum class StatusCode { ok, invalid_argument, not_implemented, internal_error };

struct Status {
  StatusCode code = StatusCode::ok;
  std::string message;

  [[nodiscard]] bool ok() const noexcept { return code == StatusCode::ok; }
  static Status success() { return {}; }
};

struct Size {
  std::uint32_t width = 0;
  std::uint32_t height = 0;
};

struct Rect {
  std::int32_t x = 0;
  std::int32_t y = 0;
  std::uint32_t width = 0;
  std::uint32_t height = 0;
};

enum class PixelFormat { unknown, rgba8, rgba16, rgba32_float };

struct Bitmap {
  Size size;
  PixelFormat format = PixelFormat::unknown;
  std::vector<std::uint8_t> pixels;
};

struct Adjustment {
  double exposure = 0.0;
  double contrast = 0.0;
  double saturation = 0.0;
};

using ImageId = std::uint64_t;

}  // namespace rawelectron::image_core
