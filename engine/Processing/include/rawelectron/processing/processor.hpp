#pragma once

#include <rawelectron/interfaces/image_services.hpp>

namespace rawelectron::processing {

class BasicProcessor final : public interfaces::IProcessor {
 public:
  image_core::Status process(
      const image_core::Bitmap& input,
      const image_core::Adjustment& adjustment,
      image_core::Bitmap& output) override;
};

}  // namespace rawelectron::processing
