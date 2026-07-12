# Project File Format

Version: 0.1

---

# 1. Purpose

본 문서는 RawElectron 프로젝트 파일(Project File)의 논리적인 구조를 정의한다.

프로젝트 파일은 이미지 자체를 저장하는 것이 아니라,
편집 상태와 프로젝트 정보를 저장하여 동일한 작업 환경을 복원하는 것을 목적으로 한다.

본 문서는 저장해야 하는 데이터와 저장하지 않는 데이터를 정의하며,
실제 파일 포맷(JSON, Binary 등)은 구현에서 결정한다.

---

# 2. Design Goals

프로젝트 파일은 다음 목표를 가진다.

- Non-Destructive Editing
- Small File Size
- Fast Save / Load
- Version Compatibility
- Forward Compatibility
- Backward Compatibility

---

# 3. File Structure

프로젝트 파일은 다음 정보를 포함한다.

```
Project

├── Project Information

├── Images

├── Edit States

├── Project Settings

├── History (Optional)

└── Metadata
```

---

# 4. Project Information

프로젝트 자체에 대한 정보이다.

예시

- Project Name
- Project Version
- Created Time
- Modified Time
- Application Version

---

# 5. Image Information

프로젝트에서 사용하는 이미지 목록이다.

각 이미지는 다음 정보를 가진다.

- Image Identifier
- Original Image Path
- File Name
- File Format

원본 이미지는 프로젝트 파일에 포함하지 않는다.

---

# 6. Edit State

이미지의 편집 상태를 저장한다.

예시

- Exposure
- Contrast
- White Balance
- Tone
- HSL
- Curve
- Crop
- Rotation
- Resize
- LUT

편집은 항상 파라미터 형태로 저장한다.

---

# 7. Project Settings

프로젝트 공통 설정이다.

예시

- Working Color Space
- Default Export Format
- Default Export Quality
- Grid Visibility
- Snap Options

---

# 8. Metadata

프로젝트와 관련된 메타데이터이다.

예시

- Author
- Description
- Tags
- Copyright

---

# 9. History

Undo / Redo를 저장할 수 있다.

History 저장은 구현 정책에 따라 선택 사항이다.

History는 이미지 전체가 아닌
편집 상태 변경 이력을 저장한다.

---

# 10. Relationships

```
Project

│

├──────────────┐

│              │

▼              ▼

Image      Settings

│

▼

Edit State

│

▼

History
```

---

# 11. File Policy

프로젝트 파일은 다음 데이터를 저장하지 않는다.

- Original Image Pixel Data
- Preview Buffer
- Proxy Image
- Render Cache
- Temporary Files

프로젝트 파일은 원본 이미지의 위치를 참조한다.

---

# 12. Image Reference

원본 이미지는 다음 방식으로 관리한다.

```
Project

↓

Image Path

↓

Original Image
```

프로젝트를 열 때 원본 이미지가 존재하지 않으면
사용자에게 새로운 위치를 요청한다.

---

# 13. Save Process

프로젝트 저장 순서

```
Collect Project State

↓

Validate

↓

Serialize

↓

Write File

↓

Complete
```

저장 실패 시 기존 파일은 유지되어야 한다.

---

# 14. Load Process

프로젝트 열기 순서

```
Read File

↓

Deserialize

↓

Restore Project

↓

Locate Images

↓

Restore Edit State

↓

Generate Preview
```

---

# 15. Version Compatibility

모든 프로젝트 파일은 버전 정보를 가진다.

새로운 버전은 기존 프로젝트를 가능한 한 열 수 있어야 한다.

읽을 수 없는 경우 사용자에게 명확한 오류를 제공한다.

---

# 16. Extension

향후 다음 정보를 저장할 수 있다.

- Layer
- Mask
- Brush
- AI Result
- Preset
- Color Label
- Rating

기존 프로젝트 파일 구조를 변경하지 않고 확장 가능해야 한다.

---

# 17. Related Documents

| Document | Description |
|----------|-------------|
| Data_Model | 데이터 모델 |
| Domain_Model | 도메인 모델 |
| Engine_API | 엔진 인터페이스 |
| Image_Processing_Pipeline | 처리 파이프라인 |

---

# 18. Revision History

| Version | Date | Description |
|----------|------|-------------|
| 0.1 | YYYY-MM-DD | Initial Draft |