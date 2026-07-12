# Acceptance Test

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron의 인수 테스트(Acceptance Test) 기준을 정의한다.

Acceptance Test는 기능 구현 여부가 아니라,
프로젝트가 고객에게 인도 가능한 수준인지 판단하기 위한 최종 검수 기준이다.

세부 테스트 절차는 Test_Plan.md를 따른다.

---

# 2. Acceptance Policy

프로젝트는 다음 조건을 모두 만족해야 인수 완료로 간주한다.

- 기능 요구사항 충족
- 비기능 요구사항 충족
- 주요 사용 시나리오 정상 동작
- 치명적인 결함(Critical Defect) 없음

---

# 3. Functional Acceptance

## AT-FUNC-001

이미지를 열 수 있어야 한다.

Acceptance Criteria

- 지원하는 이미지 형식이 정상적으로 열린다.
- 이미지 정보가 올바르게 표시된다.
- Preview가 생성된다.

---

## AT-FUNC-002

사진 보정 기능이 정상적으로 동작해야 한다.

Acceptance Criteria

다음 기능이 정상 동작한다.

- Exposure
- Contrast
- White Balance
- Curve
- Crop
- Rotate
- Resize
- LUT

---

## AT-FUNC-003

Undo / Redo가 정상 동작해야 한다.

Acceptance Criteria

편집 상태가 올바르게 복원된다.

---

## AT-FUNC-004

프로젝트 저장 및 불러오기가 정상 동작해야 한다.

Acceptance Criteria

- 프로젝트 저장
- 프로젝트 열기
- 편집 상태 복원

---

## AT-FUNC-005

이미지를 저장할 수 있어야 한다.

Acceptance Criteria

지원하는 모든 출력 형식에서 저장이 성공해야 한다.

---

# 4. Performance Acceptance

## AT-PERF-001

Preview는 사용자가 조작 가능한 수준으로 동작해야 한다.

Acceptance Criteria

- UI가 멈추지 않는다.
- Preview가 정상적으로 갱신된다.

성능 수치는 Performance_Test.md를 따른다.

---

## AT-PERF-002

Export 중에도 UI는 계속 동작해야 한다.

Acceptance Criteria

- UI 입력 가능
- 진행률 표시
- 프로그램 응답 유지

---

# 5. Reliability Acceptance

## AT-REL-001

원본 이미지는 변경되지 않아야 한다.

Acceptance Criteria

원본 파일의 내용이 변경되지 않는다.

---

## AT-REL-002

예외 상황에서도 프로그램이 비정상 종료되지 않아야 한다.

예시

- 잘못된 파일
- 지원하지 않는 형식
- 저장 실패

---

## AT-REL-003

프로젝트 저장 실패 시 기존 프로젝트는 손상되지 않아야 한다.

---

# 6. Compatibility Acceptance

다음 환경에서 정상 동작해야 한다.

## Operating System

- Windows
- macOS

---

## Input Formats

- RAW
- JPEG
- PNG
- TIFF

---

## Output Formats

- JPEG
- PNG
- TIFF
- JXR
- AVIF

---

# 7. Workflow Acceptance

다음 대표 시나리오가 정상적으로 수행되어야 한다.

## Workflow 1

Open

↓

Edit

↓

Save Project

↓

Load Project

↓

Export

---

## Workflow 2

Open

↓

Crop

↓

Rotate

↓

Undo

↓

Redo

↓

Export

---

## Workflow 3

Open

↓

Multiple Adjustments

↓

Reset

↓

Export

---

# 8. User Acceptance

다음 작업이 일반 사용자 기준에서 자연스럽게 수행되어야 한다.

- 이미지 열기
- 사진 보정
- 프로젝트 저장
- 이미지 저장

사용자는 별도의 기술 지식 없이 기본 기능을 사용할 수 있어야 한다.

---

# 9. Defect Criteria

Acceptance 이전에 해결되어야 하는 결함

- Crash
- Data Loss
- Image Corruption
- Project Corruption

다음 결함은 인수 여부에 영향을 주지 않을 수 있다.

- UI Alignment
- Minor Layout Issues
- 오탈자

단, 고객과 협의하여 결정한다.

---

# 10. Acceptance Matrix

| Category | Acceptance |
|----------|------------|
| Functional | PASS |
| Performance | PASS |
| Reliability | PASS |
| Compatibility | PASS |
| Workflow | PASS |

모든 항목이 PASS인 경우 프로젝트를 완료된 것으로 간주한다.

---

# 11. Related Documents

| Document | Description |
|----------|-------------|
| Software_Requirements_Specification | 시스템 요구사항 |
| Functional_Requirements | 기능 요구사항 |
| NonFunctional_Requirements | 비기능 요구사항 |
| Use_Cases | 사용자 시나리오 |
| Test_Plan | 테스트 계획 |
| Performance_Test | 성능 테스트 |

---

# 12. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |