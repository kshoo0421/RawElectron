# Rendering Architecture

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 렌더링 아키텍처를 정의한다.

Rendering은 이미지를 화면에 표시하거나 최종 결과를 생성하는 과정을 의미한다.

본 문서는 렌더링의 계층 구조, 버퍼 관리, 렌더링 모드 및 데이터 흐름을 정의하며,
실제 이미지 처리 알고리즘은 Image_Processing_Pipeline.md에서 정의한다.

---

# 2. Design Goals

Rendering은 다음 목표를 가진다.

- 빠른 Preview
- 고품질 Export
- 원본 이미지 보존
- 비파괴 편집
- 최소한의 재계산
- GPU 확장 가능
- 멀티스레드 지원

---

# 3. Rendering Model

RawElectron은 두 가지 렌더링 모드를 가진다.

```
Preview Rendering

Export Rendering
```

---

# 4. Rendering Layers

```
User Input
      │
      ▼
Edit State
      │
      ▼
Render Scheduler
      │
      ▼
Render Pipeline
      │
      ▼
Output Buffer
      │
      ▼
Preview / Export
```

---

# 5. Rendering Modes

## Preview Rendering

목적

사용자의 편집 결과를 빠르게 보여준다.

특징

- Proxy 기반
- 빠른 응답
- 화면 표시 전용

---

## Export Rendering

목적

최종 이미지를 생성한다.

특징

- 원본 해상도
- 최고 품질
- Background 작업

---

# 6. Rendering Quality

Preview와 Export는 서로 다른 품질을 사용할 수 있다.

예시

| Item | Preview | Export |
|-------|----------|---------|
| Resolution | Proxy | Original |
| Quality | Medium | Best |
| Rendering Speed | Fast | High Quality |

---

# 7. Rendering Buffers

Engine은 다음 버퍼를 관리한다.

```
Original Buffer

↓

Proxy Buffer

↓

Preview Buffer

↓

Export Buffer
```

각 버퍼의 역할

Original Buffer

- 원본 이미지

Proxy Buffer

- Preview 계산용

Preview Buffer

- UI 표시용

Export Buffer

- 최종 저장용

---

# 8. Render Scheduling

Render 요청은 즉시 수행하지 않는다.

Render Scheduler가 요청을 관리한다.

예시

```
Exposure

Contrast

Crop

Rotate
```

슬라이더가 빠르게 변경되면

```
1

2

3

4

5
```

모든 요청을 수행하지 않고

```
5
```

만 렌더링할 수 있다.

---

# 9. Dirty Region

이미지 전체를 항상 다시 계산하지 않는다.

가능한 경우 변경된 영역만 다시 계산한다.

예시

```
Crop

↓

Geometry 변경

↓

Geometry 이후만 다시 계산
```

---

# 10. Render Cache

동일한 계산을 반복하지 않도록 Cache를 사용한다.

Cache 대상

- Histogram
- Thumbnail
- Preview
- Intermediate Buffer

---

# 11. Zoom Strategy

Preview는 Zoom Level에 따라 적절한 이미지를 사용한다.

예시

```
10%

↓

Proxy

---

100%

↓

Preview

---

400%

↓

Original Region
```

필요한 영역만 렌더링한다.

---

# 12. Viewport Rendering

화면에 보이지 않는 영역은 렌더링하지 않는다.

```
Image

####################

Viewport

██████
```

Viewport에 필요한 부분만 계산한다.

---

# 13. Progressive Rendering

대용량 이미지에서는

```
Low Quality

↓

Medium

↓

High
```

순서로 점진적으로 표시할 수 있다.

초기 구현은 다음 두 파이프라인을 같은 Edit State와 Render Generation으로 동시에 실행한다.

```
Proxy Buffer   → Pipeline → Shared Preview Buffer A ─┐
                                                    ├→ UI
Original Buffer → Pipeline → Display Resize
                → Shared Preview Buffer B ──────────┘
```

- Proxy Buffer는 이미지를 열 때 미리 생성하고 Engine이 보유한다.
- Proxy 결과가 준비되면 UI는 즉시 A를 표시한다.
- 원본 해상도 파이프라인이 완료되면 화면 표시 크기로 만든 B가 A를 교체한다.
- 두 결과의 완료 순서는 고정하지 않으며, 원본 결과가 먼저 준비된 경우 Proxy가 다시 덮어쓰지 않는다.
- Original Buffer 자체는 Shared Memory 또는 IPC로 전달하지 않는다. 공유되는 A와 B는 모두 UI 표시용 Preview Buffer이다.
- 오래된 Render Generation의 결과는 UI에 반영하지 않는다.

---

# 14. Render Thread

Rendering은 UI Thread에서 수행하지 않는다.

```
UI Thread

↓

Render Request

↓

Worker Thread

↓

Preview Ready

↓

UI Update
```

---

# 15. Rendering Flow

Preview

```
User Edit

↓

Edit State

↓

Proxy Render

↓

Preview Buffer

↓

UI
```

Export

```
Export

↓

Original Buffer

↓

Full Pipeline

↓

Export Buffer

↓

Save
```

---

# 16. Future Extensions

향후 다음 기능을 추가할 수 있다.

- GPU Rendering
- Tile Rendering
- Layer Rendering
- Mask Rendering
- HDR Rendering

기존 Rendering Architecture를 변경하지 않고
확장 가능한 구조를 목표로 한다.

---

# 17. Related Documents

| Document | Description |
|----------|-------------|
| Engine_Architecture | Engine 구성 |
| Image_Processing_Pipeline | 이미지 처리 순서 |
| IPC_Architecture | UI와 Engine 통신 |
| Engine_API | Engine 인터페이스 |

---

# 18. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |

---

# 19. Verified Preview Transport Constraints (2026-07-14)

The test image `6000 x 4000` decoded and rendered correctly inside the native Worker:

- open/decode: approximately 278 ms;
- 1200 px Proxy shared render: approximately 32 ms;
- 1200 px Original shared render: approximately 239 ms.

The blank preview is therefore not caused by JPEG decoding or processing performance. It occurs after rendering, at the Electron process boundary: a Renderer-created SAB is not preserved when posted to `MessagePortMain`.

Preview implementations must include an Electron end-to-end transport test. A Worker-only shared-memory test is insufficient because it does not exercise Renderer/Main serialization.

## Temporary preview file implementation

The current safe fallback renders an encoded PNG in the native Engine Worker and writes it under the application preview cache directory. Electron IPC returns only metadata and a `rawelectron://preview/...` URL; pixel bytes are never returned as an IPC payload.

Editing uses draft state:

- slider changes render a Proxy-derived preview;
- the previously presented file remains visible until the replacement file is complete;
- Cancel restores the last committed edit state;
- Confirm commits the draft state and requests an Original-derived preview;
- source files remain unchanged until Export.

Preview URLs contain `ImageId`, quality, and render generation. Responses use `Cache-Control: no-store`, and the custom protocol only serves validated preview filenames from the dedicated cache directory.
