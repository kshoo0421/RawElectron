#pragma once

#include <rawelectron/interfaces/image_services.hpp>

namespace rawelectron::codec {

class StubDecoder final : public interfaces::IDecoder {
 public:
  image_core::Status decode(const std::string& path, image_core::Bitmap& output) override;
};

}  // namespace rawelectron::codec
