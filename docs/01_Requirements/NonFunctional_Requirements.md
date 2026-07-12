# Non-Functional Requirements

## 1. Introduction

본 문서는 RawElectron이 만족해야 하는 비기능 요구사항(Non-Functional Requirements)을 정의한다.

비기능 요구사항은 시스템의 기능(Function)이 아니라 시스템이 제공해야 하는 품질(Quality Attributes)을 정의한다.

본 문서는 다음 항목을 포함한다.

- Performance
- Reliability
- Scalability
- Maintainability
- Portability
- Security
- Usability

---

# 2. Performance

## NFR-PERF-001

### Preview Response Time

사용자가 보정 값을 변경했을 때 Preview는 가능한 한 빠르게 갱신되어야 한다.

Target

- 평균 100ms 이하
- 최대 200ms 이하

---

## NFR-PERF-002

### UI Responsiveness

UI Thread는 이미지 처리로 인해 Block되지 않아야 한다.

Target

- UI FPS 60fps 유지
- UI Freeze 금지

---

## NFR-PERF-003

### Image Loading

지원하는 이미지 형식은 가능한 한 빠르게 로드되어야 한다.

Target

- 일반 JPEG : 1초 이하
- RAW : 가능한 한 빠르게 (파일 크기에 따라 달라질 수 있음)

---

## NFR-PERF-004

### Export

Export는 Background Task에서 수행되어야 한다.

Export 중에도 UI는 계속 동작해야 한다.

---

## NFR-PERF-005

### Multi-thread

CPU Core를 효율적으로 활용할 수 있어야 한다.

이미지 처리는 병렬 처리를 지원해야 한다.

---

## NFR-PERF-006

### SIMD

반복적인 Pixel Processing은 SIMD 최적화를 고려하여 구현한다.

---

## NFR-PERF-007

### Large Image

고해상도 이미지에서도 정상적으로 동작해야 한다.

Target

- 100MP 이상 이미지 지원

---

# 3. Memory

## NFR-MEM-001

원본 이미지는 하나만 유지한다.

---

## NFR-MEM-002

Undo/Redo는 가능한 한 이미지 전체 복사가 아닌 편집 파라미터 기반으로 관리한다.

---

## NFR-MEM-003

Shared Memory는 Preview Buffer 공유 용도로만 사용한다.

원본 이미지는 Shared Memory에 저장하지 않는다.

---

## NFR-MEM-004

필요하지 않은 Cache는 적절한 시점에 해제되어야 한다.

---

## NFR-MEM-005

불필요한 메모리 복사를 최소화한다.

---

# 4. Reliability

## NFR-REL-001

원본 이미지는 어떠한 경우에도 수정되지 않아야 한다.

---

## NFR-REL-002

Export 실패 시 원본 데이터는 유지되어야 한다.

---

## NFR-REL-003

프로젝트 저장 실패 시 기존 프로젝트 파일은 손상되지 않아야 한다.

---

## NFR-REL-004

예외 상황에서도 프로그램은 가능한 한 종료되지 않아야 한다.

---

# 5. Availability

## NFR-AVA-001

이미지 처리 중에도 UI는 사용자 입력을 받을 수 있어야 한다.

---

## NFR-AVA-002

Background Task 진행 상황을 사용자에게 표시해야 한다.

---

# 6. Scalability

## NFR-SCALE-001

새로운 이미지 포맷을 쉽게 추가할 수 있어야 한다.

---

## NFR-SCALE-002

새로운 보정 기능은 기존 Pipeline을 변경하지 않고 추가 가능해야 한다.

---

## NFR-SCALE-003

GPU Rendering을 추후 추가할 수 있는 구조여야 한다.

---

## NFR-SCALE-004

AI 기능은 별도의 Module 형태로 추가 가능해야 한다.

---

# 7. Maintainability

## NFR-MAIN-001

UI와 Image Engine은 독립적으로 개발 가능해야 한다.

---

## NFR-MAIN-002

Engine은 UI Framework에 의존하지 않아야 한다.

---

## NFR-MAIN-003

모듈 간 의존성을 최소화한다.

---

## NFR-MAIN-004

각 모듈은 단일 책임 원칙(SRP)을 따른다.

---

## NFR-MAIN-005

공통 기능은 재사용 가능한 라이브러리 형태로 관리한다.

---

# 8. Portability

## NFR-PORT-001

Windows를 우선 지원한다.

---

## NFR-PORT-002

macOS 지원이 가능하도록 설계한다.

---

## NFR-PORT-003

Platform Dependent Code는 최소화한다.

---

## NFR-PORT-004

Core Engine은 Platform Independent하도록 구현한다.

---

# 9. Security

## NFR-SEC-001

모든 처리는 로컬 환경에서 수행한다.

---

## NFR-SEC-002

사용자 이미지를 외부 서버로 전송하지 않는다.

---

## NFR-SEC-003

네트워크 연결 없이 동작 가능해야 한다.

---

# 10. Usability

## NFR-USE-001

일반적인 사진 보정 프로그램과 유사한 Workflow를 제공한다.

---

## NFR-USE-002

Preview는 사용자의 편집 의도를 빠르게 반영해야 한다.

---

## NFR-USE-003

Undo/Redo는 직관적으로 동작해야 한다.

---

# 11. Compatibility

지원 운영체제

- Windows
- macOS

지원 입력 형식

- RAW
- JPEG
- PNG
- TIFF

지원 출력 형식

- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

# 12. Logging

## NFR-LOG-001

치명적인 오류는 로그로 기록한다.

---

## NFR-LOG-002

디버그 로그는 Release Build에서 비활성화 가능해야 한다.

---

# 13. Coding Standards

프로젝트는 다음 원칙을 따른다.

- Layered Architecture
- Separation of Concerns
- Single Responsibility Principle
- RAII
- Modern C++
- Cross Platform Design

---

# 14. Verification

비기능 요구사항은 다음 문서를 통해 검증한다.

| Requirement | Verification |
|------------|--------------|
| Performance | Performance_Test.md |
| Reliability | Acceptance_Test.md |
| Maintainability | Code Review |
| Portability | Platform Test |
| Security | Acceptance Test |

---

# 15. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |