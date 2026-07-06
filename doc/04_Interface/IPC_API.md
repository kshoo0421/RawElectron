# IPC API

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 UI(Electron)와 Image Engine(C++) 사이에서 교환되는 IPC 메시지 규약을 정의한다.

IPC API는 프로세스 간 통신을 위한 인터페이스이며, Engine 내부 API를 그대로 노출하지 않는다.

---

# 2. Design Goals

IPC API는 다음 목표를 가진다.

- Platform Independent
- Message Based
- Command / Event 분리
- 최소한의 데이터 전송
- Version Compatibility
- Backward Compatibility

---

# 3. Communication Model

IPC는 Request / Response / Event 구조를 따른다.

```
UI

↓

Request

↓

Engine

↓

Response

↓

Event
```

---

# 4. Message Structure

모든 IPC 메시지는 다음 구조를 따른다.

```
Header

Body
```

Header는 메시지 식별 정보를 가진다.

Body는 실제 데이터를 가진다.

---

# 5. Header

공통 Header

| Field | Description |
|--------|-------------|
| Version | API Version |
| MessageId | Message Identifier |
| Type | Request / Response / Event |
| Timestamp | Message Time |

---

# 6. Request

UI → Engine

Request는 Engine에 작업을 요청한다.

예시

```
OpenImage

CloseImage

SetExposure

Undo

Redo

Export
```

---

# 7. Response

Engine → UI

Response는 Request 처리 결과를 반환한다.

예시

```
Success

Failure

ImageId

ProjectId
```

---

# 8. Event

Engine → UI

Engine 상태가 변경되면 Event를 발생시킨다.

예시

```
ImageOpened

PreviewUpdated

ExportFinished

ProjectSaved

ErrorOccurred
```

---

# 9. Command Categories

IPC Command는 다음 그룹으로 구분한다.

## Project

```
CreateProject

OpenProject

SaveProject

CloseProject
```

---

## Image

```
OpenImage

CloseImage

ReloadImage

GetMetadata
```

---

## Edit

```
SetExposure

SetContrast

SetWhiteBalance

SetCurve

Crop

Rotate

Resize

SetLUT
```

---

## Render

```
RenderPreview

RenderRegion

RenderExport
```

---

## Export

```
ExportImage
```

---

## History

```
Undo

Redo

ClearHistory
```

---

# 10. Event Categories

Engine은 다음 Event를 발생시킬 수 있다.

## Image

```
ImageOpened

ImageClosed
```

---

## Preview

```
PreviewUpdated

PreviewFailed
```

---

## Project

```
ProjectLoaded

ProjectSaved
```

---

## Export

```
ExportStarted

ExportFinished

ExportFailed
```

---

## Error

```
ErrorOccurred
```

---

# 11. Payload Rules

IPC Payload는 다음 데이터를 사용할 수 있다.

지원

- Integer
- Float
- Boolean
- String
- Array
- Small Structure

지원하지 않음

- Original Image
- Preview Buffer
- RAW Buffer
- Pixel Data

---

# 12. Image Transfer Policy

원본 이미지는 IPC로 전달하지 않는다.

UI는 Image Buffer를 직접 소유하지 않는다.

Preview는 다음 방법 중 하나를 사용한다.

- Shared Memory
- Native Surface
- Texture Handle

---

# 13. Error Codes

대표 오류

| Code | Description |
|------|-------------|
| OK | 성공 |
| InvalidParameter | 잘못된 인자 |
| ImageNotFound | 이미지 없음 |
| DecodeFailed | 디코딩 실패 |
| ExportFailed | 저장 실패 |
| UnsupportedFormat | 지원하지 않는 형식 |

---

# 14. Thread Model

IPC는 비동기로 동작한다.

UI는 Engine 작업이 완료될 때까지 Block되지 않는다.

긴 작업은 Event를 통해 완료를 통보한다.

---

# 15. Versioning

IPC API는 버전 정보를 포함한다.

신규 기능은 기존 메시지를 변경하지 않고 추가한다.

---

# 16. Related Documents

| Document | Description |
|----------|-------------|
| IPC_Architecture | IPC 구조 |
| Engine_API | Engine 인터페이스 |
| System_Architecture | 시스템 구조 |
| Rendering_Architecture | 렌더링 구조 |

---

# 17. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |