# Project Overview

## 1. Project Introduction

RawElectron은 Electron 기반 UI와 C++ 기반 이미지 처리 엔진을 결합하여 구현하는 **로컬 사진 보정 프로그램(Local Photo Editor)** 프로젝트이다.

프로젝트의 핵심 철학은 다음과 같다.

> **UI와 엔진을 완전히 분리하고, AI가 모듈 단위로 개발하기 쉬운 구조를 만든다.**

본 프로젝트는 Adobe Lightroom와 유사한 사진 보정 워크플로우를 참고하지만, 특정 제품을 그대로 재현하는 것을 목표로 하지 않는다.

대신 다음과 같은 목표를 가진다.

- 빠른 이미지 편집
- 직관적인 사용자 경험
- 고성능 이미지 처리
- 비파괴 편집(Non-Destructive Editing)
- 플랫폼 독립적인 구조
- 장기적으로 확장 가능한 아키텍처
- 작은 모듈과 명확한 공개 API를 통한 AI 협업 가능성

---

# 2. Background

최근 사진 편집 프로그램은 AI 기능, 클라우드 서비스, 계정 시스템, 온라인 협업 등 다양한 기능을 포함하고 있다.

하지만 실제 사진 보정 자체와는 직접적인 관련이 없는 기능이 증가하면서 시스템 구조가 복잡해지고 있다.

RawElectron은 이러한 기능을 제외하고, **사진 보정이라는 본질적인 기능**에 집중하는 프로젝트이다.

본 프로젝트는 다음과 같은 방향을 추구한다.

- Local First
- Engine First
- Performance First
- Extensible Architecture

---

# 3. Project Objectives

프로젝트의 주요 목표는 다음과 같다.

## Functional Objectives

- RAW 이미지 열기
- 사진 보정
- 비파괴 편집
- 다양한 이미지 포맷 저장
- 빠른 Preview
- 프로젝트 저장 및 불러오기

## Technical Objectives

- Electron 기반 Desktop Application
- React 기반 UI
- C++ 기반 Image Processing Engine
- Cross Platform Architecture
- 멀티스레드 처리
- SIMD 최적화
- GPU 확장 가능 구조

---

# 4. Project Scope

## Included

초기 개발 범위는 다음 기능을 포함한다.

### Image

- RAW
- JPEG
- PNG
- TIFF
- JXR
- AVIF

### Editing

- Exposure
- Contrast
- White Balance
- Tone Curve
- HSL
- Crop
- Rotate
- Resize
- LUT
- Sharpen
- Noise Reduction (Basic)

### Export

- JPEG
- PNG
- TIFF
- JXR
- AVIF

### Workflow

- Project Save
- Project Load
- Undo
- Redo
- Preview

---

## Excluded

다음 기능은 초기 프로젝트 범위에서 제외한다.

### AI

- AI Denoise
- AI Mask
- AI Object Selection
- AI Auto Correction
- Face Detection

### Network

- Login
- Cloud Sync
- Online Storage
- Collaboration
- User Account

### External Integration

- Mobile Application
- Plugin Marketplace
- External Editor Integration

---

# 5. Target Users

본 프로젝트는 다음 사용자를 대상으로 한다.

- 사진 촬영을 즐기는 일반 사용자
- RAW 사진을 보정하는 사용자
- 빠른 이미지 편집이 필요한 사용자
- 로컬 환경에서 작업하기를 원하는 사용자

---

# 6. Product Characteristics

RawElectron은 다음과 같은 특징을 가진다.

- 로컬 기반 프로그램
- 비파괴 편집
- 빠른 Preview
- 원본 이미지 보존
- 대용량 이미지 처리 지원
- 확장 가능한 구조

---

# 7. Success Criteria

프로젝트는 다음 목표를 만족하는 것을 목표로 한다.

### Usability

- 직관적인 UI
- 빠른 작업 흐름

### Performance

- 대용량 이미지 지원
- 부드러운 Preview
- 빠른 Export

### Maintainability

- 명확한 계층 구조
- 독립적인 모듈
- 확장 가능한 설계

### Reliability

- 원본 이미지 손상 방지
- 안정적인 저장
- 예측 가능한 동작

---

# 8. Future Expansion

초기 프로젝트 완료 이후 다음 기능을 고려할 수 있다.

- GPU Rendering
- Layer
- Mask
- Brush
- Panorama
- HDR Merge
- Batch Processing
- Preset
- Plugin
- AI Module

단, 이러한 기능은 기존 구조를 변경하지 않고 모듈 형태로 확장 가능하도록 설계하는 것을 목표로 한다.

---

# 9. Related Documents

프로젝트의 상세 내용은 다음 문서를 참고한다.

| Document | Description |
|-----------|-------------|
| Software_Requirements_Specification | 요구사항 명세 |
| Functional_Requirements | 기능 요구사항 |
| NonFunctional_Requirements | 비기능 요구사항 |
| Use_Cases | 사용자 시나리오 |
| System_Architecture | 시스템 구조 |
| Engine_Architecture | 엔진 구조 |
| IPC_Architecture | UI-Engine 통신 구조 |
| UI_Design | UI 설계 |
| Image_Processing_Pipeline | 이미지 처리 파이프라인 |
| Engine_API | 엔진 인터페이스 |
| IPC_API | IPC 인터페이스 |
| Project_File_Format | 프로젝트 파일 구조 |
| Test_Plan | 테스트 계획 |

---

# 10. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |
