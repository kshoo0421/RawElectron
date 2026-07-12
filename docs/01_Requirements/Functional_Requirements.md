# Functional Requirements

## 1. Introduction

본 문서는 RawElectron이 제공해야 하는 기능 요구사항(Functional Requirements)을 정의한다.

각 요구사항은 고유한 ID를 가지며, 구현 및 테스트의 기준으로 사용된다.

비기능 요구사항은 `NonFunctional_Requirements.md`를 따른다.

---

# 2. Requirement Format

각 기능 요구사항은 다음 형식을 따른다.

| Item | Description |
|------|-------------|
| Requirement ID | 기능 식별자 |
| Name | 기능명 |
| Priority | High / Medium / Low |
| Description | 기능 설명 |
| Preconditions | 실행 전 조건 |
| Input | 입력 |
| Processing | 처리 내용 |
| Output | 출력 |
| Exceptions | 예외 상황 |

---

# 3. Image Management

---

## FR-IMG-001

### Name

Open Image

### Priority

High

### Description

사용자는 로컬 저장소에 있는 이미지를 열 수 있어야 한다.

### Preconditions

- 지원하는 이미지 형식이어야 한다.

### Input

- File Path

### Processing

- 파일 존재 여부 확인
- 이미지 디코딩
- 원본 이미지 생성
- Preview 생성

### Output

- 편집 가능한 이미지

### Exceptions

- 파일이 존재하지 않음
- 지원하지 않는 형식
- 디코딩 실패

---

## FR-IMG-002

### Name

Close Image

### Priority

Medium

### Description

현재 이미지를 닫는다.

---

## FR-IMG-003

### Name

Reload Image

이미지를 다시 불러온다.

---

## FR-IMG-004

### Name

Image Information

다음 정보를 표시한다.

- Width
- Height
- Bit Depth
- Color Space
- File Format
- File Size

---

# 4. Image Editing

---

## FR-EDIT-001

Exposure

사용자는 Exposure를 변경할 수 있어야 한다.

범위

```
-5.0 ~ +5.0 EV
```

---

## FR-EDIT-002

Contrast

---

## FR-EDIT-003

Highlights

---

## FR-EDIT-004

Shadows

---

## FR-EDIT-005

Whites

---

## FR-EDIT-006

Blacks

---

## FR-EDIT-007

Brightness

---

## FR-EDIT-008

Gamma

---

# 5. Color Adjustment

---

## FR-COLOR-001

White Balance

---

## FR-COLOR-002

Temperature

---

## FR-COLOR-003

Tint

---

## FR-COLOR-004

Vibrance

---

## FR-COLOR-005

Saturation

---

## FR-COLOR-006

Hue

---

## FR-COLOR-007

HSL

RGB 채널별

- Hue
- Saturation
- Luminance

조정을 지원한다.

---

# 6. Tone Curve

---

## FR-CURVE-001

RGB Curve

---

## FR-CURVE-002

Red Curve

---

## FR-CURVE-003

Green Curve

---

## FR-CURVE-004

Blue Curve

---

## FR-CURVE-005

Curve Preset

---

# 7. Geometry

---

## FR-GEO-001

Crop

---

## FR-GEO-002

Rotate

---

## FR-GEO-003

Flip Horizontal

---

## FR-GEO-004

Flip Vertical

---

## FR-GEO-005

Resize

---

## FR-GEO-006

Aspect Ratio Lock

---

# 8. Detail

---

## FR-DETAIL-001

Sharpen

---

## FR-DETAIL-002

Noise Reduction

기본적인 노이즈 제거를 제공한다.

AI 기반 기능은 제외한다.

---

## FR-DETAIL-003

Texture

---

## FR-DETAIL-004

Clarity

---

# 9. LUT

---

## FR-LUT-001

Load LUT

---

## FR-LUT-002

Enable LUT

---

## FR-LUT-003

LUT Strength

---

# 10. Preview

---

## FR-PREVIEW-001

Real-time Preview

편집 중에는 Preview를 실시간으로 갱신한다.

---

## FR-PREVIEW-002

Proxy Preview

Preview는 Proxy 이미지를 기반으로 생성한다.

---

## FR-PREVIEW-003

High Quality Preview

사용자는 고화질 Preview를 요청할 수 있다.

---

# 11. History

---

## FR-HISTORY-001

Undo

---

## FR-HISTORY-002

Redo

---

## FR-HISTORY-003

History List

---

# 12. Project

---

## FR-PROJECT-001

New Project

---

## FR-PROJECT-002

Save Project

---

## FR-PROJECT-003

Load Project

---

## FR-PROJECT-004

Recent Projects

---

# 13. Export

---

## FR-EXPORT-001

Export Image

---

## FR-EXPORT-002

Export JPEG

---

## FR-EXPORT-003

Export PNG

---

## FR-EXPORT-004

Export TIFF

---

## FR-EXPORT-005

Export JXR

---

## FR-EXPORT-006

Export AVIF

---

## FR-EXPORT-007

Export Options

형식별 저장 옵션을 지원한다.

---

# 14. File Formats

입력을 지원하는 형식

- RAW
- JPEG
- PNG
- TIFF

출력을 지원하는 형식

- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

# 15. Unsupported Features

다음 기능은 구현 대상에서 제외한다.

- AI Denoise
- AI Mask
- AI Selection
- Face Recognition
- Cloud Sync
- Login
- Plugin Marketplace
- Online Collaboration

---

# 16. Traceability

각 기능 요구사항은 다음 문서와 연결된다.

| Document | Purpose |
|-----------|----------|
| Software_Requirements_Specification | 상위 요구사항 |
| Use_Cases | 사용자 시나리오 |
| Engine_API | 기능 인터페이스 |
| Test_Plan | 테스트 항목 |
| Acceptance_Test | 검수 기준 |