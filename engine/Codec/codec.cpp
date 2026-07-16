#include <Codec/codec.hpp>

#include <algorithm>
#include <array>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string_view>

#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

#ifdef RAWELECTRON_WITH_LIBRAW
#include <libraw/libraw.h>
#endif
#ifdef RAWELECTRON_WITH_JXR
#include <JXRGlue.h>
#endif
#ifdef RAWELECTRON_WITH_AVIF
#include <avif/avif.h>
#endif

namespace rawelectron::codec {

namespace {
std::filesystem::path utf8_path(const std::string& value) {
  const std::u8string utf8(
      reinterpret_cast<const char8_t*>(value.data()),
      reinterpret_cast<const char8_t*>(value.data() + value.size()));
  return std::filesystem::path(utf8);
}

image_core::Status read_file(const std::string& path, std::vector<std::uint8_t>& bytes) {
  std::ifstream stream(utf8_path(path), std::ios::binary);
  if (!stream) {
    return {image_core::StatusCode::invalid_argument, "Failed to open image file"};
  }
  bytes.assign(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
  if (bytes.empty()) {
    return {image_core::StatusCode::invalid_argument, "Image file is empty"};
  }
  return image_core::Status::success();
}

image_core::Status write_file(const std::string& path, const std::vector<std::uint8_t>& bytes) {
  std::ofstream stream(utf8_path(path), std::ios::binary | std::ios::trunc);
  if (!stream) {
    return {image_core::StatusCode::internal_error, "Failed to open output file"};
  }
  stream.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  if (!stream) {
    return {image_core::StatusCode::internal_error, "Failed to write output file"};
  }
  return image_core::Status::success();
}
}  // namespace

image_core::Status ImageDecoder::decode(const std::string& path, image_core::Bitmap& output) {
  output.clear();
  std::vector<std::uint8_t> file_bytes;
  const auto read_status = read_file(path, file_bytes);
  if (!read_status.ok()) return read_status;

  const auto extension = utf8_path(path).extension().u8string();
  std::string lowered_extension(extension.begin(), extension.end());
  std::transform(lowered_extension.begin(), lowered_extension.end(), lowered_extension.begin(), [](unsigned char value) {
    return static_cast<char>(std::tolower(value));
  });

#ifdef RAWELECTRON_WITH_AVIF
  if (lowered_extension == ".avif") {
    avifDecoder* decoder = avifDecoderCreate();
    if (!decoder) return {image_core::StatusCode::internal_error, "Failed to create AVIF decoder"};
    avifResult result = avifDecoderSetIOMemory(decoder, file_bytes.data(), file_bytes.size());
    if (result == AVIF_RESULT_OK) result = avifDecoderParse(decoder);
    if (result == AVIF_RESULT_OK) result = avifDecoderNextImage(decoder);
    if (result != AVIF_RESULT_OK || !decoder->image) {
      const std::string message = std::string("AVIF decode failed: ") + avifResultToString(result);
      avifDecoderDestroy(decoder);
      return {image_core::StatusCode::invalid_argument, message};
    }
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, decoder->image);
    rgb.format = AVIF_RGB_FORMAT_RGBA;
    rgb.depth = 8;
    result = avifRGBImageAllocatePixels(&rgb);
    if (result == AVIF_RESULT_OK) result = avifImageYUVToRGB(decoder->image, &rgb);
    if (result != AVIF_RESULT_OK) {
      avifRGBImageFreePixels(&rgb);
      avifDecoderDestroy(decoder);
      return {image_core::StatusCode::invalid_argument, std::string("AVIF RGB conversion failed: ") + avifResultToString(result)};
    }
    const size_t row_size = static_cast<size_t>(decoder->image->width) * 4;
    output.reset({decoder->image->width, decoder->image->height}, image_core::PixelFormat::rgba8);
    for (std::uint32_t row = 0; row < decoder->image->height; ++row) {
      std::copy_n(rgb.pixels + static_cast<size_t>(row) * rgb.rowBytes, row_size,
                  output.pixels.data() + static_cast<size_t>(row) * row_size);
    }
    avifRGBImageFreePixels(&rgb);
    avifDecoderDestroy(decoder);
    return image_core::Status::success();
  }
#endif

#ifdef RAWELECTRON_WITH_JXR
  if (lowered_extension == ".jxr" || lowered_extension == ".wdp" || lowered_extension == ".hdp") {
    PKFactory* factory = nullptr;
    PKCodecFactory* codec_factory = nullptr;
    WMPStream* stream = nullptr;
    PKImageDecode* decoder = nullptr;
    PKFormatConverter* converter = nullptr;
    auto release = [&]() {
      if (converter) converter->Release(&converter);
      if (decoder) decoder->Release(&decoder);
      if (stream) stream->Close(&stream);
      if (codec_factory) codec_factory->Release(&codec_factory);
      if (factory) factory->Release(&factory);
    };
    ERR error = PKCreateFactory(&factory, PK_SDK_VERSION);
    if (error == WMP_errSuccess) error = PKCreateCodecFactory(&codec_factory, WMP_SDK_VERSION);
    if (error == WMP_errSuccess) error = factory->CreateStreamFromMemory(&stream, file_bytes.data(), file_bytes.size());
    if (error == WMP_errSuccess) error = PKImageDecode_Create_WMP(&decoder);
    if (error == WMP_errSuccess) error = decoder->Initialize(decoder, stream);
    if (error == WMP_errSuccess) error = codec_factory->CreateFormatConverter(&converter);
    char output_extension[] = ".bmp";
    if (error == WMP_errSuccess) {
      error = converter->Initialize(converter, decoder, output_extension, GUID_PKPixelFormat32bppBGRA);
    }
    I32 width = 0;
    I32 height = 0;
    if (error == WMP_errSuccess) error = converter->GetSize(converter, &width, &height);
    if (error != WMP_errSuccess || width <= 0 || height <= 0) {
      release();
      return {image_core::StatusCode::invalid_argument, "JPEG XR decode initialization failed"};
    }
    std::vector<std::uint8_t> bgra(static_cast<size_t>(width) * height * 4);
    PKRect rectangle = {0, 0, width, height};
    error = converter->Copy(converter, &rectangle, bgra.data(), static_cast<U32>(width * 4));
    if (error != WMP_errSuccess) {
      release();
      return {image_core::StatusCode::invalid_argument, "JPEG XR pixel decode failed"};
    }
    output.reset({static_cast<std::uint32_t>(width), static_cast<std::uint32_t>(height)}, image_core::PixelFormat::rgba8);
    for (size_t pixel = 0; pixel < bgra.size(); pixel += 4) {
      output.pixels[pixel] = bgra[pixel + 2];
      output.pixels[pixel + 1] = bgra[pixel + 1];
      output.pixels[pixel + 2] = bgra[pixel];
      output.pixels[pixel + 3] = bgra[pixel + 3];
    }
    release();
    return image_core::Status::success();
  }
#endif

#ifdef RAWELECTRON_WITH_LIBRAW
  static constexpr std::array<std::string_view, 43> raw_extensions = {
      ".3fr", ".ari", ".arw", ".bay", ".bmq", ".cap", ".cine", ".cr2", ".cr3", ".crw", ".cs1",
      ".dc2", ".dcr", ".dng", ".erf", ".fff", ".ia", ".iqe", ".k25", ".kdc", ".mdc", ".mef",
      ".mos", ".mrw", ".nef", ".nrw", ".orf", ".ori", ".pef", ".ptx", ".pxn", ".qtk", ".raf",
      ".raw", ".rdc", ".rw2", ".rwl", ".rwz", ".sr2", ".srf", ".srw", ".sti", ".x3f"};
  const bool is_raw = std::find(raw_extensions.begin(), raw_extensions.end(), lowered_extension) !=
      raw_extensions.end();
  if (is_raw) {
    LibRaw raw;
    raw.imgdata.params.output_bps = 8;
    raw.imgdata.params.output_color = 1;
    raw.imgdata.params.use_camera_wb = 1;
    raw.imgdata.params.use_auto_wb = 0;
    raw.imgdata.params.no_auto_bright = 0;
    int result = raw.open_buffer(file_bytes.data(), file_bytes.size());
    if (result != LIBRAW_SUCCESS) {
      return {image_core::StatusCode::invalid_argument, std::string("LibRaw open failed: ") + libraw_strerror(result)};
    }
    result = raw.unpack();
    if (result == LIBRAW_SUCCESS) result = raw.dcraw_process();
    if (result != LIBRAW_SUCCESS) {
      return {image_core::StatusCode::invalid_argument, std::string("LibRaw decode failed: ") + libraw_strerror(result)};
    }
    int memory_error = LIBRAW_SUCCESS;
    libraw_processed_image_t* image = raw.dcraw_make_mem_image(&memory_error);
    if (!image || memory_error != LIBRAW_SUCCESS || image->type != LIBRAW_IMAGE_BITMAP ||
        image->bits != 8 || (image->colors != 3 && image->colors != 4)) {
      if (image) LibRaw::dcraw_clear_mem(image);
      return {image_core::StatusCode::invalid_argument, "LibRaw did not produce an 8-bit bitmap"};
    }
    output.reset({image->width, image->height}, image_core::PixelFormat::rgba8);
    for (size_t pixel = 0, count = static_cast<size_t>(image->width) * image->height; pixel < count; ++pixel) {
      output.pixels[pixel * 4] = image->data[pixel * image->colors];
      output.pixels[pixel * 4 + 1] = image->data[pixel * image->colors + 1];
      output.pixels[pixel * 4 + 2] = image->data[pixel * image->colors + 2];
      output.pixels[pixel * 4 + 3] = image->colors == 4 ? image->data[pixel * 4 + 3] : 255;
    }
    LibRaw::dcraw_clear_mem(image);
    return image_core::Status::success();
  }
#endif

  cv::Mat decoded = cv::imdecode(file_bytes, cv::IMREAD_UNCHANGED);
  if (decoded.empty()) {
    return {image_core::StatusCode::unsupported_format, "No native decoder accepted this image"};
  }

  cv::Mat rgba;
  if (decoded.channels() == 1) {
    cv::cvtColor(decoded, rgba, cv::COLOR_GRAY2RGBA);
  } else if (decoded.channels() == 3) {
    cv::cvtColor(decoded, rgba, cv::COLOR_BGR2RGBA);
  } else if (decoded.channels() == 4) {
    cv::cvtColor(decoded, rgba, cv::COLOR_BGRA2RGBA);
  } else {
    return {image_core::StatusCode::invalid_argument, "Unsupported channel count"};
  }

  if (rgba.depth() != CV_8U) {
    double minimum = 0.0;
    double maximum = 0.0;
    cv::minMaxLoc(rgba.reshape(1), &minimum, &maximum);
    cv::Mat converted;
    rgba.convertTo(converted, CV_8U, maximum > 255.0 ? 255.0 / maximum : 1.0);
    rgba = converted;
  }

  if (!rgba.isContinuous()) {
    rgba = rgba.clone();
  }
  output.reset({static_cast<std::uint32_t>(rgba.cols), static_cast<std::uint32_t>(rgba.rows)}, image_core::PixelFormat::rgba8);
  std::copy_n(rgba.data, output.pixels.size(), output.pixels.data());
  return image_core::Status::success();
}

namespace {
cv::Mat as_rgba_mat(const image_core::Bitmap& bitmap) {
  return cv::Mat(
      static_cast<int>(bitmap.size.height),
      static_cast<int>(bitmap.size.width),
      CV_8UC4,
      const_cast<std::uint8_t*>(bitmap.pixels.data()));
}

image_core::Status validate(const image_core::Bitmap& bitmap) {
  const size_t expected = static_cast<size_t>(bitmap.size.width) * bitmap.size.height * 4;
  if (bitmap.format != image_core::PixelFormat::rgba8 || bitmap.size.width == 0 ||
      bitmap.size.height == 0 || bitmap.pixels.size() < expected) {
    return {image_core::StatusCode::invalid_argument, "Codec requires a non-empty RGBA8 bitmap"};
  }
  return image_core::Status::success();
}
}  // namespace

image_core::Status encode_png(const image_core::Bitmap& bitmap, std::vector<std::uint8_t>& output) {
  const auto status = validate(bitmap);
  if (!status.ok()) return status;
  cv::Mat bgra;
  cv::cvtColor(as_rgba_mat(bitmap), bgra, cv::COLOR_RGBA2BGRA);
  if (!cv::imencode(".png", bgra, output, {cv::IMWRITE_PNG_COMPRESSION, 3})) {
    return {image_core::StatusCode::internal_error, "Failed to encode PNG preview"};
  }
  return image_core::Status::success();
}

image_core::Status encode_file(const image_core::Bitmap& bitmap, const std::string& output_path) {
  const auto status = validate(bitmap);
  if (!status.ok()) return status;
  std::string extension;
  const auto dot = output_path.find_last_of('.');
  if (dot != std::string::npos) extension = output_path.substr(dot);
  std::transform(extension.begin(), extension.end(), extension.begin(), [](unsigned char value) {
    return static_cast<char>(std::tolower(value));
  });

  std::string encoder_extension = extension;
  if (encoder_extension == ".jpe") encoder_extension = ".jpg";
  if (encoder_extension == ".tif") encoder_extension = ".tiff";
  if (encoder_extension == ".dib") encoder_extension = ".bmp";
  if (encoder_extension == ".j2k" || encoder_extension == ".jpc") encoder_extension = ".jp2";
  if (encoder_extension == ".pnm") encoder_extension = ".ppm";
  if (encoder_extension == ".pic") encoder_extension = ".hdr";
  if (encoder_extension == ".sr") encoder_extension = ".ras";

  static constexpr std::array<std::string_view, 12> writable_extensions = {
      ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff",
      ".jp2", ".pbm", ".pgm", ".ppm", ".pam", ".hdr"};
  const bool writable = std::find(
      writable_extensions.begin(), writable_extensions.end(), encoder_extension) !=
      writable_extensions.end() || encoder_extension == ".ras";
  if (!writable) {
    return {
        image_core::StatusCode::unsupported_format,
        "Unsupported output format. Camera RAW and read-only image formats cannot be exported"};
  }

  cv::Mat encoded;
  const bool discard_alpha =
      encoder_extension == ".jpg" || encoder_extension == ".jpeg" ||
      encoder_extension == ".jp2" || encoder_extension == ".pbm" ||
      encoder_extension == ".pgm" || encoder_extension == ".ppm" ||
      encoder_extension == ".hdr" || encoder_extension == ".ras";
  if (discard_alpha) {
    cv::cvtColor(as_rgba_mat(bitmap), encoded, cv::COLOR_RGBA2BGR);
  } else {
    cv::cvtColor(as_rgba_mat(bitmap), encoded, cv::COLOR_RGBA2BGRA);
  }
  if (encoder_extension == ".pgm" || encoder_extension == ".pbm") {
    cv::cvtColor(as_rgba_mat(bitmap), encoded, cv::COLOR_RGBA2GRAY);
  } else if (encoder_extension == ".hdr") {
    encoded.convertTo(encoded, CV_32F, 1.0 / 255.0);
  }
  std::vector<std::uint8_t> file_bytes;
  std::vector<int> encoder_parameters;
  if (encoder_extension == ".pam") {
    encoder_parameters = {cv::IMWRITE_PAM_TUPLETYPE, cv::IMWRITE_PAM_FORMAT_RGB_ALPHA};
  }
  try {
    if (!cv::imencode(encoder_extension, encoded, file_bytes, encoder_parameters)) {
      return {image_core::StatusCode::internal_error, "Failed to encode output image"};
    }
  } catch (const cv::Exception& error) {
    return {
        image_core::StatusCode::unsupported_format,
        std::string("Output encoder rejected this format: ") + error.what()};
  }
  return write_file(output_path, file_bytes);
}

}  // namespace rawelectron::codec
