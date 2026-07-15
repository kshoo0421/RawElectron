# Data Model

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron에서 사용하는 주요 데이터 모델을 정의한다.

Data Model은 시스템이 관리하는 데이터의 구조와 관계를 정의하며, 구현 방법이나 프로그래밍 언어에 종속되지 않는다.

클래스 설계 및 구현은 별도 Design 문서에서 정의한다.

---

# 2. Design Goals

데이터 모델은 다음 목표를 가진다.

- Non-Destructive Editing
- Data Independence
- Clear Ownership
- Extensible Structure
- Serialization Friendly

---

# 3. Data Hierarchy

```
Project
    │
    ├── Image Document
    │       │
    │       ├── Original Image
    │       ├── Proxy Image
    │       ├── Preview Image
    │       ├── Metadata
    │       └── Edit State
    │
    ├── Project Settings
    │
    └── History
```

---

# 4. Core Models

## 4.1 Project

프로젝트 전체를 표현하는 최상위 데이터이다.

포함 정보

- Project Settings
- Image Documents
- History
- Recent State

Project는 이미지 자체를 저장하지 않는다.

---

## 4.2 Image Document

편집 중인 하나의 이미지를 표현한다.

포함 정보

- Original Image
- Proxy Image
- Preview
- Metadata
- Edit State

---

## 4.3 Original Image

원본 이미지를 표현한다.

속성

- Width
- Height
- Pixel Format
- Color Space
- Bit Depth
- File Path

원본 이미지는 수정되지 않는다.

---

## 4.4 Preview Image

화면 표시를 위한 이미지이다.

속성

- Width
- Height
- Scale
- Pixel Format

Preview는 Engine이 생성한다.

Proxy Image는 Image Open 시 Original Image에서 한 번 생성하는 저해상도 작업 이미지이다.
Preview Image는 편집 상태가 적용된 화면 출력 결과이며 Proxy 기반 결과와 Original 기반 고품질 결과를 포함할 수 있다.
Original, Proxy, Preview의 소유자는 모두 Engine이고 UI는 Preview용 Shared Buffer의 View만 사용한다.

---

## 4.5 Metadata

이미지 메타데이터이다.

예시

- EXIF
- XMP
- ICC Profile
- Camera Information
- Lens Information

---

## 4.6 Edit State

현재 편집 상태를 표현한다.

포함 정보

- Exposure
- Contrast
- White Balance
- Curve
- Crop
- Rotation
- LUT

Edit State는 원본 이미지를 수정하지 않는다.

---

## 4.7 History

편집 기록이다.

History는 이미지 전체가 아니라 Edit State 변경 이력을 저장한다.

---

# 5. Edit State

Edit State는 다음 정보를 포함한다.

```
Exposure

Contrast

Highlights

Shadows

Whites

Blacks

Temperature

Tint

Vibrance

Saturation

Curve

Crop

Rotation

Resize

LUT
```

Edit State는 언제든 기본값으로 초기화할 수 있어야 한다.

---

# 6. Geometry Model

Geometry는 다음 정보를 가진다.

```
Crop Rectangle

Rotation

Flip

Aspect Ratio
```

Geometry는 Pixel Data를 수정하지 않는다.

---

# 7. Color Model

Color는 다음 정보를 가진다.

```
Working Color Space

Output Color Space

ICC Profile

HDR

Bit Depth
```

---

# 8. Export Model

Export 시 필요한 데이터이다.

```
Output Format

Quality

Compression

Bit Depth

Metadata Option

Output Path
```

---

# 9. Relationships

```
Project

↓

Image Document

↓

Original Image

↓

Edit State

↓

Preview

↓

Export
```

History는 Edit State를 참조한다.

---

# 10. Data Ownership

## UI

UI가 관리하는 데이터

- Window State
- Dock Layout
- Current Tool
- Selection

---

## Engine

Engine이 관리하는 데이터

- Original Image
- Preview
- Metadata
- Edit State
- History
- Cache

---

## Storage

파일 시스템이 관리하는 데이터

- Original File
- Project File
- Export File

---

# 11. Serialization

프로젝트 파일에는 다음 정보를 저장한다.

```
Project

↓

Image Path

↓

Edit State

↓

Project Settings
```

원본 이미지 Pixel Data는 프로젝트 파일에 저장하지 않는다.

---

# 12. Lifetime

Original Image

```
Open

↓

Close
```

Preview

```
Render

↓

Discard

↓

Render
```

History

```
Edit

↓

Undo

↓

Redo
```

---

# 13. Data Flow

```
Original Image

+

Edit State

↓

Render

↓

Preview

↓

Export
```

원본 이미지는 변경되지 않는다.

---

# 14. Extension

향후 다음 데이터를 추가할 수 있다.

- Layer
- Mask
- Brush
- AI Result
- Preset

기존 Data Model을 변경하지 않고 확장 가능해야 한다.

---

# 15. Related Documents

| Document | Description |
|-----------|-------------|
| Domain_Model | 도메인 모델 |
| Engine_Architecture | Engine 구조 |
| Image_Processing_Pipeline | 처리 파이프라인 |
| Project_File_Format | 프로젝트 파일 형식 |

---

# 16. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |

---

# 17. C++ Working Bitmap Contract

`ImageCore::Bitmap` is the common owning image type shared by Codec, Processing,
Renderer, and Engine. Native codec objects such as `cv::Mat`, `avifRGBImage`,
`libraw_processed_image_t`, and JPEG XR buffers never cross the Codec boundary.

The bitmap contains:

- pixel dimensions;
- normalized pixel format;
- color space and channel bit depth;
- tightly packed, engine-owned pixel storage;
- allocation, stride, byte-size, and validity operations.

The current decoder output is tightly packed RGBA8 in sRGB. Higher precision
formats remain part of the common type so RAW/HDR decoders can be upgraded
without changing the Engine API.

Decode ownership follows this flow:

```
File -> Codec adapter -> ImageCore::Bitmap -> Engine ImageDocument
```

`BitmapView` is non-owning and may only refer to caller/shared storage for the
duration of a native call. The UI receives an `ImageId` and preview storage
metadata; it does not own the original bitmap.
