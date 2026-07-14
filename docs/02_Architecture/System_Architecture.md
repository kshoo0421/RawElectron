# System Architecture

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron 시스템의 전체 아키텍처를 정의한다.

RawElectron은 UI와 Image Processing Engine을 명확하게 분리한 Layered Architecture를 채택한다.

본 문서는 시스템을 구성하는 주요 컴포넌트와 그들의 역할, 관계 및 데이터 흐름을 설명한다.

세부 구현은 각 Architecture 문서를 따른다.

---

# 2. Architecture Goals

RawElectron은 다음 목표를 가진다.

- UI와 Engine의 독립성
- Platform Independent Core
- Local First
- Non-Destructive Editing
- High Performance
- Scalability
- Maintainability

---

# 3. System Overview

RawElectron은 다음 구성 요소로 이루어진다.

```
User
        │
        ▼
 React / Electron
        │
        ▼
      IPC Layer
        │
        ▼
 C++ Image Engine
        │
        ▼
 Local File System
```

시스템은 UI Layer와 Engine Layer를 명확하게 분리한다.

---

# 4. Layer Architecture

```
+--------------------------------------------------+
|                  Presentation Layer              |
|--------------------------------------------------|
| React UI                                         |
| Electron                                          |
+--------------------------------------------------+

                    │

+--------------------------------------------------+
|                Communication Layer               |
|--------------------------------------------------|
| IPC                                               |
+--------------------------------------------------+

                    │

+--------------------------------------------------+
|                 Application Layer                |
|--------------------------------------------------|
| Image Engine                                      |
+--------------------------------------------------+

                    │

+--------------------------------------------------+
|                   Domain Layer                   |
|--------------------------------------------------|
| Image Processing                                 |
| Rendering                                         |
| Project Management                               |
+--------------------------------------------------+

                    │

+--------------------------------------------------+
|             Infrastructure Layer                 |
|--------------------------------------------------|
| File System                                      |
| Image Decoder                                    |
| Image Encoder                                    |
+--------------------------------------------------+
```

---

# 5. System Components

RawElectron은 다음 주요 컴포넌트로 구성된다.

## UI

역할

- 사용자 입력
- 화면 표시
- 프로젝트 관리
- Engine 제어

상세 내용은

UI_Design.md

참조

---

## IPC

역할

- Command 전달
- Event 전달

상세 내용은

IPC_Architecture.md

참조

---

## Image Engine

역할

- 이미지 관리
- 편집
- 렌더링
- 저장

상세 내용은

Engine_Architecture.md

참조

---

## Rendering

역할

- Preview 생성
- Export 생성

상세 내용은

Rendering_Architecture.md

참조

---

## Local Storage

역할

- 원본 이미지
- 프로젝트 파일
- Export

---

# 6. Component Relationships

```
User

↓

UI

↓

Command

↓

Engine

↓

Preview

↓

UI

↓

Export

↓

File
```

---

# 7. Data Flow

## Image Open

```
User

↓

Open Image

↓

Engine

↓

Decode

↓

Preview

↓

UI
```

---

## Editing

```
User

↓

Edit

↓

Engine

↓

Preview

↓

UI
```

---

## Export

```
User

↓

Export

↓

Engine

↓

Full Render

↓

Save
```

---

# 8. Responsibilities

| Component | Responsibility |
|------------|----------------|
| UI | 사용자 인터페이스 |
| IPC | UI와 Engine 연결 |
| Engine | 이미지 처리 |
| Rendering | 이미지 생성 |
| Storage | 파일 입출력 |

각 Component는 자신의 책임만 수행한다.

---

# 9. Dependency Rules

다음 의존성을 허용한다.

```
ImageCore
   ↑
Interfaces / Codec / Processing / Renderer
   ↑
Engine
   ↑
IPC
   ↑
Electron UI
```

`Codec`, `Processing`, `Renderer`는 서로를 참조하지 않는다. 외부 라이브러리는
이를 사용하는 모듈의 private 구현 세부사항으로만 노출한다. 예를 들어 LibRaw는
`Codec`, OpenCV는 `Processing` 내부에서만 직접 사용한다.

다음 의존성은 허용하지 않는다.

```
Engine

↓

React

X
```

```
Rendering

↓

Electron

X
```

```
Image Processing

↓

UI

X
```

---

# 10. Design Principles

시스템은 다음 원칙을 따른다.

## Separation of Concerns

각 Component는 하나의 책임만 가진다.

---

## Layered Architecture

상위 Layer는 하위 Layer를 사용한다.

반대 방향 참조는 허용하지 않는다.

---

## Local First

모든 작업은 로컬 환경에서 수행한다.

---

## Non-Destructive Editing

원본 이미지는 변경하지 않는다.

---

## Engine Driven

이미지 처리 로직은 모두 Engine에서 수행한다.

---

## UI Independence

Engine은 UI Framework에 의존하지 않는다.

---

# 11. Extension Points

향후 다음 기능을 추가할 수 있다.

- GPU Rendering
- AI Module
- Layer
- Mask
- Plugin
- HDR
- Panorama

기존 Layer 구조를 변경하지 않고 확장 가능해야 한다.

---

# 12. Related Documents

| Document | Description |
|-----------|-------------|
| Project_Overview | 프로젝트 개요 |
| Engine_Architecture | Engine 구조 |
| IPC_Architecture | IPC 구조 |
| Rendering_Architecture | Rendering 구조 |
| UI_Design | UI 설계 |

---

# 13. Repository Contract

실제 저장소의 최상위 경계는 다음과 같다.

```text
apps/electron/       Electron main, preload, React renderer
engine/Interfaces/   엔진 공통 추상화
engine/ImageCore/    공통 이미지 데이터
engine/Codec/        이미지 입출력과 포맷별 어댑터
engine/Processing/   순수 이미지 처리 연산
engine/Renderer/     Proxy, Tile Cache, Viewport 렌더링
engine/Engine/       Session, History, Job Queue, Cache 조정
engine/IPC/          Electron용 Command/Event/Serializer 경계
third_party/         외부 라이브러리
docs/                요구사항과 설계 문서
tools/               개발 및 검증 도구
test/                단위 및 통합 테스트
```

각 엔진 모듈은 자체 `include/`와 `src/`를 가지며, 다른 모듈의 `src/`를 참조하지
않는다. 모듈 간 사용은 공개 헤더와 CMake target을 통해서만 이루어진다.

루트의 `build.py`가 플랫폼별 OpenCV/NASM 준비, CMake/Ninja 엔진 빌드, native addon 빌드, Electron 패키징의
단일 진입점이다.

---

# 14. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |
| 0.2 | 2026-07-12 | 모듈 의존성과 실제 저장소 계약 추가 |
