# Test Plan

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 테스트 계획(Test Plan)을 정의한다.

테스트는 기능, 성능, 안정성 및 사용성을 검증하여 시스템이 요구사항을 만족하는지 확인하는 것을 목적으로 한다.

본 문서는 테스트 대상, 범위, 방법 및 절차를 정의한다.

---

# 2. Test Objectives

본 테스트는 다음 사항을 검증한다.

- 기능 요구사항 충족 여부
- 비기능 요구사항 충족 여부
- 시스템 안정성
- 이미지 처리 정확성
- 사용자 Workflow
- Regression 방지

---

# 3. Test Scope

## Included

다음 기능을 테스트한다.

- Image Open
- Image Edit
- Preview
- Export
- Project Save / Load
- Undo / Redo

---

## Excluded

다음 항목은 본 테스트 범위에서 제외한다.

- AI 기능
- Plugin
- Cloud
- Login
- Network

---

# 4. Test Levels

## Unit Test

목적

개별 모듈을 검증한다.

대상

- Decoder
- Image Processing
- Color Conversion
- Export

---

## Integration Test

목적

컴포넌트 간 연동을 검증한다.

대상

- UI ↔ IPC
- IPC ↔ Engine
- Engine ↔ Rendering

---

## System Test

목적

전체 시스템이 정상 동작하는지 검증한다.

---

## Acceptance Test

최종 사용자 관점에서 시스템을 검증한다.

Acceptance_Test.md를 따른다.

---

# 5. Test Environment

## Hardware

다음 정보를 기록한다.

- CPU
- Memory
- GPU
- Storage

---

## Software

- Operating System
- Build Configuration
- Application Version

---

# 6. Test Categories

## Functional Test

기능 검증

---

## Performance Test

성능 검증

Performance_Test.md를 따른다.

---

## Reliability Test

안정성 검증

---

## Compatibility Test

운영체제 및 이미지 포맷 검증

---

## Regression Test

기존 기능이 정상 동작하는지 확인한다.

---

# 7. Functional Test Items

## Image

- Open
- Close
- Reload

---

## Edit

- Exposure
- Contrast
- White Balance
- Curve
- Crop
- Rotate
- Resize
- LUT

---

## Preview

- Preview Update
- Zoom
- Pan

---

## Project

- Save
- Load

---

## Export

- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

## History

- Undo
- Redo

---

# 8. Test Procedure

각 테스트는 다음 절차를 따른다.

```
Initialize

↓

Execute

↓

Verify

↓

Record Result

↓

Cleanup
```

---

# 9. Test Data

다양한 이미지를 사용한다.

## Resolution

- Small
- Medium
- Large
- Very Large

---

## Format

- RAW
- JPEG
- PNG
- TIFF

---

## Color Space

- sRGB
- Adobe RGB
- Display P3
- HDR (향후)

---

# 10. Test Matrix

| Category | Test |
|----------|------|
| Image | Open |
| Image | Close |
| Edit | Exposure |
| Edit | Curve |
| Geometry | Crop |
| Geometry | Rotate |
| Export | JPEG |
| Export | PNG |
| Project | Save |
| Project | Load |

---

# 11. Expected Results

각 테스트는 다음 중 하나의 결과를 가진다.

- PASS
- FAIL
- BLOCKED
- SKIPPED

---

# 12. Defect Classification

## Critical

프로그램 종료

데이터 손실

원본 이미지 손상

---

## Major

주요 기능 사용 불가

---

## Minor

기능은 동작하지만 오류 존재

---

## Trivial

UI 오탈자

정렬 문제

---

# 13. Traceability

모든 테스트는 요구사항과 연결된다.

| Requirement | Test |
|-------------|------|
| FR-IMG-* | Image Test |
| FR-EDIT-* | Edit Test |
| FR-GEO-* | Geometry Test |
| FR-EXPORT-* | Export Test |
| FR-HISTORY-* | History Test |

---

# 14. Exit Criteria

테스트는 다음 조건을 만족하면 완료된다.

- 모든 Critical Defect 해결
- 모든 Functional Test 완료
- Performance Test 완료
- Acceptance Test 통과

---

# 15. Related Documents

| Document | Description |
|----------|-------------|
| Software_Requirements_Specification | 시스템 요구사항 |
| Functional_Requirements | 기능 요구사항 |
| NonFunctional_Requirements | 비기능 요구사항 |
| Performance_Test | 성능 테스트 |
| Acceptance_Test | 인수 테스트 |

---

# 16. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |