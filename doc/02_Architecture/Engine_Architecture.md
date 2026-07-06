# Engine Architecture

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 C++ Image Engine 아키텍처를 정의한다.

Image Engine은 이미지 로드, 편집, 렌더링 및 저장을 담당하는 핵심 구성 요소이며, UI(Electron/React)와 독립적으로 동작한다.

세부 클래스 설계는 Design 문서에서 정의한다.

---

# 2. Design Goals

Image Engine은 다음 목표를 가진다.

- UI와 완전히 분리
- Platform Independent
- Non-Destructive Editing
- High Performance
- Multi-thread Friendly
- Extensible Pipeline
- Testable Architecture

---

# 3. Responsibilities

Image Engine은 다음 기능을 담당한다.

## Image I/O

- Image Open
- Image Save
- Metadata
- RAW Decode

---

## Image Processing

- Exposure
- Contrast
- White Balance
- Curve
- Crop
- Rotate
- Resize
- LUT

---

## Rendering

- Preview Rendering
- Export Rendering

---

## Resource Management

- Image Buffer
- Cache
- Preview
- History

---

## Color Management

- Color Space
- ICC Profile
- HDR

---

# 4. High-Level Architecture

```
                 +----------------------+
                 |     IPC Interface    |
                 +----------+-----------+
                            |
                            |
                +-----------v------------+
                |      Engine Core       |
                +-----------+------------+
                            |
     +----------------------+----------------------+
     |                      |                      |
+----v-----+         +------v------+        +------v------+
| File I/O |         | Image Model |        | Render Core |
+----------+         +-------------+        +-------------+
     |                      |                      |
     |                      |                      |
+----v-----+         +------v------+        +------v------+
| Decoder  |         | Edit State  |        | Pipeline    |
+----------+         +-------------+        +-------------+
                            |
                            |
                   +--------v--------+
                   | Export Pipeline |
                   +-----------------+
```

---

# 5. Engine Components

## 5.1 Engine Core

Engine의 중심 구성 요소이다.

책임

- Command 실행
- Image 관리
- Render 요청
- Resource 관리

---

## 5.2 File I/O

이미지 파일을 읽고 저장한다.

지원

- RAW
- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

## 5.3 Decoder

파일 형식을 내부 Image Model로 변환한다.

예시

```
RAW

↓

Decoder

↓

Internal Image
```

---

## 5.4 Image Model

편집 중인 이미지를 표현한다.

관리 대상

- Original Image
- Preview Image
- Metadata
- Color Space

원본 이미지는 수정되지 않는다.

---

## 5.5 Edit State

현재 편집 상태를 관리한다.

예시

```
Exposure

Contrast

Curve

Crop

Rotation

LUT
```

이미지 자체가 아닌 **편집 파라미터만** 저장한다.

---

## 5.6 Render Core

Render 요청을 수행한다.

지원

- Preview Render
- Export Render

---

## 5.7 Image Pipeline

Edit State를 이용하여 최종 이미지를 생성한다.

Pipeline 순서는 별도 문서(Image_Processing_Pipeline.md)를 따른다.

---

## 5.8 Export Pipeline

최종 이미지를 저장한다.

지원

- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

# 6. Image Lifecycle

이미지는 다음 생명주기를 가진다.

```
Image Open

↓

Decode

↓

Original Image 생성

↓

Preview 생성

↓

Editing

↓

Preview Render

↓

Export

↓

Close
```

---

# 7. Data Ownership

Engine은 다음 데이터를 소유한다.

```
Original Image

Preview Image

Proxy Image

Edit State

History

Cache
```

UI는 이미지 데이터를 소유하지 않는다.

---

# 8. Non-Destructive Editing

모든 편집은 파라미터 기반으로 관리한다.

```
Original Image

+

Edit State

↓

Render

↓

Preview
```

원본 이미지는 절대 변경하지 않는다.

---

# 9. Rendering Model

Engine은 두 종류의 Rendering을 지원한다.

## Preview

- Proxy 기반
- 빠른 응답
- 낮은 해상도

---

## Export

- 원본 해상도
- 최고 품질
- Background Rendering

---

# 10. Thread Model

Engine은 다음 작업을 병렬 처리할 수 있다.

- Decode
- Preview Render
- Export
- Cache 생성

UI Thread는 Image Processing을 수행하지 않는다.

---

# 11. Memory Policy

Engine은 원본 이미지를 하나만 유지한다.

Preview는 별도로 관리한다.

History는 편집 파라미터 기반으로 저장한다.

Shared Memory는 Preview 전달에만 사용한다.

---

# 12. Error Handling

Engine은 다음 상황을 처리해야 한다.

- File Not Found
- Decode Failure
- Unsupported Format
- Memory Allocation Failure
- Export Failure

오류 발생 시 Engine은 가능한 한 정상 상태를 유지해야 한다.

---

# 13. Future Extensions

향후 다음 기능을 추가할 수 있도록 설계한다.

- GPU Renderer
- Layer System
- Brush
- Mask
- Panorama
- HDR Merge
- AI Module

기존 Core 구조를 변경하지 않고 Module 형태로 추가 가능해야 한다.

---

# 14. Related Documents

| Document | Description |
|-----------|-------------|
| System_Architecture | 시스템 전체 구조 |
| IPC_Architecture | UI와 Engine 통신 |
| Rendering_Architecture | Rendering 구조 |
| Image_Processing_Pipeline | 이미지 처리 순서 |
| Engine_API | Engine Interface |

---

# 15. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |