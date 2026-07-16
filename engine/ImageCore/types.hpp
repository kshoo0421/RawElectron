#pragma once

#include <array>
#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>

namespace rawelectron::image_core {

enum class StatusCode { ok, invalid_argument, unsupported_format, memory_error, not_implemented, internal_error };

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

enum class ColorSpace { unknown, srgb, linear_srgb, display_p3, rec2020 };

[[nodiscard]] constexpr std::size_t bytes_per_pixel(PixelFormat format) noexcept {
  switch (format) {
    case PixelFormat::rgba8: return 4;
    case PixelFormat::rgba16: return 8;
    case PixelFormat::rgba32_float: return 16;
    default: return 0;
  }
}

// Engine-owned, tightly packed working image. Codec-specific buffers must be
// converted into this representation before leaving the Codec module.
class Bitmap {
 public:
  Size size;
  PixelFormat format = PixelFormat::unknown;
  ColorSpace color_space = ColorSpace::unknown;
  std::uint16_t bit_depth = 0;
  std::vector<std::uint8_t> pixels;

  Bitmap() = default;
  Bitmap(Size bitmap_size, PixelFormat pixel_format, ColorSpace space = ColorSpace::srgb) {
    reset(bitmap_size, pixel_format, space);
  }

  void reset(Size bitmap_size, PixelFormat pixel_format, ColorSpace space = ColorSpace::srgb) {
    size = bitmap_size;
    format = pixel_format;
    color_space = space;
    bit_depth = pixel_format == PixelFormat::rgba8 ? 8 : pixel_format == PixelFormat::rgba16 ? 16 :
        pixel_format == PixelFormat::rgba32_float ? 32 : 0;
    pixels.assign(byte_size(), 0);
  }

  void clear() noexcept {
    size = {};
    format = PixelFormat::unknown;
    color_space = ColorSpace::unknown;
    bit_depth = 0;
    pixels.clear();
  }

  [[nodiscard]] std::size_t stride() const noexcept {
    return static_cast<std::size_t>(size.width) * bytes_per_pixel(format);
  }
  [[nodiscard]] std::size_t byte_size() const noexcept {
    return stride() * static_cast<std::size_t>(size.height);
  }
  [[nodiscard]] bool valid() const noexcept {
    return size.width != 0 && size.height != 0 && bytes_per_pixel(format) != 0 && pixels.size() == byte_size();
  }
};

// Non-owning view used at the JS/C++ boundary. The JavaScript ArrayBuffer owns
// the storage; native calls may use this view only for the duration of a call.
struct BitmapView {
  Size size;
  PixelFormat format = PixelFormat::rgba8;
  std::uint32_t stride = 0;
  std::uint8_t* data = nullptr;
  std::size_t byte_length = 0;

  [[nodiscard]] bool valid() const noexcept {
    const auto minimum_stride = static_cast<std::size_t>(size.width) * bytes_per_pixel(format);
    return data != nullptr && size.width != 0 && size.height != 0 && stride >= minimum_stride &&
        byte_length >= static_cast<std::size_t>(stride) * size.height;
  }
};

struct Adjustment {
  double exposure = 0.0;
  double contrast = 0.0;
  double highlights = 0.0;
  double shadows = 0.0;
  double whites = 0.0;
  double blacks = 0.0;
  double temperature = 0.0;
  double tint = 0.0;
  double vibrance = 0.0;
  double saturation = 0.0;
  double texture = 0.0;
  double clarity = 0.0;
  double dehaze = 0.0;
  double vignette = 0.0;
  double grain = 0.0;
  double sharpening = 0.0;
  double luminance_noise = 0.0;
  double color_noise = 0.0;
  double moire = 0.0;
  double defringe = 0.0;
  bool remove_chromatic_aberration = false;
  bool lens_correction = false;
  std::array<double, 5> curve_rgb = {0.0, 0.25, 0.5, 0.75, 1.0};
  std::array<double, 5> curve_red = {0.0, 0.25, 0.5, 0.75, 1.0};
  std::array<double, 5> curve_green = {0.0, 0.25, 0.5, 0.75, 1.0};
  std::array<double, 5> curve_blue = {0.0, 0.25, 0.5, 0.75, 1.0};
};

using ImageId = std::uint64_t;

}  // namespace rawelectron::image_core
