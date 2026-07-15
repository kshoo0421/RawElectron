#pragma once

#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include <ImageCore/types.hpp>

namespace rawelectron::interfaces {

using ProjectId = std::uint64_t;
using HistoryRevision = std::uint64_t;
using RenderGeneration = std::uint64_t;

enum class PreviewSource { proxy, original };
enum class RenderQuality { draft, interactive, final };
enum class ExportFormat { jpeg, png, tiff, jxr, avif };

struct ImageDescriptor {
  image_core::ImageId id = 0;
  image_core::Size size;
  image_core::PixelFormat pixel_format = image_core::PixelFormat::unknown;
  image_core::ColorSpace color_space = image_core::ColorSpace::unknown;
  std::uint16_t bit_depth = 0;
};

struct ProjectDescriptor {
  ProjectId id = 0;
  std::string name;
  std::string path;
  bool modified = false;
};

struct RenderRequest {
  image_core::ImageId image_id = 0;
  image_core::Size maximum_size;
  std::optional<image_core::Rect> region;
  PreviewSource source = PreviewSource::proxy;
  RenderQuality quality = RenderQuality::interactive;
  RenderGeneration generation = 0;
};

struct RenderResult {
  image_core::Bitmap bitmap;
  RenderGeneration generation = 0;
  PreviewSource source = PreviewSource::proxy;
};

struct ExportRequest {
  image_core::ImageId image_id = 0;
  std::string output_path;
  ExportFormat format = ExportFormat::jpeg;
  std::uint8_t quality = 90;
  bool preserve_metadata = true;
  std::optional<image_core::Size> resize_to;
};

struct MetadataEntry {
  std::string key;
  std::string value;
};

struct Metadata {
  std::vector<MetadataEntry> entries;
  std::vector<std::uint8_t> icc_profile;
};

class IProjectService {
 public:
  virtual ~IProjectService() = default;
  virtual image_core::Status create_project(
      std::string_view name, ProjectDescriptor& project) = 0;
  virtual image_core::Status open_project(
      std::string_view path, ProjectDescriptor& project) = 0;
  virtual image_core::Status save_project(ProjectId project_id, std::string_view path) = 0;
  virtual image_core::Status close_project(ProjectId project_id) = 0;
};

class IImageService {
 public:
  virtual ~IImageService() = default;
  virtual image_core::Status open_image(
      ProjectId project_id, std::string_view path, ImageDescriptor& image) = 0;
  virtual image_core::Status reload_image(image_core::ImageId image_id) = 0;
  virtual image_core::Status close_image(image_core::ImageId image_id) = 0;
  virtual image_core::Status get_image_info(
      image_core::ImageId image_id, ImageDescriptor& image) const = 0;
};

class IEditService {
 public:
  virtual ~IEditService() = default;
  virtual image_core::Status get_adjustment(
      image_core::ImageId image_id, image_core::Adjustment& adjustment) const = 0;
  virtual image_core::Status set_adjustment(
      image_core::ImageId image_id, const image_core::Adjustment& adjustment) = 0;
  virtual image_core::Status reset_adjustment(image_core::ImageId image_id) = 0;
};

class IRenderService {
 public:
  virtual ~IRenderService() = default;
  virtual image_core::Status render(const RenderRequest& request, RenderResult& result) = 0;
  virtual image_core::Status render_into(
      const RenderRequest& request, image_core::BitmapView& output) = 0;
  virtual void cancel_before(image_core::ImageId image_id, RenderGeneration generation) = 0;
};

class IExportService {
 public:
  virtual ~IExportService() = default;
  virtual image_core::Status export_image(const ExportRequest& request) = 0;
};

class IHistoryService {
 public:
  virtual ~IHistoryService() = default;
  [[nodiscard]] virtual bool can_undo(image_core::ImageId image_id) const = 0;
  [[nodiscard]] virtual bool can_redo(image_core::ImageId image_id) const = 0;
  virtual image_core::Status undo(
      image_core::ImageId image_id, HistoryRevision& revision) = 0;
  virtual image_core::Status redo(
      image_core::ImageId image_id, HistoryRevision& revision) = 0;
  virtual image_core::Status clear_history(image_core::ImageId image_id) = 0;
};

class IMetadataService {
 public:
  virtual ~IMetadataService() = default;
  virtual image_core::Status read_metadata(
      image_core::ImageId image_id, Metadata& metadata) const = 0;
  virtual image_core::Status write_metadata(
      image_core::ImageId image_id, std::span<const MetadataEntry> entries) = 0;
};

// Stable composition root exposed to IPC adapters. Implementations may provide
// all services from one object or delegate them to separate modules.
class IEngineServices {
 public:
  virtual ~IEngineServices() = default;
  [[nodiscard]] virtual IProjectService& projects() noexcept = 0;
  [[nodiscard]] virtual IImageService& images() noexcept = 0;
  [[nodiscard]] virtual IEditService& edits() noexcept = 0;
  [[nodiscard]] virtual IRenderService& renders() noexcept = 0;
  [[nodiscard]] virtual IExportService& exports() noexcept = 0;
  [[nodiscard]] virtual IHistoryService& history() noexcept = 0;
  [[nodiscard]] virtual IMetadataService& metadata() noexcept = 0;
};

}  // namespace rawelectron::interfaces
