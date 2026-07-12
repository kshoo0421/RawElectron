# Use Cases

Version: 0.1

---

# 1. Introduction

## 1.1 Purpose

본 문서는 RawElectron의 주요 사용자 시나리오(Use Case)를 정의한다.

각 Use Case는 사용자가 특정 목적을 달성하기 위해 시스템과 상호작용하는 절차를 설명한다.

본 문서는 기능 구현 방법이 아닌 사용자 관점의 흐름을 정의한다.

---

# 2. Actors

| Actor | Description |
|--------|-------------|
| User | 사진을 편집하는 사용자 |

현재 시스템은 단일 사용자 환경을 가정한다.

---

# 3. Use Case List

| ID | Name |
|----|------|
| UC-001 | Open Image |
| UC-002 | Edit Image |
| UC-003 | Crop Image |
| UC-004 | Rotate Image |
| UC-005 | Undo / Redo |
| UC-006 | Save Project |
| UC-007 | Load Project |
| UC-008 | Export Image |

---

# UC-001 Open Image

## Goal

사용자가 로컬 이미지를 편집할 수 있도록 연다.

## Primary Actor

User

## Preconditions

- 프로그램이 실행 중이다.
- 이미지 파일이 존재한다.

## Main Flow

1. 사용자가 **Open Image**를 선택한다.
2. 파일 선택 창이 열린다.
3. 사용자가 이미지를 선택한다.
4. 시스템이 이미지를 로드한다.
5. 시스템이 Preview를 생성한다.
6. 편집 화면이 표시된다.

## Alternative Flow

4a.

이미지 형식이 지원되지 않는다.

→ 오류 메시지를 출력한다.

4b.

파일이 존재하지 않는다.

→ 오류 메시지를 출력한다.

## Postconditions

- 이미지가 편집 가능한 상태가 된다.

---

# UC-002 Edit Image

## Goal

사용자가 사진을 보정한다.

## Primary Actor

User

## Preconditions

- 이미지가 열려 있다.

## Main Flow

1. 사용자가 Exposure를 변경한다.
2. 시스템이 Preview를 갱신한다.
3. 사용자가 Contrast를 변경한다.
4. 시스템이 Preview를 갱신한다.
5. 사용자가 Curve를 수정한다.
6. 시스템이 Preview를 갱신한다.

## Alternative Flow

사용자가 Reset을 선택한다.

→ 해당 항목이 기본값으로 복원된다.

## Postconditions

- 편집 파라미터가 변경된다.

---

# UC-003 Crop Image

## Goal

이미지를 원하는 영역으로 자른다.

## Preconditions

이미지가 열려 있다.

## Main Flow

1. Crop Tool 선택
2. Crop 영역 지정
3. Crop 적용
4. Preview 갱신

## Postconditions

Crop 정보가 프로젝트에 저장된다.

---

# UC-004 Rotate Image

## Goal

이미지를 회전한다.

## Main Flow

1. Rotate Tool 선택
2. 회전 각도 지정
3. Preview 갱신

---

# UC-005 Undo / Redo

## Goal

이전 편집 상태를 복원한다.

## Main Flow

1. Undo 선택
2. 시스템이 이전 상태를 복원한다.
3. Preview를 다시 생성한다.

### Redo

1. Redo 선택
2. 이후 상태를 복원한다.
3. Preview를 갱신한다.

---

# UC-006 Save Project

## Goal

편집 상태를 프로젝트 파일로 저장한다.

## Preconditions

이미지가 열려 있다.

## Main Flow

1. Save Project 선택
2. 저장 위치 선택
3. 프로젝트 저장

## Postconditions

프로젝트 파일이 생성된다.

---

# UC-007 Load Project

## Goal

저장된 프로젝트를 불러온다.

## Preconditions

프로젝트 파일이 존재한다.

## Main Flow

1. Open Project 선택
2. 프로젝트 선택
3. 프로젝트 로드
4. 원본 이미지 확인
5. 편집 상태 복원
6. Preview 생성

## Alternative Flow

원본 이미지가 존재하지 않는다.

→ 사용자에게 원본 이미지 위치를 요청한다.

---

# UC-008 Export Image

## Goal

최종 이미지를 저장한다.

## Preconditions

이미지가 열려 있다.

## Main Flow

1. Export 선택
2. 저장 형식 선택
3. 저장 옵션 선택
4. 저장 위치 선택
5. Engine이 원본 해상도로 렌더링한다.
6. 이미지 저장 완료

## Alternative Flow

저장 실패

→ 오류 메시지 출력

## Postconditions

최종 이미지가 저장된다.

---

# 4. Use Case Relationships

```

Open Image
↓
Edit Image
├─────────────┐
│ │
Crop Rotate
│ │
└──────┬──────┘
↓
Undo / Redo
↓
Save Project
↓
Export Image

```

---

# 5. Traceability

| Use Case | Related Requirements |
|------------|---------------------|
| UC-001 | FR-IMG-001 |
| UC-002 | FR-EDIT-* |
| UC-003 | FR-GEO-* |
| UC-004 | FR-GEO-* |
| UC-005 | FR-HISTORY-* |
| UC-006 | FR-PROJECT-* |
| UC-007 | FR-PROJECT-* |
| UC-008 | FR-EXPORT-* |

---

# 6. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |