# Engine API

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron Image Engine이 외부(UI 또는 IPC Layer)에 제공하는 공개 API를 정의한다.

Engine API는 Engine이 수행하는 기능을 추상화한 인터페이스이며,
구현 방식이나 IPC 프로토콜을 정의하지 않는다.

IPC 메시지 형식은 IPC_API.md에서 정의한다.

---

# 2. Design Goals

Engine API는 다음 목표를 가진다.

- Platform Independent
- UI Independent
- Stable Interface
- High Cohesion
- Low Coupling
- Command Based
- Testable

---

# 3. API Principles

## Public API Only

본 문서에는 Engine의 Public API만 정의한다.

Internal API는 포함하지 않는다.

---

## Stateless Interface

API는 가능한 한 Stateless Interface를 제공한다.

상태는 Engine 내부에서 관리한다.

---

## Resource Handle

이미지는 Handle(ID)로 식별한다.

예시

```
ImageId

ProjectId
```

이미지 데이터를 직접 전달하지 않는다.

---

## Command Based

API는

```
Command

↓

Result
```

형태를 가진다.

---

# 4. API Categories

Engine API는 다음 Service로 구성된다.

```
Project Service

Image Service

Edit Service

Render Service

Export Service

History Service

Metadata Service
```

---

# 5. Project Service

프로젝트를 관리한다.

지원 기능

```
Create Project

Open Project

Save Project

Close Project
```

---

# 6. Image Service

이미지를 관리한다.

지원 기능

```
Open Image

Close Image

Reload Image

Get Image Information
```

---

# 7. Edit Service

이미지를 편집한다.

지원 기능

```
Set Exposure

Set Contrast

Set White Balance

Set Curve

Set Crop

Rotate

Resize

Set LUT
```

Edit Service는 이미지를 수정하지 않고
Edit State를 변경한다.

---

# 8. Render Service

렌더링을 수행한다.

지원 기능

```
Render Preview

Render Region

Render Export
```

Render Service는 화면 표시를 담당하지 않는다.

---

# 9. Export Service

최종 이미지를 저장한다.

지원 기능

```
Export JPEG

Export PNG

Export TIFF

Export JXR

Export AVIF
```

---

# 10. History Service

편집 이력을 관리한다.

지원 기능

```
Undo

Redo

Clear History
```

---

# 11. Metadata Service

메타데이터를 관리한다.

지원 기능

```
Read Metadata

Write Metadata

Get ICC Profile
```

---

# 12. API Lifecycle

이미지는 다음 순서를 따른다.

```
Open

↓

Edit

↓

Render

↓

Export

↓

Close
```

---

# 13. Error Handling

API는 다음 오류를 반환할 수 있다.

```
Success

Invalid Parameter

Unsupported Format

Image Not Found

Export Failed

Memory Error
```

구체적인 Error Code는 별도 문서에서 정의한다.

---

# 14. Thread Safety

Engine API는 다음 원칙을 따른다.

- UI Thread Safe
- Worker Thread Safe
- Internal Synchronization

API 호출자는 내부 Lock을 고려할 필요가 없다.

---

# 15. Ownership

Engine API는 다음 데이터를 소유한다.

```
Project

Image

Preview

History

Cache
```

호출자는 Handle만 관리한다.

---

# 16. Versioning

API는 버전 호환성을 유지해야 한다.

새로운 기능은 기존 API를 변경하지 않고 추가한다.

---

# 17. Related Documents

| Document | Description |
|----------|-------------|
| IPC_API | IPC Interface |
| Engine_Architecture | Engine 구조 |
| Image_Processing_Pipeline | Pipeline |
| Data_Model | 데이터 모델 |

---

# 18. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |