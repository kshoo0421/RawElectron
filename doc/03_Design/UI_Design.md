# UI Design

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 사용자 인터페이스(UI) 설계를 정의한다.

UI는 이미지 처리 기능을 직접 수행하지 않으며,
사용자와 Image Engine 사이의 인터페이스 역할을 담당한다.

세부 구현은 특정 UI Framework에 종속되지 않는다.

---

# 2. Design Goals

UI는 다음 목표를 가진다.

- 직관적인 사용성
- 빠른 반응성
- 비동기 작업 지원
- Dock 기반 레이아웃
- 확장 가능한 UI
- Engine과 독립적인 구조

---

# 3. UI Principles

## UI는 이미지를 처리하지 않는다.

이미지 처리 로직은 Engine에서 수행한다.

UI는

- 입력
- 표시
- 상태 관리

만 담당한다.

---

## UI는 Command를 생성한다.

사용자 입력은 Command 형태로 Engine에 전달된다.

예시

```
SetExposure

Crop

Rotate

Export
```

---

## UI는 Event를 수신한다.

Engine으로부터

```
PreviewUpdated

ExportFinished

ErrorOccurred
```

등의 Event를 수신하여 화면을 갱신한다.

---

# 4. High-Level Layout

```
+---------------------------------------------------------------+
| Toolbar                                                       |
+---------------------------------------------------------------+

+----------+-------------------------------------+-------------+
|          |                                     |             |
| Browser  |          Image Viewer               | Properties  |
|          |                                     |             |
|          |                                     |             |
+----------+-------------------------------------+-------------+

+---------------------------------------------------------------+
| Status Bar                                                    |
+---------------------------------------------------------------+
```

레이아웃은 Dock 기반으로 구성한다.

---

# 5. Main Components

## Application Window

최상위 Window

책임

- Layout 관리
- Dock 관리
- Dialog 관리

---

## Toolbar

주요 기능 실행

예시

- Open
- Save
- Export
- Undo
- Redo

---

## Image Viewer

이미지를 표시한다.

책임

- Zoom
- Pan
- Selection
- Preview 표시

Image Processing은 수행하지 않는다.

---

## Property Panel

현재 선택된 Tool의 속성을 표시한다.

예시

- Exposure
- Curve
- Crop

---

## Browser Panel

프로젝트 이미지를 관리한다.

향후

- Folder
- Thumbnail

등을 포함할 수 있다.

---

## Status Bar

현재 상태를 표시한다.

예시

- Zoom
- Resolution
- Color Space
- Progress

---

# 6. UI State

UI는 다음 상태를 관리한다.

```
Current Tool

Current Selection

Current Zoom

Current View

Dock Layout

Window State
```

이미지 데이터는 관리하지 않는다.

---

# 7. Tool Model

UI는 하나의 Tool만 활성화한다.

예시

```
Move

Crop

Rotate

Picker
```

Property Panel은 현재 Tool에 따라 변경된다.

---

# 8. User Interaction

예시

```
User

↓

Slider

↓

Command

↓

Engine

↓

PreviewUpdated

↓

Viewer Update
```

UI는 Engine 응답을 기다리지 않고
계속 동작 가능해야 한다.

---

# 9. Image Viewer

Viewer는 다음 기능을 제공한다.

- Zoom
- Pan
- Fit
- Actual Size
- Scroll

Viewer는 Image Buffer를 직접 수정하지 않는다.

---

# 10. Property Panel

Property Panel은 현재 편집 기능을 표시한다.

예시

```
Exposure

Contrast

White Balance

Curve

Crop
```

각 Property는 Engine의 Edit State와 연결된다.

---

# 11. Progress UI

다음 작업은 진행률을 표시한다.

- Image Open
- Export
- Project Save
- Project Load

---

# 12. Error UI

다음 오류를 사용자에게 표시한다.

- Unsupported Format
- File Not Found
- Export Failed
- Decode Failed

---

# 13. Shortcut

UI는 단축키를 지원한다.

예시

```
Ctrl+O

Ctrl+S

Ctrl+Z

Ctrl+Y

Ctrl+E
```

세부 단축키는 별도 문서에서 관리한다.

---

# 14. Future Components

향후 다음 UI를 추가할 수 있다.

- Histogram
- Layer Panel
- Mask Panel
- Preset Panel
- AI Panel

기존 Layout을 변경하지 않고
Dock 형태로 추가 가능해야 한다.

---

# 15. Related Documents

| Document | Description |
|----------|-------------|
| System_Architecture | 시스템 구조 |
| IPC_Architecture | UI와 Engine 통신 |
| Functional_Requirements | 기능 요구사항 |
| Use_Cases | 사용자 시나리오 |

---

# 16. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |