# Domain Model

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron이 다루는 도메인(Domain)을 정의한다.

Domain Model은 프로그램이 관리하는 핵심 개념(Entity)과 그 관계를 설명하며,
데이터 구조나 구현 방식은 포함하지 않는다.

세부 데이터는 Data_Model.md에서 정의한다.

---

# 2. Domain Overview

RawElectron은 사진 편집(Photo Editing) 도메인을 대상으로 한다.

프로그램은 다음 핵심 도메인을 관리한다.

```
Project

Image

Edit Session

Preview

History

Export
```

---

# 3. Core Domain

## Project

프로젝트 전체를 의미한다.

Project는

- 하나 이상의 Image
- Project Settings
- History

를 관리한다.

---

## Image

사용자가 편집하는 하나의 사진이다.

Image는

- Original
- Preview
- Metadata
- Edit State

를 가진다.

Image는 프로젝트의 중심 Entity이다.

---

## Edit Session

사용자가 현재 수행하는 편집 작업이다.

Edit Session은

- Edit State
- Tool State
- Preview

를 관리한다.

---

## Preview

화면에 표시되는 결과이다.

Preview는

Original Image와

Edit State를 기반으로 생성된다.

---

## Export

최종 결과물이다.

Export는

- Format
- Quality
- Metadata

등을 포함한다.

---

## History

사용자의 편집 이력을 관리한다.

History는

Edit State의 변경 기록을 관리한다.

---

# 4. Domain Relationships

```
Project

│

├──────────────┐

│              │

▼              ▼

Image       History

│

├──────────────┐

│              │

▼              ▼

Edit Session Metadata

│

▼

Preview

│

▼

Export
```

---

# 5. Domain Responsibilities

## Project

책임

- 프로젝트 관리
- 이미지 관리
- 저장
- 불러오기

---

## Image

책임

- 원본 이미지 관리
- Preview 생성
- Metadata 관리

---

## Edit Session

책임

- 편집 상태 관리
- Tool 상태 관리

---

## Preview

책임

- 화면 표시
- 사용자 피드백

---

## History

책임

- Undo
- Redo

---

## Export

책임

- 최종 이미지 생성
- 저장

---

# 6. Domain Rules

다음 규칙을 따른다.

## Original Image는 수정되지 않는다.

모든 편집은 Edit Session에서 관리된다.

---

## Preview는 항상 Edit Session을 기반으로 생성된다.

Preview는 원본 이미지가 아니다.

---

## Export는 Original Image를 기반으로 수행된다.

Preview를 저장하지 않는다.

---

## History는 이미지를 저장하지 않는다.

History는 편집 상태를 저장한다.

---

## Project는 원본 이미지를 포함하지 않는다.

Project는

원본 이미지의 위치와 편집 상태를 저장한다.

---

# 7. Domain Lifecycle

```
Project

↓

Image Open

↓

Edit Session

↓

Preview

↓

History

↓

Export

↓

Close
```

---

# 8. Aggregate Boundaries

Project는 Aggregate Root이다.

```
Project

├── Image

├── History

└── Settings
```

Image는 다음 Aggregate를 가진다.

```
Image

├── Metadata

├── Edit Session

└── Preview
```

---

# 9. Domain Events

도메인에서는 다음 이벤트가 발생할 수 있다.

```
ImageOpened

EditStateChanged

PreviewUpdated

ProjectSaved

ProjectLoaded

ExportStarted

ExportFinished
```

Domain Event는 UI Event와 구분된다.

---

# 10. Future Extensions

다음 Domain은 향후 추가될 수 있다.

- Layer
- Mask
- Brush
- Preset
- AI Module

기존 Domain을 변경하지 않고
새로운 Entity로 확장 가능해야 한다.

---

# 11. Related Documents

| Document | Description |
|----------|-------------|
| Data_Model | 데이터 모델 |
| Engine_Architecture | Engine 구조 |
| Image_Processing_Pipeline | 처리 파이프라인 |
| Project_File_Format | 프로젝트 구조 |

---

# 12. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |