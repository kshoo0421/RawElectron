# Image Processing Pipeline

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 이미지 처리 파이프라인(Image Processing Pipeline)을 정의한다.

Pipeline은 원본 이미지가 최종 Preview 또는 Export 이미지가 되기까지 수행되는 처리 순서와 각 단계의 역할을 정의한다.

세부 알고리즘은 포함하지 않는다.

---

# 2. Design Goals

Pipeline은 다음 목표를 가진다.

- Non-Destructive Editing
- Deterministic Result
- High Performance
- Modular Processing
- Reusable Stages
- GPU Extensible

---

# 3. Pipeline Overview

이미지 처리는 다음 순서를 따른다.

```
Image Open
        │
        ▼
Decode
        │
        ▼
Working Image
        │
        ▼
Image Processing
        │
        ▼
Preview / Export
```

---

# 4. Processing Stages

## Stage 1

### Image Decode

목적

이미지를 내부 작업 포맷으로 변환한다.

입력

- RAW
- JPEG
- PNG
- TIFF

출력

- Working Image

---

## Stage 2

### Color Initialization

초기 색상 정보를 적용한다.

예시

- White Balance
- Color Space
- ICC Profile

---

## Stage 3

### Global Adjustment

이미지 전체에 영향을 주는 보정을 수행한다.

예시

- Exposure
- Brightness
- Contrast
- Gamma

---

## Stage 4

### Tone Adjustment

톤 정보를 보정한다.

예시

- Highlights
- Shadows
- Whites
- Blacks

---

## Stage 5

### Color Adjustment

색상 정보를 변경한다.

예시

- Temperature
- Tint
- Vibrance
- Saturation
- HSL

---

## Stage 6

### Tone Curve

Curve를 적용한다.

지원

- RGB Curve
- Red Curve
- Green Curve
- Blue Curve

---

## Stage 7

### Detail Adjustment

디테일을 보정한다.

예시

- Sharpen
- Noise Reduction
- Clarity
- Texture

---

## Stage 8

### LUT

LUT를 적용한다.

---

## Stage 9

### Geometry

이미지의 형태를 변경한다.

예시

- Crop
- Rotate
- Flip
- Resize

---

## Stage 10

### Preview Generation

Preview 이미지를 생성한다.

Preview는 Proxy 기반일 수 있다.

---

## Stage 11

### Export

최종 이미지를 생성한다.

Export는 원본 해상도를 사용한다.

---

# 5. Pipeline Diagram

```
Image

↓

Decode

↓

Working Image

↓

Color

↓

Exposure

↓

Tone

↓

HSL

↓

Curve

↓

Detail

↓

LUT

↓

Geometry

↓

Preview / Export
```

---

# 6. Processing Rules

Pipeline은 다음 규칙을 따른다.

## Rule 1

원본 이미지는 변경하지 않는다.

---

## Rule 2

Pipeline은 항상 동일한 순서를 유지한다.

---

## Rule 3

Preview와 Export는 동일한 Pipeline을 사용한다.

단,

사용하는 해상도와 품질은 다를 수 있다.

---

## Rule 4

각 Stage는 이전 Stage의 결과만 사용한다.

---

## Rule 5

Stage는 독립적으로 구현 가능해야 한다.

---

# 7. Processing Order

Pipeline의 기본 순서는 다음과 같다.

| Order | Stage |
|--------|-------|
| 1 | Decode |
| 2 | Color Initialization |
| 3 | Global Adjustment |
| 4 | Tone Adjustment |
| 5 | Color Adjustment |
| 6 | Tone Curve |
| 7 | Detail |
| 8 | LUT |
| 9 | Geometry |
| 10 | Preview |
| 11 | Export |

---

# 8. Preview Pipeline

Preview는 다음 순서를 따른다.

```
Original

↓

Proxy

↓

Pipeline

↓

Preview Buffer
```

목표

- 빠른 반응성

- 낮은 계산량

---

# 9. Export Pipeline

Export는 다음 순서를 따른다.

```
Original

↓

Pipeline

↓

Full Resolution

↓

Encoder

↓

Image File
```

---

# 10. Stage Independence

각 Stage는 다른 Stage를 직접 참조하지 않는다.

```
Stage

↓

Input

↓

Processing

↓

Output
```

형태를 유지한다.

---

# 11. Pipeline Extension

새로운 기능은 새로운 Stage 형태로 추가할 수 있어야 한다.

예시

```
AI

↓

Stage

↓

Pipeline
```

또는

```
Mask

↓

Stage

↓

Pipeline
```

---

# 12. Future Pipeline

향후 다음 Stage를 추가할 수 있다.

- Layer
- Mask
- Brush
- HDR Merge
- Panorama
- AI Denoise

기존 Stage를 변경하지 않고 추가 가능해야 한다.

---

# 13. Related Documents

| Document | Description |
|----------|-------------|
| Rendering_Architecture | Rendering 구조 |
| Engine_Architecture | Engine 구조 |
| Data_Model | 데이터 모델 |
| Engine_API | Engine API |

---

# 14. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |