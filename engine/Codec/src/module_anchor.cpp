#include <rawelectron/codec/codec.hpp>

namespace rawelectron::codec {

image_core::Status StubDecoder::decode(const std::string&, image_core::Bitmap&) {
  return image_core::Status::success();
}

}  // namespace rawelectron::codec
