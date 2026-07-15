#include <Processing/processor.hpp>

#include <cstdlib>
#include <iostream>

using namespace rawelectron;

namespace {

image_core::Bitmap two_tone() {
  image_core::Bitmap bitmap({2, 1}, image_core::PixelFormat::rgba8);
  bitmap.pixels = {32, 32, 32, 255, 220, 220, 220, 255};
  return bitmap;
}

bool process(
    const image_core::Bitmap& input,
    const image_core::Adjustment& adjustment,
    image_core::Bitmap& output) {
  processing::BasicProcessor processor;
  return processor.process(input, adjustment, output).ok();
}

int fail(const char* message) {
  std::cerr << message << '\n';
  return EXIT_FAILURE;
}

}  // namespace

int main() {
  const auto tones = two_tone();
  image_core::Bitmap output;

  image_core::Adjustment highlights;
  highlights.highlights = 100.0;
  if (!process(tones, highlights, output)) return fail("highlight processing failed");
  const int highlight_dark_delta = output.pixels[0] - tones.pixels[0];
  const int highlight_bright_delta = output.pixels[4] - tones.pixels[4];
  if (highlight_bright_delta <= highlight_dark_delta) {
    return fail("highlights must affect bright pixels more than dark pixels");
  }

  image_core::Adjustment shadows;
  shadows.shadows = 100.0;
  if (!process(tones, shadows, output)) return fail("shadow processing failed");
  const int shadow_dark_delta = output.pixels[0] - tones.pixels[0];
  const int shadow_bright_delta = output.pixels[4] - tones.pixels[4];
  if (shadow_dark_delta <= shadow_bright_delta) {
    return fail("shadows must affect dark pixels more than bright pixels");
  }

  image_core::Adjustment temperature;
  temperature.temperature = 100.0;
  if (!process(tones, temperature, output)) return fail("temperature processing failed");
  if (output.pixels[0] <= tones.pixels[0] || output.pixels[2] >= tones.pixels[2]) {
    return fail("positive temperature must warm red and cool blue channels");
  }

  image_core::Bitmap flat({5, 5}, image_core::PixelFormat::rgba8);
  for (std::size_t offset = 0; offset < flat.pixels.size(); offset += 4) {
    flat.pixels[offset] = flat.pixels[offset + 1] = flat.pixels[offset + 2] = 160;
    flat.pixels[offset + 3] = 255;
  }
  image_core::Adjustment vignette;
  vignette.vignette = 100.0;
  if (!process(flat, vignette, output)) return fail("vignette processing failed");
  const auto corner = output.pixels[0];
  const auto center = output.pixels[(2 * 5 + 2) * 4];
  if (corner >= center) return fail("positive vignette must darken corners more than center");

  return EXIT_SUCCESS;
}
