#pragma once

#include <rawelectron/interfaces/image_services.hpp>

namespace rawelectron::codec {

class OpenCvDecoder final : public interfaces::IDecoder {
 public:
  image_core::Status decode(const std::string& path, image_core::Bitmap& output) override;
};

image_core::Status encode_png(const image_core::Bitmap& bitmap, std::vector<std::uint8_t>& output);
image_core::Status encode_file(const image_core::Bitmap& bitmap, const std::string& output_path);

}  // namespace rawelectron::codec
