# Documentation Audit

Version: 0.1  
Date: 2026-07-12

## 점검 기준

> UI와 엔진을 완전히 분리하고, AI가 모듈 단위로 개발하기 쉬운 구조를 만든다.

## 결과

| 기준 | 관련 문서 | 상태 | 보완 사항 |
|---|---|---|---|
| 프로젝트 목표와 범위 | `Project_Overview.md` | 충족 | 핵심 철학 문구를 명시함 |
| 기능 요구사항 | `Functional_Requirements.md` | 충족 | 구현 시 요구사항 ID와 테스트 연결 필요 |
| 성능·메모리·플랫폼 | `NonFunctional_Requirements.md` | 충족 | 수치 목표를 벤치마크로 검증 필요 |
| UI/Engine 분리 | `System_Architecture.md`, `IPC_Architecture.md` | 충족 | 실제 코드 이전은 단계적으로 수행 |
| Proxy Preview | `Rendering_Architecture.md`, `Image_Processing_Pipeline.md` | 충족 | Tile Cache 정책의 구체적 한도 필요 |
| 핵심 데이터 모델 | `Data_Model.md`, `Domain_Model.md` | 부분 충족 | `Bitmap`, `Pixel`, `Color`, `Rect`, `Adjustment`의 C++ 계약 필요 |
| Engine 공개 API | `Engine_API.md`, `IPC_API.md` | 부분 충족 | 함수 시그니처, 비동기 취소, 버전 규칙을 구체화해야 함 |
| 단방향 모듈 의존성 | `System_Architecture.md` | 충족 | CMake target으로 경계를 강제함 |
| CMake + Ninja + 단일 빌드 | 저장소 `build.py`, `CMakeLists.txt` | 충족 | CI에서 Windows/macOS/Linux 검증 필요 |
| AI 모듈 단위 작업 | 프로젝트/아키텍처 문서 | 부분 충족 | 모듈별 완료 조건과 테스트 템플릿 필요 |

## 문서 유지 원칙

- 기존 문서를 삭제하거나 같은 내용을 새 문서로 중복 작성하지 않는다.
- 요구사항은 식별자를 유지하고, 설계와 테스트가 해당 식별자를 참조한다.
- 구현과 문서가 다르면 구현을 숨기지 않고 이 문서에 격차를 기록한다.
- 모듈 작업 요청에는 입력, 출력, 허용 의존성, 오류, 성능 기준, 테스트를 포함한다.

## 현재 구현 격차

- 기존 native addon은 아직 단일 C++ 파일에 디코딩과 처리 로직이 함께 있다.
- 신규 `engine/` 모듈은 빌드 가능한 경계부터 마련한 상태이며 기능 이전이 필요하다.
- Electron renderer도 단일 파일 비중이 커서 기능 패널 단위 분리가 필요하다.
- `third_party/opencv`에는 소스와 로컬 설치 산출물이 함께 있어 향후 의존성 획득 정책을 분리해야 한다.
