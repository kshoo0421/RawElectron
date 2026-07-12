#include <rawelectron/processing/processor.hpp>

namespace rawelectron::processing {

image_core::Status StubProcessor::process(
    const image_core::Bitmap&,
    const image_core::Adjustment&,
    image_core::Bitmap&) {
  return image_core::Status::success();
}

}  // namespace rawelectron::processing
