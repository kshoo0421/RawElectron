# IPC Architecture

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 IPC(Inter-Process Communication) 아키텍처를 정의한다.

RawElectron은 UI와 Image Engine을 서로 독립적인 컴포넌트로 구성하며,
컴포넌트 간 통신은 IPC를 통해 수행한다.

IPC는 단순한 데이터 전달 수단이 아니라,
UI와 Engine의 결합도를 낮추기 위한 핵심 아키텍처이다.

---

# 2. Design Goals

IPC는 다음 목표를 가진다.

- UI와 Engine 완전 분리
- Platform Independent
- Engine 재사용 가능
- UI Framework 독립
- 대용량 이미지 복사 최소화
- Command 기반 통신
- Event 기반 상태 전달

---

# 3. Overall Architecture

```
+---------------------+
|     React UI        |
+----------+----------+
           |
           |
+----------v----------+
|      Electron       |
+----------+----------+
           |
           | IPC
           |
+----------v----------+
|    C++ Engine       |
+---------------------+
```

---

# 4. Design Principles

## 4.1 Command Based

UI는 Engine에게 명령(Command)만 전달한다.

예시

```
OpenImage

SetExposure

Rotate

Crop

Export
```

UI는 이미지 데이터를 전달하지 않는다.

---

## 4.2 Event Driven

Engine은 작업 완료 시 Event를 발생시킨다.

예시

```
PreviewUpdated

ExportFinished

ProjectSaved

ErrorOccurred
```

UI는 Event를 수신하여 화면을 갱신한다.

---

## 4.3 Stateless IPC

IPC 자체는 상태를 저장하지 않는다.

상태는 Engine 내부에서 관리한다.

---

# 5. Communication Model

UI

↓

Command

↓

Engine

↓

Processing

↓

Event

↓

UI

```
UI

↓

SetExposure(+0.3)

↓

Engine

↓

Preview Render

↓

PreviewUpdated

↓

UI Refresh
```

---

# 6. IPC Data Policy

IPC를 통해 전달 가능한 데이터는 다음과 같다.

### Primitive

- Integer
- Float
- Boolean
- String

---

### Small Structures

- Rect
- Point
- Size
- Color
- Curve Points

---

### Command Parameters

예시

```
ImageId

Exposure

Rotation

Crop Area

Export Option
```

---

# 7. Data Ownership

UI가 소유하는 데이터

- Window State
- UI State
- Dock State
- Selection State

---

Engine이 소유하는 데이터

- Original Image
- Preview Image
- Proxy Image
- Edit State
- History
- Cache
- Metadata

---

# 8. Forbidden IPC

다음 데이터는 IPC를 통해 전달하지 않는다.

- Original Image Buffer
- RAW Buffer
- Full Resolution Image
- Render Buffer
- Cache Buffer

대용량 Pixel Buffer는 IPC를 통해 복사하지 않는다.

---

# 9. Image Open Flow

```
UI

↓

OpenImage(path)

↓

Engine

↓

Load File

↓

Decode

↓

Create Preview

↓

PreviewUpdated
```

파일 경로만 전달한다.

파일은 Engine이 직접 읽는다.

---

# 10. Editing Flow

```
Slider

↓

SetExposure

↓

Engine

↓

Preview Render

↓

PreviewUpdated

↓

UI Refresh
```

편집 중에는 Preview만 다시 생성한다.

---

# 11. Export Flow

```
Export

↓

ExportImage(path)

↓

Engine

↓

Full Resolution Render

↓

Image Save

↓

ExportFinished
```

Export는 Background에서 수행한다.

---

# 12. Preview Sharing

Preview는 다음 방식 중 하나를 사용한다.

- Shared Memory
- Native Render Surface
- Temporary Preview File

초기 구현에서는 Shared Memory를 기본 방식으로 고려한다.

---

# 13. Error Handling

Engine은 다음 Event를 발생할 수 있다.

```
ErrorOccurred

ImageLoadFailed

ExportFailed

ProjectLoadFailed
```

UI는 오류를 표시한다.

---

# 14. Thread Model

UI Thread

- User Input
- UI Update

Engine Thread

- Decode
- Render
- Export

Worker Thread

- Background Processing

UI Thread는 Engine 처리를 수행하지 않는다.

---

# 15. Future Extension

IPC는 다음 기능을 추가할 수 있어야 한다.

- GPU Render
- Layer
- Mask
- Plugin
- AI Module

기존 Command 구조를 변경하지 않고 확장 가능해야 한다.

---

# 16. Related Documents

| Document | Description |
|----------|-------------|
| System_Architecture | 전체 시스템 구조 |
| Engine_Architecture | Image Engine 구조 |
| Rendering_Architecture | Rendering 구조 |
| Engine_API | Engine API |
| IPC_API | IPC Interface |

---

# 17. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |