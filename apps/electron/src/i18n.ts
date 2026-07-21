import type { AppLocale } from './shared/appSettings';

let activeLocale: AppLocale = 'ko';

const english: Record<string, string> = {
  '이미지 편집기': 'Image editor', '편집 기록': 'Edit history', '실행 취소': 'Undo', '다시 실행': 'Redo',
  '파일 열기': 'Open files', '저장 형식': 'Save format', '저장 중…': 'Saving…', '다른 이름으로 저장': 'Save as',
  '시스템 모드': 'System mode', '라이트 모드': 'Light mode', '다크 모드': 'Dark mode', '설정': 'Settings', '일반': 'General',
  '언어': 'Language', '한국어': 'Korean', '영어': 'English', '화면 모드': 'Appearance', '닫기': 'Close',
  '파일 목록': 'File library', '+ 폴더': '+ Folder', '+ 파일': '+ File', '최상위로 이동': 'Go to top',
  '파일과 폴더가 없습니다.': 'There are no files or folders.', '원본 보기': 'Original', '미리보기': 'Preview',
  '로딩 중': 'Loading', '불러오는 중': 'Loading', '불러오기 실패': 'Load failed', '로딩 완료': 'Loaded',
  '편집할 이미지를 여세요': 'Open an image to edit',
  'RAW와 일반 이미지 파일을 불러와 조정하고 다른 형식으로 저장할 수 있습니다.': 'Open RAW or standard images, adjust them, and save them in another format.',
  '이미지 선택': 'Choose images', '이미지를 불러오는 중입니다': 'Loading image',
  '이미지를 불러오지 못했습니다': 'Could not load image',
  '원본 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.': 'The source file may be damaged or unsupported.',
  '화면 맞춤': 'Fit', '확대 축소': 'Zoom', '히스토그램 비활성': 'Histogram unavailable',
  '히스토그램 숨기기': 'Hide histogram', '히스토그램 보기': 'Show histogram', '로그 닫기': 'Close logs',
  '보정': 'Adjust', '자르기·회전': 'Crop & rotate', '전체 초기화': 'Reset all',
  '이미지를 여기에 놓으세요': 'Drop images here', '여러 파일을 한 번에 추가할 수 있습니다.': 'You can add multiple files at once.',
  '별명 변경 (F2)': 'Rename (F2)', '폴더로 이동': 'Move to folder', '폴더 없음': 'No folder',
  '목록에서 삭제': 'Remove from list', '하위 폴더 만들기': 'Create subfolder', '폴더 이름 변경': 'Rename folder',
  '폴더 삭제': 'Delete folder', '내부 항목은 한 단계 위 폴더로 이동합니다.': 'Items inside will move up one folder.',
  '취소': 'Cancel', '확인': 'OK', '삭제': 'Delete', '이미지를 저장하고 있습니다': 'Saving image',
  '처리가 끝날 때까지 잠시 기다려 주세요.': 'Please wait until processing is complete.', '저장이 완료되었습니다': 'Save complete',
  '밝기': 'Light', '색상': 'Color', '효과': 'Effects', '디테일': 'Detail', '광학': 'Optics',
  '노출': 'Exposure', '대비': 'Contrast', '하이라이트': 'Highlights', '그림자': 'Shadows', '흰색': 'Whites', '검정': 'Blacks',
  '색온도': 'Temperature', '색조': 'Tint', '생동감': 'Vibrance', '채도': 'Saturation', '텍스처': 'Texture',
  '명료도': 'Clarity', '안개 제거': 'Dehaze', '비네팅': 'Vignette', '선명 효과': 'Sharpening', '노이즈 감소': 'Noise reduction',
  '자르기 및 변환': 'Crop & transform', '비율': 'Aspect ratio', '원본': 'Original', '자유': 'Free',
  '수평 맞춤': 'Straighten', '왼쪽 90°': 'Rotate left 90°', '오른쪽 90°': 'Rotate right 90°',
  '가로 뒤집기': 'Flip horizontal', '세로 뒤집기': 'Flip vertical', '자동 보정': 'Auto adjustment',
  '현재 사진의 밝기와 RGB 분포를 분석합니다.': 'Analyzes the current image brightness and RGB distribution.',
  '기본': 'Balanced', '따뜻하게': 'Warm', '차갑게': 'Cool', '선명하게': 'Vivid', '부드럽게': 'Soft',
  'XMP 가져오기': 'Import XMP', 'XMP 내보내기': 'Export XMP', '화이트 밸런스': 'White balance',
  'RGB 커브': 'RGB curve', '처리 로그': 'Processing log', '지우기': 'Clear', '표시할 로그가 없습니다.': 'No logs to display.',
  '이미지를 열어 편집을 시작하세요.': 'Open an image to start editing.',
  '파일 목록 패널 너비 조절': 'Resize file library panel', '옵션 패널 너비 조절': 'Resize options panel',
  '이미지 뷰포트. 방향키로 이동': 'Image viewport. Use arrow keys to pan', '자르기 영역. 방향키로 이동': 'Crop area. Use arrow keys to move',
  '자르기용 이미지를 만드는 중입니다…': 'Preparing crop image…', '미리보기를 만드는 중입니다…': 'Creating preview…',
  '수평 맞춤 각도': 'Straighten angle', '원본값': 'As shot', '일광': 'Daylight', '흐림': 'Cloudy', '그늘': 'Shade',
  '텅스텐': 'Tungsten', '형광등': 'Fluorescent', '더블클릭: 점 추가': 'Double-click: add point', '우클릭: 제거': 'Right-click: remove',
  '중간점': 'Midpoint', '원형률': 'Roundness', '페더': 'Feather', '밝은 영역': 'Highlights', '그레인': 'Grain',
  '크기': 'Size', '거칠기': 'Roughness', '반경': 'Radius', '세부 정보': 'Detail', '마스킹': 'Masking',
  '색상 노이즈 감소': 'Color noise reduction', '매끄러움': 'Smoothness', 'CA 제거': 'Remove chromatic aberration',
  '렌즈 교정 사용': 'Enable lens correction', '빨강 색조': 'Red hue', '빨강 채도': 'Red saturation',
  '초록 색조': 'Green hue', '초록 채도': 'Green saturation', '파랑 색조': 'Blue hue', '파랑 채도': 'Blue saturation',
  '어두운 영역 색조': 'Shadow hue', '어두운 영역 채도': 'Shadow saturation', '중간 영역 색조': 'Midtone hue',
  '중간 영역 채도': 'Midtone saturation', '밝은 영역 색조': 'Highlight hue', '밝은 영역 채도': 'Highlight saturation',
  '혼합': 'Blending', '균형': 'Balance',
  'XMP 프리셋을 적용했습니다.': 'Applied the XMP preset.', 'XMP 프리셋 가져오기 실패:': 'Failed to import XMP preset:',
  'XMP 프리셋 저장 완료:': 'XMP preset saved:', 'XMP 프리셋 내보내기 실패:': 'Failed to export XMP preset:',
  '저장된 파일 목록을 불러왔습니다.': 'Restored the saved file list.', '파일 목록 복원 실패:': 'Failed to restore file list:',
  '편집값 불러오기 실패:': 'Failed to load edits:', '드롭한 이미지를 여는 중입니다…': 'Opening dropped images…',
  '드롭 파일 열기 실패:': 'Failed to open dropped files:', '파일 열기 실패:': 'Failed to open files:',
  '이미지를 목록에서 제거했습니다. 원본 파일은 유지됩니다.': 'Removed the image from the list. The source file was kept.',
  '목록 제거 실패:': 'Failed to remove from list:', '이미지를 저장하고 있습니다…': 'Saving image…',
  '저장이 취소되었습니다.': 'Save canceled.', '저장 완료:': 'Saved:', '저장 실패:': 'Save failed:',
  '모든 조정을 초기화했습니다.': 'Reset all adjustments.', '미리보기 실패:': 'Preview failed:',
};

export function setLocale(locale: AppLocale) { activeLocale = locale; }
export function getLocale() { return activeLocale; }
export function t(source: string) {
  if (activeLocale !== 'en') return source;
  if (english[source]) return english[source];
  const opened = source.match(/^(\d+)개 이미지를 열었습니다\.$/);
  if (opened) return `Opened ${opened[1]} image${opened[1] === '1' ? '' : 's'}.`;
  const restored = source.match(/^(\d+)개 파일 목록을 복원했습니다\. 이미지를 불러오는 중입니다\.$/);
  if (restored) return `Restored ${restored[1]} file${restored[1] === '1' ? '' : 's'}. Loading images.`;
  return Object.entries(english)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((translated, [korean, translation]) => translated.replaceAll(korean, translation), source);
}
