import type { AnswerFontPreset, FontSizePreset } from '../types/study';

export interface FontSizeOption {
  id: FontSizePreset;
  label: string;
  sizeLabel: string;
  answerPx: number;
  chatPx: number;
}

export interface AnswerFontOption {
  id: AnswerFontPreset;
  label: string;
  desc: string;
  sample: string;
  cssFamily: string;
  lineHeight: string;
  scaleMultiplier: number;
  previewClass: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { id: 'sm', label: '작게', sizeLabel: '13.5px', answerPx: 13.5, chatPx: 13 },
  { id: 'md', label: '보통', sizeLabel: '15px', answerPx: 15, chatPx: 14 },
  { id: 'lg', label: '크게', sizeLabel: '17px', answerPx: 17, chatPx: 16 },
  { id: 'xl', label: '아주 크게', sizeLabel: '19px', answerPx: 19, chatPx: 18 },
];

export const ANSWER_FONT_OPTIONS: AnswerFontOption[] = [
  {
    id: 'sans',
    label: '기본 고딕',
    desc: '깔끔하고 선명한 디지털 노트',
    sample: '핵심 원리부터 차근차근 정리해 볼까요?',
    cssFamily: '"Plus Jakarta Sans", "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: '1.76',
    scaleMultiplier: 1,
    previewClass: 'answer-font-sans',
  },
  {
    id: 'plex',
    label: 'IBM 플렉스 고딕',
    desc: '단정하고 균형 잡힌 학습 가독성',
    sample: '이차방정식의 근의 공식과 판별식 조건',
    cssFamily: '"IBM Plex Sans KR", "Plus Jakarta Sans", "Noto Sans KR", sans-serif',
    lineHeight: '1.76',
    scaleMultiplier: 1,
    previewClass: 'answer-font-plex',
  },
  {
    id: 'serif',
    label: '교과서 명조',
    desc: '문학·비문학 긴 글 정독에 편안함',
    sample: '작품 속 화자의 정서와 태도를 살펴보면',
    cssFamily: '"Noto Serif KR", Georgia, serif',
    lineHeight: '1.84',
    scaleMultiplier: 1,
    previewClass: 'answer-font-serif',
  },
  {
    id: 'gowun',
    label: '고운 돋움',
    desc: '부드럽고 눈이 편안한 노트 감성',
    sample: '개념 간 차이를 표로 비교하며 외워 봐요',
    cssFamily: '"Gowun Dodum", "Noto Sans KR", sans-serif',
    lineHeight: '1.8',
    scaleMultiplier: 1,
    previewClass: 'answer-font-gowun',
  },
  {
    id: 'handwriting',
    label: '나눔 손글씨 펜',
    desc: '공책에 직접 필기한 듯한 손글씨',
    sample: '시험 직전 꼭 기억해야 할 오답 체크!',
    cssFamily: '"Nanum Pen Script", "Noto Sans KR", cursive, sans-serif',
    lineHeight: '1.68',
    scaleMultiplier: 1.24,
    previewClass: 'answer-font-handwriting',
  },
];

export function getFontSizeOption(id: FontSizePreset): FontSizeOption {
  return FONT_SIZE_OPTIONS.find((opt) => opt.id === id) ?? FONT_SIZE_OPTIONS[1];
}

export function getAnswerFontOption(id: AnswerFontPreset): AnswerFontOption {
  return ANSWER_FONT_OPTIONS.find((opt) => opt.id === id) ?? ANSWER_FONT_OPTIONS[0];
}
