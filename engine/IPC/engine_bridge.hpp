#pragma once

#include <Engine/engine_api.hpp>

namespace rawelectron::ipc {

engine::EngineInfo get_engine_info();
image_core::Status open_image(const std::string& path, image_core::ImageId& image_id);
image_core::Status close_image(image_core::ImageId image_id);
image_core::Status get_image_info(image_core::ImageId image_id, engine::ImageInfo& info);
image_core::Status set_adjustment(image_core::ImageId image_id, const image_core::Adjustment& adjustment);
image_core::Status get_image_state(
    image_core::ImageId image_id,
    std::string& path,
    image_core::Adjustment& adjustment);
image_core::Status render_preview_png(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    std::vector<std::uint8_t>& output);
image_core::Status render_preview(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::Bitmap& output,
    engine::PreviewSource source = engine::PreviewSource::proxy);
image_core::Status render_preview_into(
    image_core::ImageId image_id,
    image_core::Size maximum_size,
    image_core::BitmapView& output,
    engine::PreviewSource source = engine::PreviewSource::proxy);
image_core::Status export_image(image_core::ImageId image_id, const std::string& output_path);

}  // namespace rawelectron::ipc
