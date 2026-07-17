# RawElectron

> High-performance local RAW image editor prototype built with Electron, React, and C++.

## 데스크톱 앱 패키징

Electron 앱은 플랫폼별 네이티브 런타임을 포함하므로 대상 운영체제에서 빌드한다.

Windows x64 설치 프로그램(Squirrel.Windows)은 다음 명령으로 만든다.

```powershell
python package.py
```

완료 후 루트의 `installer/RawElectron-Setup.exe`가 생성된다.
설치 프로그램을 실행하면 사용자 계정에 앱과 시작 메뉴 바로가기가 설치되며, Windows의
`설정 > 앱 > 설치된 앱 > RawElectron`에서 일반 앱과 동일하게 제거할 수 있다.

macOS에서는 네이티브 의존성을 macOS용으로 빌드한 뒤 아래 명령으로 `.app` ZIP을 만든다.

```bash
python3 package.py
```

macOS 결과물도 동일하게 루트의 `installer` 폴더에 모인다.

명시적으로 플랫폼과 아키텍처를 검사하려면 `--platform windows --arch x64` 또는
`--platform macos --arch arm64`를 지정할 수 있다. 네이티브 라이브러리 때문에 다른
운영체제용 패키지의 교차 빌드는 허용하지 않는다.

---

# Overview

RawElectron은 **Electron 기반 UI**와 **C++ 기반 이미지 처리 엔진**를 분리하여 구현하는 로컬 사진 보정 프로그램 프로젝트이다.

본 프로젝트는 Lightroom와 유사한 사진 보정 기능을 목표로 하지만, 초기에는 다음과 같은 기능은 개발 범위에서 제외한다.

- AI 기반 기능
- Cloud Sync
- Account/Login
- Online Service
- External Service Integration
- Collaboration

대신 **사진 보정 엔진 자체의 완성도와 성능**에 집중한다.

---

# Project Goals

## Functional Goals

- RAW Image Processing
- Non-Destructive Editing
- Proxy Preview
- Photo Development
- High Quality Export

## Technical Goals

- Electron + React UI
- C++ Image Engine
- IPC-based Architecture
- Multi-thread Rendering
- SIMD Optimization
- GPU Extensible Architecture
- Cross Platform Design

---

# Design Principles

본 프로젝트는 다음 원칙을 따른다.

### Local First

모든 기능은 로컬 환경에서 동작한다.

### Engine Driven

UI는 Engine을 제어하는 역할만 수행하며,
이미지 처리는 모두 C++ Engine에서 수행한다.

### Non-Destructive Editing

원본 이미지는 절대 수정하지 않는다.

모든 편집은 파라미터 기반으로 관리한다.

### High Performance

대용량 이미지에서도 부드러운 Preview와 빠른 Export를 목표로 한다.

### Scalable Architecture

AI, Layer, GPU 등의 기능은 초기 개발 범위에는 포함하지 않지만,
향후 확장 가능한 구조를 유지한다.

---

# System Architecture

```
┌───────────────┐
│ React UI      │
└───────┬───────┘
        │
┌───────▼───────┐
│ Electron      │
└───────┬───────┘
        │ IPC
┌───────▼───────┐
│ C++ Engine    │
└───────┬───────┘
        │
┌───────▼───────┐
│ Image Pipeline│
└───────┬───────┘
        │
┌───────▼───────┐
│ File System   │
└───────────────┘
```

UI와 Engine은 명확하게 분리한다.

IPC에서는 이미지 데이터를 전달하지 않으며,
명령(Command)과 상태(State)만 교환한다.

---

# Repository Structure

```
RawElectron/

├── apps/electron/      # Electron main / preload / React renderer
├── engine/             # C++ engine modules
├── third_party/        # Third-party libraries
├── docs/               # Project documents
├── tools/              # Development tools
├── test/               # Unit and integration tests
│
│   ├── 00_Project/
│   ├── 01_Requirements/
│   ├── 02_Architecture/
│   ├── 03_Design/
│   ├── 04_Interface/
│   ├── 05_Test/
│   └── 99_Appendix/
│
├── build.py
├── clean.py
├── run.py
└── README.md
```

---

# Documentation

프로젝트 문서는 `doc` 디렉터리에서 관리한다.

| Directory | Description |
|------------|-------------|
| 00_Project | 프로젝트 개요 및 목표 |
| 01_Requirements | 요구사항 명세 |
| 02_Architecture | 시스템 및 엔진 구조 |
| 03_Design | 상세 설계 |
| 04_Interface | Engine / IPC 인터페이스 |
| 05_Test | 테스트 계획 |
| 99_Appendix | 참고 자료 및 조사 문서 |

---

# Documentation Flow

문서는 다음 순서로 읽는 것을 권장한다.

```
Project Overview
        │
        ▼
Software Requirements
        │
        ▼
Use Cases
        │
        ▼
Architecture
        │
        ▼
Design
        │
        ▼
Interface
        │
        ▼
Test
```

각 문서는 하나의 책임만 가진다.

- Requirements는 **무엇을 개발하는지**를 정의한다.
- Architecture는 **어떻게 구성하는지**를 정의한다.
- Design은 **구현 구조를 설계**한다.
- Interface는 **컴포넌트 간 계약**을 정의한다.
- Test는 **품질을 검증**한다.

---

# Development Philosophy

RawElectron은 다음과 같은 개발 원칙을 지향한다.

- Layered Architecture
- Separation of Concerns
- High Cohesion / Low Coupling
- Single Responsibility Principle
- Non-Destructive Editing
- Performance First
- Maintainable Codebase
- Testable Design

---

# Current Status

현재 프로젝트는 **Architecture & Specification Phase**에 있다.

문서화를 통해 전체 시스템 구조를 먼저 설계한 후,
UI 및 Engine 구현을 순차적으로 진행한다.

---

# License

Not decided yet.
