import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'node:zlib';
import CFB from 'cfb';
import JSZip from 'jszip';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';
const FAST_GATE_MODEL = 'gemini-3.1-flash-lite';

const STRICT_SUBJECT_NAMES: Record<string, string> = {
  korean: '국어',
  math: '수학',
  english: '영어',
  science: '과학',
  social: '사회',
  history: '역사',
  foreign: '제2외국어',
  informatics: '정보·AI',
};

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다. Settings > Secrets에서 API 키를 확인해 주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingAttachment {
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUBTRACK_LABELS: Record<string, string> = {
  reading: '독서(비문학)',
  literature: '현대·고전문학',
  grammar: '문법·언어와 매체 / 핵심 어법',
  writing: '서술형·논술 / 영작',
  'middle-algebra': '중등 대수·함수',
  'middle-geometry': '중등 도형·피타고라스',
  'common-math': '고등 공통수학',
  'math-1': '수학Ⅰ (지수·로그·삼각함수·수열)',
  'math-2': '수학Ⅱ (함수의 극한·미분·적분)',
  'calculus-prob': '미적분·확률과 통계·기하',
  syntax: '구문·독해',
  vocab: '어휘·숙어',
  physics: '물리학',
  chemistry: '화학',
  biology: '생명과학',
  earth: '지구과학',
  'general-social': '통합사회·일반사회',
  economy: '경제',
  'politics-law': '정치와 법',
  geography: '한국지리·세계지리',
  ethics: '윤리와 사상·생활과 윤리',
  'korean-premodern': '한국사(전근대사)',
  'korean-modern': '한국사(근현대사)',
  'world-history': '세계사',
  japanese: '일본어',
  chinese: '중국어',
  hanmun: '한문',
  'ai-basics': '인공지능 기초',
  coding: '파이썬·알고리즘',
  'data-ethics': '데이터·AI 윤리',
  general: '자유 대화',
  'study-coach': '학습 계획·공부법',
  'career-talk': '진로·세특 상담',
  'english-talk': '영어 회화 연습',
  auto: '자동 과목 판별',
  'math-photo': '수학·과학 문제 사진',
  'passage-photo': '국어·영어·탐구 사진',
  hwpx: '한글 (.hwpx) 문서',
  pdf: 'PDF 학습 문서',
  docx: '워드 (.docx) 문서',
  report: '수행평가 보고서',
  'class-ppt': '수업·개념 발표 PPT',
  'perf-ppt': '수행평가 발표 PPT',
  'pitch-ppt': '진로·탐구 피칭 PPT',
};

function resolveThinkingLevel(params: {
  thinkingDepth?: string;
  workspaceId: string;
  studyMode?: string;
  hasAttachments?: boolean;
  verifyMode?: boolean;
}): ThinkingLevel {
  if (params.verifyMode || params.thinkingDepth === 'deep') {
    return ThinkingLevel.XHIGH;
  }
  if (params.workspaceId === 'free-chat' && !params.hasAttachments) {
    return ThinkingLevel.MEDIUM;
  }
  return ThinkingLevel.HIGH;
}

function buildSystemInstruction(params: {
  workspaceId: string;
  subTrackId?: string;
  gradeLevel: 'middle' | 'high';
  studyMode: 'tutor' | 'fast' | 'solve-only' | 'performance';
  thinkingDepth?: 'standard' | 'deep';
  careerGoal?: string;
  connectCareer?: boolean;
  memoryContext?: string;
  verifyMode?: boolean;
}): string {
  const gradeDesc =
    params.gradeLevel === 'middle'
      ? '한국 중학교 교육과정 수준(직관적 비유, 기초 개념 확인, 내신 서술형 대비 중심)'
      : '한국 고등학교 교육과정 수준(내신·모의고사·수능 대비 심화 원리, 정확한 교과 용어, 자주 나오는 오답 함정 분석 중심)';

  const subTrackName = params.subTrackId ? SUBTRACK_LABELS[params.subTrackId] || params.subTrackId : '';
  const isSolveOnly = params.studyMode === 'solve-only';
  const isPerformance = params.studyMode === 'performance';
  const isVerifyMode = Boolean(params.verifyMode);

  const modeDesc =
    params.studyMode === 'solve-only'
      ? [
          '당신은 지금 [문제 · 풀이 전용 모드]입니다.',
          '개념 노트 정리, 배경 이론 설명, 서론·맺음말, 표 요약, 학습 팁, 진로 연계 부연은 모두 생략하세요.',
          '1) 학생이 문제나 사진/지문을 제공하면: 군더더기 없이 **문제(필요 시)** → **단계별 풀이 과정**(계산/근거를 빠짐없이 순서대로) → **최종 정답**만 간결하고 정확하게 출력하세요.',
          '2) 학생이 단원명이나 주제 또는 문제 생성을 요청하면: 개념 설명 노트 없이 바로 **문제**를 출제하고, 각 문제 바로 아래에 **풀이 과정**과 **정답**만 구분하여 출력하세요.',
        ].join(' ')
      : params.studyMode === 'performance'
        ? [
            '당신은 지금 [학교 수행평가 전문 코치 모드]입니다.',
            '한국 중·고등학생의 교과 수행평가(탐구 보고서, 비평문, 에세이, 실험 설계, 발표·토론, 포스터·카드뉴스, 코딩 프로젝트, 세특 연계 활동)를 단계별로 코칭합니다.',
            '1) 수행평가 안내문·루브릭(채점 기준표) 사진이나 텍스트가 첨부되면 가장 먼저 [필수 조건·글자 수·배점 기준 체크리스트 표]와 [감점 주의 포인트]를 뽑아 정리하세요.',
            '2) 주제 선정 요청 시: 교과 단원 핵심 개념과 연결되고 실제 자료 조사가 쉬우며 독창적인 주제 3가지를 [주제명 | 교과 개념 연결 | 탐구 방법·활용 자료 | 차별화 포인트]로 제안하세요.',
            '3) 보고서·발표 준비 요청 시: 탄탄한 목차·개요(서론-본론-결론 / 탐구 동기-과정-결과-성찰), 문단별 작성 뼈대, 예상 질문(Q&A) 3가지를 제시하세요.',
            '4) 학생이 작성한 초안을 보여주면: 무작정 대신 써주기보다 [잘된 점 / 루브릭 대비 부족·감점 위험 요소 / 구체적 문장·논리 수정안]으로 정밀 첨삭해 주세요.',
            '5) 통계·사례·논문·공식 자료가 필요하면 Google 검색 도구를 활용해 실제 검증된 출처와 링크도 함께 안내하세요.',
          ].join(' ')
        : params.studyMode === 'tutor'
          ? [
              '당신은 지금 [소크라테스식 튜터 모드]입니다.',
              '학생에게 첫 힌트를 줄 때도 반드시 내부 추론으로 문제 전체를 끝까지 풀고 검산하여 정확한 정답과 풀이 경로를 먼저 확정한 뒤, 학생이 요청한 현재 문제/개념의 첫 번째 실마리(힌트 1단계)와 짧은 유도 질문 1개만 제시하세요. 처음부터 최종 정답이나 다음 진도 내용을 미리 내주지 마세요.',
              '단, 학생이 이미 풀이 시도를 적었거나 "정답까지 끝까지 알려줘", "개념 전체 정리해 줘"라고 명시하면 요청한 범위 안에서 검산된 풀이를 명확하게 제공합니다.',
            ].join(' ')
          : [
              '당신은 지금 [심화 빠른 해설 모드]입니다.',
              '학생이 묻거나 지정한 범위 안에서 정확하게 답변하세요. 개념 전체 설명을 요청한 경우에만 [핵심 요약 → 원리 및 단계별 풀이/표 → 주의 포인트]로 구조화하고, 특정 값·뜻·한 단계·특정 문항만 물었을 때는 불필요한 서론이나 다음 진도 설명 없이 요청한 부분만 정확하게 답하세요.',
            ].join(' ');

  const subjectGuidanceMap: Record<string, string> = {
    korean: `과목 전문가: 국어 (${subTrackName || '국어 전반'}). 비문학은 문단별 중심 문장·논지 전개 방식·선지 판단 근거를, 문학은 화자/서술자·정서 태도·표현법·시어의 함축 의미를, 문법은 음운 변동·품사·문장 성분의 예외 규정까지 요청된 범위에 맞춰 설명하세요. 서술형 첨삭 시 [원문의 강점 / 감점 요인 / 모범 수정안]으로 구분하세요.`,
    math: `과목 전문가: 수학 (${subTrackName || '수학 전반'}). 모든 수식은 반드시 LaTeX 문법($...$ 인라인, $$...$$ 블록 수식)으로 작성하세요. 학생이 풀이 과정을 원할 때는 [원리 → 조건 점검 → 단계별 전개]를 정확히 보이고, 특정 값이나 한 단계만 물었을 때는 그 범위만 답하세요.`,
    english: `과목 전문가: 영어 (${subTrackName || '영어 전반'}). 구문 분석 요청 시 [주어(S) / 동사(V) / 목적어(O) / 보어(C) / 수식어구] 단위로 분석하고, 영작 첨삭 요청 시 [교정문 / 이유 / 대안 표현] 순으로 제시하세요. 요청한 문장/표현 외의 진도로 넘어가지 마세요.`,
    science: `과목 전문가: 과학 (${subTrackName || '통합과학'}). 물리 공식·화학 반응식·생명/지구 원리를 LaTeX($...$)와 단위를 정확히 표기해 설명하고, 탐구·실험 문항에서는 요청된 범위의 변인과 그래프 의미를 정확히 해석하세요.`,
    social: `과목 전문가: 사회 (${subTrackName || '사회 전반'}). 개념 비교 요청 시 Markdown 비교표로 정리하고, 경제·선거·헌법/사상 문제는 요청된 핵심 판별 기준에 맞춰 답하세요.`,
    history: `과목 전문가: 역사 (${subTrackName || '역사 전반'}). 요청된 시대·사건 범위 안에서 [배경 → 전개 → 결과 및 의의] 인과관계를 정리하고, 다음 시대로 임의로 넘어가지 마세요.`,
    foreign: `과목 전문가: 제2외국어 (${subTrackName || '일본어·중국어·한문'}). 일본어는 한자에 후리가나(예: 勉強(べんきょう))와 발음을, 중국어는 간체자 + 병음(성조 포함) + 뜻을, 한문은 음·뜻·부수 및 풀이를 요청된 범위에 맞춰 정확히 제시하세요.`,
    informatics: `과목 전문가: 정보 및 인공지능 (${subTrackName || '인공지능·코딩'}). 학생이 요청한 개념이나 코드 디버깅·구현 범위만 정확히 설명·작성하고, 요청하지 않은 확장 기능이나 다음 단계 심화 주제를 임의로 추가하지 마세요.`,
    'free-chat':
      params.subTrackId === 'english-talk'
        ? '역할: 친근한 AI 영어 회화 파트너. 학생의 말에 맞춰 중등/고등 수준의 자연스러운 구어체 2~4문장으로 답하고, 어색한 표현이 있을 때만 짧은 한 줄 교정 팁을 덧붙이세요.'
        : `역할: 다정한 AI 대화 메이트 (${subTrackName || '자유 대화'}). 학생이 말한 주제와 의도에 맞춰 자연스럽고 정확하게 답하되, 요청하지 않은 다른 주제나 다음 학습 과제를 억지로 제안하지 마세요.`,
    'doc-summary':
      '역할: 정밀 학습 문서 요약 AI. 학생이 별도 범위를 지정하지 않고 문서 전체 요약을 원할 때만 [핵심 요약 → 구조화 노트 → 비교표 → 출제 포인트]로 정리하고, 특정 쪽·문단·항목만 지시했으면 그 부분만 정확히 작업하세요.',
    'photo-analysis': `역할: 정밀 문제·필기 사진 분석 AI (${subTrackName || '자동 과목 판별'}). 학생이 특정 문제 번호나 영역만 지정하면 해당 부분만 풀고, 전체를 요청했을 때만 사진 속 모든 문제를 순서대로 풀이하세요. 수식은 LaTeX($...$)를 사용하세요.`,
    'doc-maker': `역할: 한글(.hwpx)·PDF·워드(.docx) 문서 제작 전문 AI (${subTrackName || '한글 문서'}). 학생이 요청한 주제·목차·범위 그대로 문서를 제작해 준다고 친절히 안내하세요.`,
    'ppt-maker': `역할: PPT(.pptx) 발표자료 제작 전문 AI (${subTrackName || '수업·개념 발표'}). 학생이 요청한 주제·장수·범위 그대로 슬라이드를 제작해 준다고 친절히 안내하세요.`,
  };

  const subjectDesc = subjectGuidanceMap[params.workspaceId] || '전 과목 학습 튜터';
  const strictSubjectName = STRICT_SUBJECT_NAMES[params.workspaceId];
  const isFreeChat = params.workspaceId === 'free-chat';

  const todayKo = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const parts = [
    isFreeChat
      ? '당신은 한국 중·고등학생을 위한 학습 앱 "STUDY:ON"의 대화형 AI 파트너입니다.'
      : '당신은 한국 중·고등학생을 위한 심화 학습 엔진 "STUDY:ON"의 과목별 전문 튜터입니다.',
    `기준 현재 날짜(한국 시간): ${todayKo}`,
    `대상 수준: ${gradeDesc}`,
    subjectDesc,
    [
      '[요청 범위 엄수 · 임의 진도 금지 (최우선 규칙)]:',
      '1) 학생이 말한 것·지시한 범위만 정확히 수행하세요. 요청하지 않은 다음 단원, 다음 단계 선행 설명, 추가 연습문제, 심화 확장, "이어서 ~도 배워봅시다 / 다음으로 ~해 볼까요?" 같은 임의의 진도 진행을 절대 하지 마세요.',
      '2) 학생이 특정 대상·범위(예: "1번만", "여기까지만", "뜻만 알려줘", "A개념만 설명해 줘", "개요만 짜줘", "수식 답만")를 지정하면 아래의 일반 구조·노트 템플릿·추가 제안보다 학생의 범위 지시를 최우선으로 우선시하고 그 밖의 내용은 절대 붙이지 마세요.',
      '3) 요청받은 내용에 대한 답변이 끝나면 불필요한 사족이나 다음 진도 안내 없이 깔끔하게 마치세요.',
    ].join('\n'),
    [
      '[사실 기반 답변 절대 원칙 — 거짓말·추측·지어내기 금지 (Zero-Fabrication)]:',
      '1) 검증된 사실만 말하기: 확실히 검증된 교과 원리, 정확한 계산 결과, 그리고 학생이 첨부한 자료·대화 기록에 실제로 있는 정보만 사실로 단정하여 답하세요.',
      '2) 모르는 것을 아는 척 지어내지 않기: 기억이 불확실하거나 확인할 수 없는 연도, 날짜, 통계 수치, 법률·조항, 판례, 연구·논문·책 제목, 저자, 인용문, 인물 행적, 최신 시사 정보, 웹사이트 주소(URL)는 절대 그럴듯하게 지어내지 마세요. 확인되지 않은 세부 사항은 "정확한 확인이 필요한 부분이라 추측으로 말씀드릴 수 없습니다"라고 솔직하게 구분해 밝히세요.',
      '3) 사실(Fact)과 추론·가정의 엄격한 분리: 객관적 사실과 해석·가정·가능성을 섞어 단정하지 마세요. 문제나 질문에 전제 조건이 부족하면 임의로 조건을 지어내어 맞추지 말고 부족한 조건을 먼저 짚어주세요.',
      '4) 첨부 자료·사료·대화 맥락 충실성: 첨부 파일이나 사진, 이전 대화 기록에 실제로 없는 수치·문장·근거를 마치 있던 것처럼 인용하지 말고, 흐리거나 가려져 판독 불가능한 부분은 절대 추측하지 말고 판독 불가임을 알리세요.',
      '5) 검색 결과 준수: Google 검색 도구가 사용된 경우, 검색 결과에서 실제로 확인된 출처와 내용만 인용하고 검색 결과에 없는 기관명·수치·URL을 임의로 덧붙이지 마세요.',
    ].join('\n'),
    isFreeChat ? '' : modeDesc,
  ].filter(Boolean);

  if (strictSubjectName) {
    parts.push(
      `[과목 전용 범위 및 대화 규칙 — 필수 준수]:\n` +
        `당신은 오직 "${strictSubjectName}" 과목 전용 AI 튜터입니다.\n` +
        `- [자연스러운 대화 · 수행평가 · 이전 대화 회상 허용]: 인사("안녕", "반가워"), ${strictSubjectName} 공부법·시험 대비·동기부여·고민 상담, "대화하듯 쉽게 설명해 줘", "전에 내가 했던 대화 기억해?"처럼 이전 학습/대화 기록을 묻고 이어가는 대화, 그리고 ${strictSubjectName} 과목의 **학교 수행평가**(안내문·루브릭 분석, 주제 선정, 탐구 보고서 개요, 초안 첨삭, 발표 대본·Q&A, 참고 자료 검색)는 적극적으로 도와주세요.\n` +
        `- [타 과목 문제/사진 차단]: 반대로 학생의 질문, 문제, 첨부 사진·문서가 "${strictSubjectName}" 교과가 아닌 명백히 다른 과목(예: 국어 AI에 수학 방정식/극한/미적분 사진이나 영어 문법 질문, 수학 AI에 역사/영어 독해 질문 등)이거나 학습과 무관한 요청이면 절대 대신 풀거나 답변하지 마세요.\n` +
        `- 거절 시에는 불필요한 풀이 없이 2~3문장으로 "현재 창은 **${strictSubjectName} 전용 AI**이므로 다른 과목 질문에는 답변할 수 없습니다. 아래 버튼으로 알맞은 과목 AI로 이동해 질문해 주세요."라고 정중하고 명확하게 안내하고, 맨 마지막 줄에 반드시 [[SWITCH:과목ID]] 형식으로 한 줄만 추가하세요. (가능한 과목ID: korean, math, english, science, social, history, foreign, informatics)\n` +
        `- 단, 국어 비문학(과학·경제 지문 독해), 영어 지문 독해, 과학·정보 속 교과 계산처럼 "${strictSubjectName}" 교과 학습·평가 자체에 해당하는 질문은 정상적으로 답변하세요.`
    );
  }

  if (isPerformance) {
    const perfTipsMap: Record<string, string> = {
      korean: '국어 수행평가 특화: 비평문·독후감·발표·토론 입론서·매체 기획안 작성 시 문단 논리, 인용의 적절성, 맞춤법·어휘 정확성을 집중 점검하세요.',
      math: '수학 수행평가 특화: 수학적 모델링·실생활 데이터 함수화·개념 확장 보고서 작성 시 수식($...$) 전개 근거와 그래프/조건 해석이 명확하도록 지도하세요.',
      english: '영어 수행평가 특화: 영어 에세이·스피치 대본·원서 비평 작성 시 문법·어휘 자연스러움 교정과 함께 발표 시 강조할 문장·핵심 표현도 짚어주세요.',
      science: '과학 수행평가 특화: 실험 탐구 보고서·과학 쟁점 보고서 작성 시 가설-변인 통제(독립·종속·통제변인)-데이터 해석-오차 원인 및 한계 성찰이 빠지지 않게 지도하세요.',
      social: '사회 수행평가 특화: 시사/사회문제 탐구·통계 해석·정책 제안서 작성 시 신뢰할 만한 통계·사례 출처와 찬반/다각적 관점을 균형 있게 구성하도록 도우세요.',
      history: '역사 수행평가 특화: 사료 비평·역사 신문·인물/사건 재평가 보고서 작성 시 시대적 맥락과 1차 사료/역사적 근거 인용을 강조하세요.',
      foreign: '제2외국어 수행평가 특화: 문화 비교 보고서, 자기소개·역할극 대본 작성 시 일본어 후리가나/중국어 성조·병음/한자 음·뜻과 문화적 배경을 정확히 짚어주세요.',
      informatics: '정보·AI 수행평가 특화: 파이썬 프로젝트·데이터 분석·AI 윤리 탐구 보고서 작성 시 문제 분해-알고리즘 설계-실행 코드·예외 처리-윤리적 고찰까지 체계적으로 코칭하세요.',
    };
    if (perfTipsMap[params.workspaceId]) {
      parts.push(perfTipsMap[params.workspaceId]);
    }
  }

  if (!isSolveOnly) {
    parts.push(
      '[학습 자료 검색 및 링크 안내]: 학생이 참고 자료, 웹사이트, 강의, 논문, 공식 문서, 기출 자료 링크를 요청하거나 설명에 신뢰할 만한 출처가 도움이 될 때는 Google 검색 도구를 활용해 실제로 존재하는 공신력 있는 사이트를 찾고, 답변 안에 클릭 가능한 Markdown 링크([사이트명](URL))도 함께 안내하세요. 검색 결과에 없는 가짜 URL은 절대 만들어내지 마세요.'
    );
  }

  if (!isFreeChat || isVerifyMode) {
    parts.push(
      '[문제 풀이 정확도 절대 원칙 — 자체 교차 검산 필수]:\n' +
        '1) 조건 전수 확인: 문제의 정의역, 단서 조항(단, x>0 등), 등호 포함 여부(> vs ≥), 부호(+/-), 단위, 극한 방향, 지문 단서를 한 글자도 놓치지 말고 먼저 확인하세요.\n' +
        '2) 2가지 독립 방법 교차 검산: 답을 출력하기 전에 내부 추론에서 반드시 원래 풀이와 독립적인 다른 방법(특수값·경계값 대입 검산, 역산, 미분↔적분 검산, 차원·단위 검증, 반례 탐색, 객관식 선지 1~5번 전수 검증)으로 결과가 일치하는지 확인하세요. 불일치가 발견되면 일치할 때까지 처음부터 다시 계산하세요.\n' +
        '3) 사진·PDF 판독 엄격성: 첨부 자료 속 작은 지수, 아래첨자, 마이너스 부호, 그래프 축과 눈금, 손글씨 풀이를 먼저 정확히 판독한 뒤 풀이하세요. 흐리거나 잘려서 확실하지 않은 숫자·기호는 절대 추측해서 풀지 말고 학생에게 확인을 요청하세요.\n' +
        '4) 오류 정정 태도: 학생이 풀이가 틀렸다고 지적하거나 재검산을 요청하면 기존 풀이를 합리화하지 말고 백지 상태에서 다시 풀어 오류가 발생한 정확한 줄과 원인을 밝혀 바로잡으세요.'
    );
  }

  if (isVerifyMode) {
    parts.push(
      '[독립 교차 검산 및 사실 검증(Fact & Logic Auditor) 모드 — 최우선 지침]:\n' +
        '학생이 직전 AI 답변에 거짓·오류·환각(Hallucination)이 없는지 검증해 달라고 요청했습니다.\n' +
        '1) 직전 AI의 답변이나 결론을 절대 그대로 믿고 두둔하지 마세요. 문제 풀이와 사실 주장을 모두 백지 상태에서 독립적으로 검증하세요.\n' +
        '2) 수식·문제 풀이인 경우: 다른 풀이법(별해, 대입 검산, 경계값·반례 체크)을 최소 1가지 이상 적용해 계산·부호·조건·선지 오류를 한 줄씩 감사(Audit)하세요.\n' +
        '3) 사실·개념·날짜·인물·법·통계·출처 주장인 경우: 실제로 검증된 사실 및 검색 결과와 대조해 과장되거나 지어낸 정보(없는 책/논문/인용/연도/수치)가 없는지 가려내고, 확인 불가능한 부분은 솔직히 "확인 불가"로 판정하세요.\n' +
        '4) 반드시 아래 3단 구조로 명확히 답변하세요:\n' +
        '   - **### 검증 결과**: 직전 답변이 사실·논리·정답 모두 정확한지, 아니면 어느 문장/단계에서 오류나 확인되지 않은 내용이 있었는지 첫 줄에 명확히 판정\n' +
        '   - **### 독립 재검산 · 사실 대조**: 백지 상태 재풀이, 대입/반례 검산 또는 검증된 근거 대조 내용\n' +
        '   - **### 최종 확정 답변**: 검증을 통과한 정확한 사실·정답과 주의할 점'
    );
  }

  if (params.thinkingDepth === 'deep' || isVerifyMode) {
    parts.push(
      '[최고 추론 검증 활성화]: 피상적인 요약에 그치지 말고 원리 유도, 예외 사례, 반례, 조건 경계값까지 논리적으로 빈틈없이 검증해 답변하세요.'
    );
  } else if (!isFreeChat) {
    parts.push(
      '중간 계산 근거와 핵심 논리는 절대 생략하지 말고 정확하게 단계별로 작성하되, 불필요한 장황한 인사나 반복 서론만 줄이세요.'
    );
  }

  if (
    !isSolveOnly &&
    (!isFreeChat || params.subTrackId === 'career-talk') &&
    params.careerGoal &&
    params.careerGoal.trim() &&
    params.connectCareer !== false
  ) {
    parts.push(
      `[학생 희망 진로/학과 참고 정보]: "${params.careerGoal.trim()}".\n` +
        (isFreeChat
          ? '대화 맥락에 잘 어울릴 때만 학생의 희망 진로·학과와 자연스럽게 연결해 조언하세요.'
          : isPerformance
            ? '수행평가 주제 추천이나 보고서 방향을 요청받은 경우에만 학생의 희망 진로·학과와 자연스럽게 연결해 세특(세부능력 및 특기사항) 경쟁력을 높일 수 있는 탐구 방향을 함께 제안해 주세요.'
            : '학생이 특정 단답·부분 풀이·한정된 범위("이것만", "특정 문항만")만 요청한 경우에는 진로 섹션을 붙이지 마세요. 학생이 단원 개념 전반을 폭넓게 묻거나 진로/세특 연계를 요청한 경우에만 마지막에 `### 진로 연계 · 세특 탐구 포인트`를 2~3줄로 간략히 덧붙이세요.')
    );
  }

  parts.push(
    isFreeChat
      ? '상대방과 편하게 주고받는 대화처럼 간결하고 자연스럽게 답하세요(지나치게 긴 보고서 형식은 피하고, 개념 정리나 코드·수식이 꼭 필요할 때만 Markdown이나 LaTeX($...$)를 사용하세요).'
      : isSolveOnly
        ? '답변은 한국어로 간결하게 작성하며 노트 형식의 서론·요약·부연 설명을 일절 넣지 말고 **### 문제**, **### 풀이 과정**, **### 정답** 구조로 요청된 문제와 풀이만 명확하게 제시하세요. 수식은 LaTeX($...$, $$...$$)를 사용하고, 이미지/문서에서 흐리거나 가려져 판독이 불가능한 부분은 지어내지 말고 해당 부분을 알려주세요.'
        : isPerformance
          ? '답변은 한국어로 명확하고 실행 가능하게 구조화(Markdown 제목, 체크리스트 표, 단계별 개요/첨삭 비교)하여 학생이 요청한 단계만 작성하세요. 요청하지 않은 다음 단계까지 미리 작성해 넘기지 말고, 판독 불가한 배점·조건은 학생에게 확인을 요청하세요.'
          : '질문이 개념 정리·문제 풀이면 Markdown 제목(##, ###), 목록, 표를 활용해 깔끔하게 정리하고, 특정 질문이나 좁은 범위만 물었을 때는 핵심만 간결히 답하세요. 여러 장의 사진이나 문서가 첨부된 경우 학생이 특정 번호·페이지를 지정했다면 그 부분만, 지정하지 않았다면 각 자료를 순서대로 빠짐없이 반영하되 판독 불가 부분은 지어내지 말고 알려주세요.'
  );

  if (!isSolveOnly) {
    parts.push(
      '[문서 · PDF · 한글(.hwpx) · 워드(.docx) · PPT(.pptx) 직접 제작 및 형식 전환 지원]:\n' +
        '이 앱(STUDY:ON)은 PDF, 한글(.hwpx), 워드(.docx), PPT(.pptx) 파일을 실제로 생성·전환하고 다운로드하는 내장 스튜디오 기능을 갖추고 있습니다.\n' +
        '- 학생이 "PPT 만들어줘", "발표자료 만들어줘", "한글 파일(hwp/hwpx)로 만들어줘", "PDF로 만들어줘", "워드 문서로 작성해줘", "첨부한 PPT를 PDF/한글/워드로 전환(변환)해줘", "첨부한 문서를 PPT로 바꿔줘"처럼 제작 또는 형식 전환을 요청하면 절대 "파일을 생성/변환할 수 없다"고 거절하지 마세요.\n' +
        '- 대신 1) 요청에 맞는 완성도 높은 초안(PPT 요청이면 슬라이드별 제목·핵심 불릿·발표 대본 구조, 문서/보고서 요청이면 제목·개요·본론 목차·표·결론 구조, 형식 전환 요청이면 원본 자료의 핵심 내용과 수치·표를 빠짐없이 대상 형식에 맞게 재구성한 내용)을 깔끔하게 작성해 보여주고,\n' +
        '- 2) 답변 맨 마지막 줄에 반드시 `[[DOC_READY:형식|제목]]` 태그를 한 줄로 출력하세요.\n' +
        '  * 형식은 반드시 `pptx` (PPT/발표자료/슬라이드), `hwpx` (한글/HWP/HWPX), `docx` (워드/Word), `pdf` (PDF) 중 **변환·제작 목표 형식** 정확히 하나만 쓰세요.\n' +
        '  * 예: PPT를 PDF로 전환 요청 시 `[[DOC_READY:pdf|...]]`, 문서를 한글로 전환 시 `[[DOC_READY:hwpx|...]]`\n' +
        '- 학생이 파일 제작·전환을 요청하지 않은 일반 학습 질문에는 `[[DOC_READY:...]]` 태그를 붙이지 마세요.'
    );
  }

  if (params.memoryContext && params.memoryContext.trim()) {
    parts.push(
      `[이전 대화 기억 · 연속 학습 맥락]:\n` +
        `아래는 이 학생이 이전에 당신(같은 AI) 및 다른 AI들과 나눈 최근 대화·오답노트 기록입니다.\n` +
        `- 학생이 "전에 물어본 거", "아까 얘기한 내용", "지난번 대화 기억해?", "이전에 공부했던 것 이어서" 등을 언급하거나 맥락이 이어질 때는 아래 기록을 자연스럽게 기억하고 연결해서 답하세요.\n` +
        `- 학생이 별도로 과거 대화를 묻지 않는 일반적인 새 질문일 때는 과거 이야기를 억지로 길게 반복하지 말고, 꼭 필요한 연결 포인트만 가볍게 참고하세요.\n` +
        `- 아래 기록이나 현재 대화에 실제로 없는 내용은 절대 있었던 것처럼 지어내지 마세요.\n\n` +
        params.memoryContext.trim()
    );
  }

  return parts.join('\n\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let primaryModelCooldownUntil = 0;
let gateCooldownUntil = 0;
let searchToolCooldownUntil = 0;

function isRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.toLowerCase().includes('rate limit') ||
    raw.toLowerCase().includes('quota')
  );
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    isRateLimitError(err) ||
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('Service Unavailable') ||
    raw.includes('high demand') ||
    raw.includes('500') ||
    raw.includes('INTERNAL') ||
    raw.includes('ECONNRESET') ||
    raw.includes('ETIMEDOUT') ||
    raw.includes('fetch failed') ||
    raw.includes('대기 시간이 초과')
  );
}

function extractRetryDelayMs(err: unknown): number | null {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i) || raw.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.ceil(seconds * 1000), 6000);
}

function needsWebSearchForChat(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length < 4) return false;
  return /링크|사이트|웹사이트|웹\s*검색|검색해|찾아\s*줘|찾아줘|참고\s*자료|참고자료|출처|논문|통계|기사|뉴스|최신|최근|현재|요즘|올해|작년|202[4-9]|홈페이지|공식\s*페이지|무료\s*(사이트|강의|앱)|추천.*(사이트|강의|앱|자료|책)|사실|팩트|거짓|진짜|맞나요|맞아\?|실제로|확실해|검증|팩트체크|몇\s*년|언제\s*(개정|시행|발생|설립|출시|시작|끝|태어|사망)|누가\s*(만들|발명|썼|지었|수상|대통령)|입시|모집요강|교육과정\s*개정|수능\s*(일정|개편|등급)|법률|법안|조항|판례|노벨상|수상|인구|면적|환율|금리|물가|url|http/i.test(
    trimmed
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkSubjectRelevance(
  ai: GoogleGenAI,
  params: {
    workspaceId: string;
    prompt: string;
    attachments: IncomingAttachment[];
    recentHistory: IncomingMessage[];
  }
): Promise<{
  isRelevant: boolean;
  detectedSubjectId?: string;
  reason?: string;
}> {
  const subjectName = STRICT_SUBJECT_NAMES[params.workspaceId];
  if (!subjectName) {
    return { isRelevant: true };
  }

  // Only invoke extra classifier call when multimodal files/images are uploaded;
  // text-only prompts are checked inside the primary model's single call to save 50% RPM/RPD quota.
  const hasBinaryMedia = params.attachments.some((a) => Boolean(a.dataBase64));
  if (!hasBinaryMedia || Date.now() < gateCooldownUntil) {
    return { isRelevant: true };
  }

  try {
    const parts: Array<Record<string, unknown>> = [];
    params.attachments.forEach((att, idx) => {
      if (att.dataBase64 && att.mimeType) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.dataBase64,
          },
        });
      }
      if (att.textContent) {
        parts.push({
          text: `[첨부 텍스트 ${idx + 1}: ${att.name}]\n${att.textContent.slice(0, 2000)}`,
        });
      }
    });

    const prevTurn = params.recentHistory
      .slice(-2)
      .map((m) => `${m.role === 'user' ? '학생' : 'AI'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    parts.push({
      text: [
        `현재 AI 과목: ${subjectName} (${params.workspaceId})`,
        prevTurn ? `[직전 대화 맥락]\n${prevTurn}` : '',
        `[학생의 현재 요청]\n${params.prompt || '(첨부 자료 분석/풀이 요청)'}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });

    const response = await withTimeout(
      ai.models.generateContent({
        model: FAST_GATE_MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction:
            `당신은 한국 중·고등학생 학습 앱의 과목 판별기입니다. 학생이 현재 선택한 과목("${subjectName}") 전용 AI 튜터에게 보낸 메시지와 첨부 이미지/문서가 허용되는지 판별하세요.\n` +
            `- [허용(isRelevant=true)]:\n` +
            `  1) "${subjectName}" 교과 개념, 문제, 참고 자료/링크 검색 요청, 공부법·시험 대비·동기부여 질문\n` +
            `  2) "${subjectName}" 과목의 학교 수행평가 준비(안내문·루브릭 분석, 탐구 주제 추천, 보고서 개요·초안 첨삭, 발표 대본, 세특 연계, 참고자료 찾기) 및 "${subjectName}" 학습 내용을 문서·PDF·한글·워드·PPT 자료로 제작해 달라는 요청\n` +
            `  3) 튜터와의 자연스러운 인사·대화("안녕", "반가워", "고마워", "힘들어", "대화하듯 쉽게 설명해 줘", "조금 더 천천히 알려줘") 및 직전 대화의 후속 질문\n` +
            `  4) 국어 비문학(과학·경제 지문을 국어 독해 문제로 물어보는 경우)처럼 현재 과목 학습 자체에 해당하는 자료\n` +
            `- [차단(isRelevant=false)]:\n` +
            `  1) 첨부 이미지·문서나 질문 내용이 "${subjectName}"이 아닌 명백히 다른 과목 문제/학습 질문인 경우(예: 수학 문제·수식·극한·미적분·기하 사진이면 detectedSubjectId="math", 영어 문제/지문이면 "english", 물리/화학/생명/지구과학이면 "science", 한국사/세계사면 "history", 경제/정치/법/지리/윤리면 "social", 일본어/중국어/한문이면 "foreign", 코딩/AI면 "informatics", 국어 문학/문법/비문학이면 "korean").\n` +
            `  2) 학습·튜터 대화와 전혀 무관한 외부 주제 요청(예: 게임 공략, 연예인 가십 등)이면 detectedSubjectId="none"을 반환하세요.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRelevant: { type: Type.BOOLEAN },
              detectedSubjectId: {
                type: Type.STRING,
                description:
                  'korean, math, english, science, social, history, foreign, informatics, 또는 none 중 하나',
              },
              reason: {
                type: Type.STRING,
                description: '왜 해당 과목이 아닌지 1문장 한국어 설명',
              },
            },
            required: ['isRelevant', 'detectedSubjectId', 'reason'],
          },
        },
      }),
      4500,
      'subject gate timeout'
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      isRelevant?: boolean;
      detectedSubjectId?: string;
      reason?: string;
    };

    if (parsed.isRelevant === false) {
      return {
        isRelevant: false,
        detectedSubjectId: parsed.detectedSubjectId,
        reason: parsed.reason,
      };
    }
  } catch (err) {
    if (isRateLimitError(err)) {
      gateCooldownUntil = Date.now() + 60_000;
    }
    // Fail-open on classifier timeout/error; main systemInstruction still enforces strict subject scope
  }

  return { isRelevant: true };
}

async function withRetry<T>(
  fn: (attempt: number, useFallbackModel: boolean) => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const preferFallback = Date.now() < primaryModelCooldownUntil;
    const useFallbackModel = preferFallback || attempt >= 2;
    try {
      return await fn(attempt, useFallbackModel);
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && !useFallbackModel) {
        primaryModelCooldownUntil = Date.now() + 60_000;
      }
      if (attempt < maxRetries && isTransientError(err)) {
        const suggestedDelay = extractRetryDelayMs(err);
        const delayMs = suggestedDelay ?? (isRateLimitError(err) ? 1800 * (attempt + 1) : 450 * Math.pow(2, attempt));
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function extractReadableErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { message?: string } | string;
        message?: string;
      };
      const nested =
        (typeof parsed.error === 'object' && parsed.error?.message) ||
        (typeof parsed.error === 'string' && parsed.error) ||
        parsed.message;
      if (nested && nested !== trimmed) {
        return extractReadableErrorMessage(nested);
      }
    } catch {
      // ignore JSON parse failure
    }
  }
  return raw;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  console.error('[Gemini Error]', raw.slice(0, 600));
  if (raw.includes('GEMINI_API_KEY')) {
    return { status: 500, message: raw };
  }
  if (
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('Service Unavailable') ||
    raw.includes('high demand')
  ) {
    return {
      status: 503,
      message:
        '현재 AI 서버에 요청이 일시적으로 몰려 응답이 지연되고 있습니다. 잠시 후 아래 "다시 시도" 버튼을 눌러 주세요.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('400')) {
    return {
      status: 400,
      message: 'Gemini API 키가 유효하지 않거나 권한이 없습니다. Settings > Secrets 패널에서 GEMINI_API_KEY를 확인해 주세요.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    const isDailyOrProjectQuota =
      raw.includes('PerDay') ||
      raw.includes('per day') ||
      raw.includes('free_tier') ||
      raw.includes('limit: 0');
    return {
      status: 429,
      message: isDailyOrProjectQuota
        ? '연결된 Gemini API 키의 일일/무료 할당량이 모두 소진되었습니다. Settings > Secrets에서 다른 API 키 또는 유료 등급 키를 확인하거나 내일 다시 이용해 주세요.'
        : '분당 요청 한도(RPM)에 잠시 도달했습니다. 약 10~20초 뒤 아래 "다시 시도" 버튼을 눌러 주세요.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: `요청한 AI 모델(${MODEL_NAME})을 찾을 수 없습니다.`,
    };
  }
  if (raw.includes('500') || raw.includes('INTERNAL')) {
    return {
      status: 502,
      message: 'AI 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
  const readable = extractReadableErrorMessage(raw);
  return {
    status: 500,
    message: `AI 응답 생성 중 오류가 발생했습니다: ${readable}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  app.get('/api/export-project.zip', async (_req, res) => {
    try {
      const rootDir = path.resolve(__dirname);
      const excludedDirs = new Set([
        'node_modules',
        'dist',
        'build',
        'coverage',
        '.git',
        '.vercel',
        '.aistudio',
        '.idea',
        '.vscode',
        '.next',
        '.cache',
      ]);
      const excludedPathPrefixes = ['public/assets/aistudio'];
      const zip = new JSZip();
      let hasReadme = false;

      const walk = async (dirPath: string) => {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const fullPath = path.resolve(dirPath, entry.name);
          if (!fullPath.startsWith(rootDir + path.sep)) continue;
          const relPosix = path.relative(rootDir, fullPath).split(path.sep).join('/');

          if (
            excludedPathPrefixes.some(
              (prefix) => relPosix === prefix || relPosix.startsWith(`${prefix}/`)
            )
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            if (excludedDirs.has(entry.name)) continue;
            await walk(fullPath);
            continue;
          }

          if (!entry.isFile()) continue;

          const fileName = entry.name;
          const isEnvSecret =
            fileName === '.env' ||
            (fileName.startsWith('.env.') && fileName !== '.env.example');
          const isExcludedFile =
            isEnvSecret ||
            fileName === '.DS_Store' ||
            fileName === 'Thumbs.db' ||
            fileName === 'DRAFT_firestore.rules' ||
            fileName.endsWith('.log') ||
            fileName.endsWith('.tsbuildinfo') ||
            fileName.endsWith('.pem') ||
            fileName.endsWith('.key') ||
            fileName.endsWith('.zip');

          if (isExcludedFile) continue;

          if (relPosix.toLowerCase() === 'readme.md') {
            hasReadme = true;
          }

          const content = await fs.promises.readFile(fullPath);
          zip.file(relPosix, content);
        }
      };

      await walk(rootDir);

      if (!hasReadme) {
        zip.file(
          'README.md',
          [
            '# STUDY:ON — 중·고등 전 과목 학습 노트',
            '',
            '국어, 수학, 영어, 과학, 사회, 역사, 제2외국어, 정보(AI) 학습과 문서·PPT 제작 및 사진 분석을 지원하는 웹 애플리케이션입니다.',
            '',
            '## 실행 방법',
            '',
            '```bash',
            'npm install',
            'cp .env.example .env',
            '# .env 파일에 GEMINI_API_KEY 를 입력해 주세요.',
            'npm run dev',
            '```',
            '',
            '## 프로덕션 빌드 및 실행',
            '',
            '```bash',
            'npm run build',
            'npm start',
            '```',
            '',
          ].join('\n')
        );
      }

      const archiveBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="studyon-github-project.zip"');
      res.setHeader('Content-Length', String(archiveBuffer.length));
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(archiveBuffer);
    } catch (err) {
      console.error('Failed to generate GitHub project zip:', err);
      res.status(500).json({
        error: 'GitHub 업로드용 프로젝트 압축 파일을 만드는 중 오류가 발생했습니다.',
      });
    }
  });

  app.post('/api/files/extract', (req, res) => {
    try {
      const { name = '', dataBase64 = '' } = req.body as {
        name?: string;
        dataBase64?: string;
      };
      if (!dataBase64) {
        res.status(400).json({ error: '파일 데이터가 비어 있습니다.' });
        return;
      }

      const ext = name.split('.').pop()?.toLowerCase() || '';
      const rawBuffer = Buffer.from(dataBase64, 'base64');
      const cfbContainer = CFB.read(rawBuffer, { type: 'buffer' });

      if (ext === 'hwp') {
        const headerEntry = CFB.find(cfbContainer, '/FileHeader') || CFB.find(cfbContainer, 'FileHeader');
        if (!headerEntry || !headerEntry.content) {
          res.status(400).json({
            error: '올바른 한글(.hwp) 파일 형식이 아닙니다. .hwpx 또는 PDF로 저장해 올려 주세요.',
          });
          return;
        }
        const headerBuf = Buffer.from(headerEntry.content as Uint8Array);
        const flags = headerBuf.length >= 40 ? headerBuf.readUInt32LE(36) : 0;
        const isCompressed = (flags & 0x01) !== 0;
        const isEncrypted = (flags & 0x02) !== 0;

        if (isEncrypted) {
          res.status(400).json({
            error: '암호로 잠긴 한글(.hwp) 파일입니다. 암호를 해제하거나 .hwpx / PDF로 저장해 올려 주세요.',
          });
          return;
        }

        const sectionNames = cfbContainer.FullPaths
          .filter((p) => /\/?BodyText\/Section\d+$/i.test(p))
          .sort((a, b) => {
            const numA = Number(a.match(/Section(\d+)$/i)?.[1] || 0);
            const numB = Number(b.match(/Section(\d+)$/i)?.[1] || 0);
            return numA - numB;
          });

        const paragraphs: string[] = [];
        for (const secPath of sectionNames) {
          const entry = CFB.find(cfbContainer, secPath);
          if (!entry || !entry.content) continue;
          const rawSection = Buffer.from(entry.content as Uint8Array);
          let sectionBuf: Buffer;
          try {
            sectionBuf = isCompressed ? zlib.inflateRawSync(rawSection) : rawSection;
          } catch {
            continue;
          }

          let offset = 0;
          while (offset + 4 <= sectionBuf.length) {
            const recordHeader = sectionBuf.readUInt32LE(offset);
            offset += 4;
            const tagId = recordHeader & 0x3ff;
            let size = (recordHeader >> 20) & 0xfff;
            if (size === 0xfff) {
              if (offset + 4 > sectionBuf.length) break;
              size = sectionBuf.readUInt32LE(offset);
              offset += 4;
            }
            if (offset + size > sectionBuf.length) break;

            if (tagId === 67) {
              let pos = offset;
              const end = offset + size;
              let line = '';
              while (pos + 2 <= end) {
                const code = sectionBuf.readUInt16LE(pos);
                // HWP 5.0 Extended & Inline control characters occupy 8 UTF-16LE code units (16 bytes)
                if (
                  [1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23].includes(code) ||
                  [4, 5, 6, 7, 8, 9, 19, 20].includes(code)
                ) {
                  if (code === 9) line += '\t';
                  pos += 16;
                  continue;
                }
                if (code === 10 || code === 13) {
                  line += '\n';
                } else if (code === 24) {
                  line += '-';
                } else if (code === 30 || code === 31) {
                  line += ' ';
                } else if (code >= 32) {
                  line += String.fromCharCode(code);
                }
                pos += 2;
              }
              const cleanedLine = line.replace(/\r/g, '').trim();
              if (cleanedLine) paragraphs.push(cleanedLine);
            }
            offset += size;
          }
        }

        let extracted = paragraphs.join('\n').trim();
        if (!extracted) {
          const prvEntry = CFB.find(cfbContainer, '/PrvText') || CFB.find(cfbContainer, 'PrvText');
          if (prvEntry?.content) {
            extracted = Buffer.from(prvEntry.content as Uint8Array)
              .toString('utf16le')
              .replace(/\0/g, '')
              .trim();
          }
        }

        if (!extracted) {
          res.status(400).json({
            error: `"${name}" 한글(.hwp) 파일에서 본문 텍스트를 찾지 못했습니다. .hwpx 또는 PDF로 저장해 올려 주세요.`,
          });
          return;
        }
        res.json({ text: extracted });
        return;
      }

      // Best-effort UTF-16LE / readable text scan across OLE2 streams for legacy .ppt / .doc / .xls
      const streamCandidates = cfbContainer.FullPaths.filter((p) =>
        /(PowerPoint Document|WordDocument|Workbook|Book|Current User|Contents)/i.test(p)
      );
      const chunks: string[] = [];
      for (const streamPath of streamCandidates) {
        const entry = CFB.find(cfbContainer, streamPath);
        if (!entry?.content) continue;
        const streamBuf = Buffer.from(entry.content as Uint8Array);
        const decoded = streamBuf.toString('utf16le');
        const matches = decoded.match(/[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s.,!?()[\]{}:;'"/%+\-=·•\u2022]{6,}/g);
        if (matches) {
          for (const m of matches) {
            const clean = m.replace(/\s+/g, ' ').trim();
            if (clean.length >= 6 && /[가-힣a-zA-Z]/.test(clean)) {
              chunks.push(clean);
            }
          }
        }
      }

      const deduped = Array.from(new Set(chunks)).join('\n').trim();
      if (!deduped || deduped.length < 15) {
        res.status(400).json({
          error: `구형 바이너리 .${ext} 파일의 텍스트를 추출하지 못했습니다. 최신 형식(.${ext}x) 또는 PDF로 변환해 첨부하면 가장 정확하게 읽을 수 있습니다.`,
        });
        return;
      }

      res.json({ text: deduped.slice(0, 45000) });
    } catch {
      res.status(400).json({
        error: '구형 문서 파일(.hwp/.ppt/.doc)을 해석하지 못했습니다. .hwpx, .pptx, .docx 또는 PDF로 저장해 올려 주세요.',
      });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const {
        workspaceId = 'korean',
        subTrackId,
        gradeLevel = 'high',
        studyMode = 'fast',
        thinkingDepth = 'standard',
        careerGoal,
        connectCareer = true,
        memoryContext,
        verifyMode = false,
        history = [],
        prompt = '',
        attachment,
        attachments,
      } = req.body as {
        workspaceId: string;
        subTrackId?: string;
        gradeLevel: 'middle' | 'high';
        studyMode: 'tutor' | 'fast' | 'solve-only' | 'performance';
        thinkingDepth?: 'standard' | 'deep';
        careerGoal?: string;
        connectCareer?: boolean;
        memoryContext?: string;
        verifyMode?: boolean;
        history: IncomingMessage[];
        prompt: string;
        attachment?: IncomingAttachment;
        attachments?: IncomingAttachment[];
      };

      const incomingAttachments: IncomingAttachment[] = Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : attachment
          ? [attachment]
          : [];

      if (!prompt.trim() && incomingAttachments.length === 0) {
        res.status(400).json({ error: '질문 내용이나 첨부 자료를 입력해 주세요.' });
        return;
      }

      const ai = createAiClient();
      const systemInstruction = buildSystemInstruction({
        workspaceId,
        subTrackId,
        gradeLevel,
        studyMode,
        thinkingDepth,
        careerGoal,
        connectCareer,
        memoryContext: typeof memoryContext === 'string' ? memoryContext.slice(0, 5000) : undefined,
        verifyMode,
      });

      const hasPdfOrText = incomingAttachments.some(
        (att) => att.mimeType === 'application/pdf' || Boolean(att.textContent)
      );
      const recentHistory = Array.isArray(history) ? history.slice(-16) : [];
      const effectivePrompt =
        prompt.trim() ||
        (studyMode === 'solve-only'
          ? hasPdfOrText
            ? '첨부한 자료를 바탕으로 개념 노트 정리 없이 문제와 단계별 풀이 과정, 정답만 출력해 주세요.'
            : incomingAttachments.length > 1
              ? '첨부한 여러 사진 속 문제들의 단계별 풀이 과정과 최종 정답만 간결하게 출력해 주세요.'
              : '첨부한 사진 속 문제의 단계별 풀이 과정과 최종 정답만 간결하게 출력해 주세요.'
          : studyMode === 'performance'
            ? hasPdfOrText
              ? '첨부한 수행평가 안내문·자료의 채점 기준과 필수 조건을 체크리스트로 정리하고, 주제·개요·개선 포인트를 안내해 주세요.'
              : '첨부한 수행평가 안내문·루브릭·초안 사진을 모두 읽고 필수 조건 체크리스트, 감점 주의사항, 작성/수정 가이드를 정리해 주세요.'
            : hasPdfOrText
              ? '첨부한 문서의 핵심 내용을 구조화된 학습 노트로 요약하고 예상 출제 포인트를 정리해 주세요.'
              : incomingAttachments.length > 1
                ? '첨부한 여러 사진 속 문제/자료를 모두 분석하고 단계별로 설명해 주세요.'
                : '첨부한 사진 속 문제/자료를 분석하고 단계별로 설명해 주세요.');

      // Open SSE stream immediately and emit keepalive pings so proxies/browsers never drop slow multimodal requests
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const keepaliveTimer = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 5000);

      try {
        if (STRICT_SUBJECT_NAMES[workspaceId]) {
          const gate = await checkSubjectRelevance(ai, {
            workspaceId,
            prompt: effectivePrompt,
            attachments: incomingAttachments,
            recentHistory,
          });

          if (!gate.isRelevant) {
            const currentName = STRICT_SUBJECT_NAMES[workspaceId];
            const targetId =
              gate.detectedSubjectId && STRICT_SUBJECT_NAMES[gate.detectedSubjectId]
                ? gate.detectedSubjectId
                : undefined;
            const targetName = targetId ? STRICT_SUBJECT_NAMES[targetId] : undefined;

            const refusalLines = [
              `이 ${incomingAttachments.length > 0 ? '질문과 첨부 자료는' : '질문은'} **${currentName} 교과**와 관련이 없어 **${currentName} 전용 AI**에서는 답변할 수 없습니다.`,
              gate.reason ? gate.reason : '',
              targetId && targetName
                ? `아래 버튼을 눌러 **${targetName} AI**로 이동해 질문해 주세요.\n\n[[SWITCH:${targetId}]]`
                : `${currentName} 교과와 관련된 질문을 입력하거나 **AI 자유 대화**를 이용해 주세요.`,
            ].filter(Boolean);

            res.write(`data: ${JSON.stringify({ text: refusalLines.join('\n\n') })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            return;
          }
        }

        const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];

        recentHistory.forEach((msg, idx) => {
          if (!msg.content?.trim()) return;
          const isRecentTurn = idx >= recentHistory.length - 6;
          const clipped = msg.content.slice(0, isRecentTurn ? 2400 : 700);
          const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
          const prev = contents[contents.length - 1];
          if (prev && prev.role === role) {
            prev.parts.push({ text: clipped });
          } else {
            contents.push({
              role,
              parts: [{ text: clipped }],
            });
          }
        });
        while (contents.length > 0 && contents[0].role === 'model') {
          contents.shift();
        }

        const currentParts: Array<Record<string, unknown>> = [];

        incomingAttachments.forEach((att, idx) => {
          if (att.dataBase64 && att.mimeType) {
            currentParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.dataBase64,
              },
            });
          }
          if (att.textContent) {
            const perDocBudget = incomingAttachments.length > 1 ? 22000 : 45000;
            const clippedText = att.textContent.slice(0, perDocBudget);
            currentParts.push({
              text: `[첨부 문서 ${idx + 1}: ${att.name}]\n\n${clippedText}`,
            });
          }
        });

        currentParts.push({ text: effectivePrompt });
        contents.push({ role: 'user', parts: currentParts });

        const isSolveOnly = studyMode === 'solve-only';
        const hasBinaryImage = incomingAttachments.some((a) => Boolean(a.dataBase64));
        const allowSearchTool =
          !isSolveOnly &&
          Date.now() >= searchToolCooldownUntil &&
          (needsWebSearchForChat(effectivePrompt) ||
            (Boolean(verifyMode) && !hasBinaryImage && workspaceId !== 'math'));
        const baseThinkingLevel = resolveThinkingLevel({
          thinkingDepth,
          workspaceId,
          studyMode,
          hasAttachments: incomingAttachments.length > 0,
          verifyMode,
        });
        const primaryTimeoutMs =
          verifyMode || incomingAttachments.length > 0 || thinkingDepth === 'deep' ? 65000 : 45000;
        const fallbackTimeoutMs = 55000;

        const { iterator, firstResult } = await withRetry(async (attempt, useFallbackModel) => {
          const activeModel = useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME;
          const effectiveThinking = useFallbackModel
            ? baseThinkingLevel === ThinkingLevel.XHIGH
              ? ThinkingLevel.HIGH
              : baseThinkingLevel
            : baseThinkingLevel;
          const timeoutMs = useFallbackModel ? fallbackTimeoutMs : primaryTimeoutMs;
          // On retry attempts, disable googleSearch tool in case Search Grounding quota triggered 429
          const useSearchOnThisAttempt = allowSearchTool && attempt === 0;

          try {
            return await withTimeout(
              (async () => {
                const stream = await ai.models.generateContentStream({
                  model: activeModel,
                  contents,
                  config: {
                    systemInstruction,
                    tools: useSearchOnThisAttempt ? [{ googleSearch: {} }] : undefined,
                    thinkingConfig: { thinkingLevel: effectiveThinking },
                  },
                });
                const it = stream[Symbol.asyncIterator]();
                const first = await it.next();
                return { iterator: it, firstResult: first };
              })(),
              timeoutMs,
              'AI 응답 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
            );
          } catch (attemptErr) {
            if (useSearchOnThisAttempt && isRateLimitError(attemptErr)) {
              searchToolCooldownUntil = Date.now() + 90_000;
            }
            throw attemptErr;
          }
        }, 2);

        clearInterval(keepaliveTimer);

        const sourceMap = new Map<string, { title: string; uri: string }>();
        const collectSourcesFromChunk = (chunk: unknown) => {
          const c = chunk as {
            candidates?: Array<{
              groundingMetadata?: {
                groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
              };
            }>;
          };
          const chunks = c?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
          for (const gChunk of chunks) {
            const uri = gChunk?.web?.uri;
            if (uri && !sourceMap.has(uri)) {
              sourceMap.set(uri, {
                title: gChunk.web?.title || uri,
                uri,
              });
            }
          }
        };

        if (!firstResult.done && firstResult.value) {
          collectSourcesFromChunk(firstResult.value);
          if (firstResult.value.text) {
            res.write(`data: ${JSON.stringify({ text: firstResult.value.text })}\n\n`);
          }
        }

        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;
          if (value) {
            collectSourcesFromChunk(value);
            if (value.text) {
              res.write(`data: ${JSON.stringify({ text: value.text })}\n\n`);
            }
          }
        }

        const sources = Array.from(sourceMap.values());
        if (sources.length > 0) {
          res.write(`data: ${JSON.stringify({ sources })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } finally {
        clearInterval(keepaliveTimer);
      }
    } catch (err) {
      const formatted = formatGeminiError(err);
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/ai/search', async (req, res) => {
    try {
      const {
        subTrackId = 'all',
        gradeLevel = 'high',
        careerGoal,
        memoryContext,
        history = [],
        prompt = '',
        attachments = [],
      } = req.body as {
        subTrackId?: string;
        gradeLevel: 'middle' | 'high';
        careerGoal?: string;
        memoryContext?: string;
        history?: IncomingMessage[];
        prompt: string;
        attachments?: IncomingAttachment[];
      };

      const incomingAttachments: IncomingAttachment[] = Array.isArray(attachments)
        ? attachments
        : [];

      if (!prompt.trim() && incomingAttachments.length === 0) {
        res.status(400).json({ error: '검색할 주제나 과목, 진로 키워드, 또는 첨부 자료를 입력해 주세요.' });
        return;
      }

      const ai = createAiClient();
      const gradeLabel = gradeLevel === 'middle' ? '중학생' : '고등학생';
      const scopeHint =
        subTrackId === 'sites'
          ? '웹사이트 및 온라인 학습 플랫폼 위주로 찾아 정리하세요.'
          : subTrackId === 'apps'
            ? '스마트폰/태블릿 학습 앱(iOS/Android) 위주로 찾아 정리하세요.'
            : subTrackId === 'career-research'
              ? '진로·학과 탐구 보고서, 무료 공개 강의, 학술/진로 체험 사이트와 앱을 중심으로 정리하세요.'
              : '유용한 웹사이트와 모바일/데스크톱 학습 앱을 균형 있게 찾아 정리하세요.';

      const careerLine = careerGoal?.trim()
        ? `학생의 희망 진로/학과는 "${careerGoal.trim()}"입니다. 요청과 관련이 있다면 해당 진로 준비에 특히 도움이 되는 사이트·앱이나 세특 탐구 활용 팁도 함께 짚어주세요.`
        : '';

      const memoryBlock =
        typeof memoryContext === 'string' && memoryContext.trim()
          ? `[학생의 이전 학습 및 AI 대화 기록]:\n학생이 이전에 다른 AI나 검색에서 나눴던 주제를 언급하면 아래 기록을 참고해 맥락에 맞는 사이트와 앱을 찾아 주세요.\n\n${memoryContext.slice(0, 4000)}`
          : '';

      const todayKoSearch = new Date().toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const systemInstruction = [
        `당신은 한국 ${gradeLabel}을 위한 "사이트 · 앱 검색 AI" 큐레이터입니다. (기준 날짜: ${todayKoSearch})`,
        '반드시 Google 검색 결과에서 실제로 확인된 신뢰할 수 있는 학습 사이트, 공식 플랫폼, 교육용 앱만 추천하고 정리하세요. 검색 결과에 없는 URL, 요금 정보, 서비스 기능, 수치는 절대 추측하거나 지어내지 말고, 확인되지 않은 항목은 "공식 사이트에서 직접 확인 필요"로 표기하세요.',
        '학생이 특정 조건·개수·분야(예: 사이트만, 앱만, 2개만, 특정 과목만)를 요청했다면 요청한 범위와 대상만 정확히 찾아 정리하고, 요청하지 않은 범위나 다른 분야까지 임의로 확장하지 마세요.',
        '학생이 문서(PDF·한글·PPT·워드 등)나 사진을 첨부했다면 먼저 자료 속 핵심 주제·과목·키워드를 파악한 뒤 그에 맞는 학습 사이트와 앱, 참고 자료를 검색해 정리하세요.',
        scopeHint,
        careerLine,
        memoryBlock,
        '응답 형식(Markdown):',
        '1. ## 추천 사이트 · 앱 요약 표 (이름 | 구분(사이트/앱) | 핵심 기능 | 비용(무료/부분유료) | 추천 대상)',
        '2. ## 상세 정리 및 학습 활용법 (각 서비스별로 어떤 과목/단원에 어떻게 쓰면 좋은지 구체적으로 설명)',
        '3. ## 함께 검색해 볼 키워드 2~3개',
        '만약 학생이 검색 결과나 첨부한 PPT·문서를 PDF, 한글(hwp/hwpx), 워드(docx), PPT(pptx) 형식으로 제작·전환해 달라고 요청했다면, 정리된 내용을 제공한 뒤 맨 마지막 줄에 `[[DOC_READY:목표형식|제목]]` (목표형식은 pptx, hwpx, docx, pdf 중 하나)을 한 줄 추가하세요.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
      const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
      for (const msg of recentHistory) {
        if (!msg.content?.trim()) continue;
        const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
        const clipped = msg.content.slice(0, 1600);
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role) {
          prev.parts.push({ text: clipped });
        } else {
          contents.push({
            role,
            parts: [{ text: clipped }],
          });
        }
      }
      while (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }

      const currentParts: Array<Record<string, unknown>> = [];
      incomingAttachments.forEach((att, idx) => {
        if (att.dataBase64 && att.mimeType) {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
        if (att.textContent) {
          const perDocBudget = incomingAttachments.length > 1 ? 14000 : 28000;
          currentParts.push({
            text: `[첨부 자료 ${idx + 1}: ${att.name}]\n\n${att.textContent.slice(0, perDocBudget)}`,
          });
        }
      });
      currentParts.push({
        text:
          prompt.trim() ||
          '첨부한 자료의 주제와 관련된 신뢰할 수 있는 학습 사이트, 참고 자료, 공부 앱을 검색해 정리해 주세요.',
      });
      contents.push({ role: 'user', parts: currentParts });

      const response = await withRetry(
        (_attempt, useFallbackModel) =>
          withTimeout(
            ai.models.generateContent({
              model: useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME,
              contents,
              config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            }),
            useFallbackModel ? 30000 : 18000,
            '검색 응답 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
          ),
        1
      );

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of chunks) {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri && !seenUris.has(web.uri)) {
          seenUris.add(web.uri);
          sources.push({
            title: web.title || web.uri,
            uri: web.uri,
          });
        }
      }

      res.json({
        text: response.text || '검색 결과를 정리하지 못했습니다. 다른 키워드로 다시 질문해 주세요.',
        sources,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/quiz', async (req, res) => {
    try {
      const {
        workspaceId = 'korean',
        subTrackId,
        gradeLevel = 'high',
        careerGoal,
        contextText = '',
      } = req.body as {
        workspaceId: string;
        subTrackId?: string;
        gradeLevel: 'middle' | 'high';
        careerGoal?: string;
        contextText: string;
      };

      if (!contextText.trim()) {
        res.status(400).json({ error: '퀴즈를 생성할 학습 대화 내용이 먼저 필요합니다.' });
        return;
      }

      const ai = createAiClient();
      const gradeLabel = gradeLevel === 'middle' ? '중학교' : '고등학교';
      const subTrackLabel = subTrackId ? SUBTRACK_LABELS[subTrackId] || subTrackId : '';

      const response = await withRetry(
        (_attempt, useFallbackModel) =>
          withTimeout(
            ai.models.generateContent({
              model: useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME,
              contents: `다음 ${gradeLabel} 학습 내용을 바탕으로 이해도를 점검할 수 있는 4지선다 객관식 확인 문제 3문제를 한국어로 출제하세요.\n\n[학습 내용]\n${contextText.slice(0, 8000)}`,
              config: {
                systemInstruction: `당신은 한국 ${gradeLabel} ${workspaceId}${subTrackLabel ? `(${subTrackLabel})` : ''} 과목 교사입니다.${careerGoal ? ` 학생의 희망 진로(${careerGoal})와 연결 가능한 문항이 있다면 1문제 정도는 진로 맥락을 자연스럽게 녹여내세요.` : ''} 제공된 학습 내용과 검증된 교과 사실에만 근거해 4지선다 문제 3개를 생성하며, 없는 통계·연도·인용은 절대 지어내지 마세요. 반드시 모든 계산·논리를 직접 검산하여 정답이 유일하게 1개인지, 그리고 correctIndex(0~3)가 options 배열의 실제 정답 위치와 정확히 일치하는지 검증한 뒤 JSON을 반환하세요.`,
                thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: {
                        type: Type.STRING,
                        description: '문제 질문 텍스트 (필요 시 간단한 수식 포함)',
                      },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: '정확히 4개의 선택지',
                      },
                      correctIndex: {
                        type: Type.INTEGER,
                        description: '정답 선택지 인덱스 (0~3)',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: '왜 정답인지와 오답 함정에 대한 명확한 해설',
                      },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
            }),
            useFallbackModel ? 40000 : 35000,
            '퀴즈 생성 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
          ),
        1
      );

      const rawJson = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawJson);
      res.json({ questions: parsed });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Structured flashcard deck generator for active recall across all subjects
  app.post('/api/ai/flashcards', async (req, res) => {
    try {
      const {
        workspaceId = 'korean',
        subTrackId,
        gradeLevel = 'high',
        contextText = '',
      } = req.body as {
        workspaceId: string;
        subTrackId?: string;
        gradeLevel: 'middle' | 'high';
        contextText: string;
      };

      const ai = createAiClient();
      const gradeLabel = gradeLevel === 'middle' ? '중학교' : '고등학교';
      const subTrackLabel = subTrackId ? SUBTRACK_LABELS[subTrackId] || subTrackId : '';

      const promptBody = contextText.trim()
        ? `다음 학습 내용을 바탕으로 핵심 암기용 플래시카드 6장을 만드세요.\n\n[학습 내용]\n${contextText.slice(0, 12000)}`
        : `${gradeLabel} ${workspaceId}${subTrackLabel ? `(${subTrackLabel})` : ''}에서 시험에 가장 자주 출제되는 필수 핵심 개념·어휘·공식 플래시카드 6장을 만드세요.`;

      const response = await withRetry(
        (_attempt, useFallbackModel) =>
          withTimeout(
            ai.models.generateContent({
              model: useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME,
              contents: promptBody,
              config: {
                systemInstruction: `당신은 한국 ${gradeLabel} ${workspaceId}${subTrackLabel ? `(${subTrackLabel})` : ''} 과목 교사입니다. 능동적 회상(Active Recall)에 최적화된 암기 카드 6장을 검증된 교과 사실과 제공된 자료에만 근거해 한국어로 제작하세요(허위 통계·연도·인용 금지). 영어·제2외국어는 정확한 발음/후리가나/병음과 예문을 포함하고, 수학·과학은 핵심 공식과 적용 조건을 직접 검증해 담으세요.`,
                thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: {
                        type: Type.STRING,
                        description: '앞면 질문 또는 핵심 용어/어휘/공식 이름',
                      },
                      hint: {
                        type: Type.STRING,
                        description: '떠올릴 수 있는 짧은 힌트',
                      },
                      back: {
                        type: Type.STRING,
                        description: '뒷면 핵심 정답/정의/풀이 포인트',
                      },
                      example: {
                        type: Type.STRING,
                        description: '실제 예문, 적용 사례, 또는 주의할 시험 함정',
                      },
                    },
                    required: ['front', 'hint', 'back', 'example'],
                  },
                },
              },
            }),
            useFallbackModel ? 35000 : 30000,
            '암기 카드 생성 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
          ),
        1
      );

      const rawJson = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawJson);
      res.json({ cards: parsed });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Conversational, Multimodal & Iterative Document (PDF / HWPX / DOCX) & Presentation (PPTX) AI Creator
  app.post('/api/ai/generate-document', async (req, res) => {
    try {
      const {
        format = 'pdf',
        templateKind = 'study-note',
        topic = '',
        sourceText = '',
        workspaceId = 'korean',
        subTrackId,
        gradeLevel = 'high',
        thinkingDepth = 'standard',
        careerGoal,
        studentName = '학생',
        memoryContext,
        history = [],
        attachments = [],
        existingArtifact,
        pptDensity = 'balanced',
        pptDesignStyle = 'auto',
        pptThemeId,
      } = req.body as {
        format: 'pdf' | 'hwpx' | 'docx' | 'pptx';
        templateKind?: 'study-note' | 'report' | 'presentation';
        topic?: string;
        sourceText?: string;
        workspaceId?: string;
        subTrackId?: string;
        gradeLevel?: 'middle' | 'high';
        thinkingDepth?: 'standard' | 'deep';
        careerGoal?: string;
        studentName?: string;
        memoryContext?: string;
        history?: IncomingMessage[];
        attachments?: IncomingAttachment[];
        existingArtifact?: Record<string, unknown>;
        pptDensity?: 'concise' | 'balanced' | 'rich';
        pptDesignStyle?: 'auto' | 'infographic' | 'analytical' | 'editorial';
        pptThemeId?: string;
      };

      const incomingAttachments: IncomingAttachment[] = Array.isArray(attachments)
        ? attachments
        : [];

      if (
        !topic.trim() &&
        !sourceText.trim() &&
        incomingAttachments.length === 0 &&
        !existingArtifact
      ) {
        res.status(400).json({ error: '문서나 PPT를 만들 주제, 대화 내용, 또는 첨부 자료를 입력해 주세요.' });
        return;
      }

      const ai = createAiClient();
      const gradeLabel = gradeLevel === 'middle' ? '중학교' : '고등학교';
      const subjectLabel = STRICT_SUBJECT_NAMES[workspaceId] || (
        workspaceId === 'free-chat'
          ? '자유 탐구'
          : workspaceId === 'doc-summary'
            ? '문서 요약'
            : workspaceId === 'photo-analysis'
              ? '문제 분석'
              : workspaceId === 'resource-search'
                ? '자료 조사'
                : workspaceId === 'ppt-maker'
                  ? '발표 · 탐구'
                  : workspaceId === 'doc-maker'
                    ? '학습 · 보고서'
                    : '전 과목'
      );
      const subTrackLabel = subTrackId ? SUBTRACK_LABELS[subTrackId] || subTrackId : '';
      const isPresentation = format === 'pptx';
      const todayLabel = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const defaultAuthorLine = `${gradeLabel} ${subjectLabel}${subTrackLabel ? ` · ${subTrackLabel}` : ''} · ${studentName} · ${todayLabel}`;

      const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
      const historySummary = recentHistory
        .filter((m) => m.content?.trim())
        .map((m) => `${m.role === 'user' ? '학생' : 'AI'}: ${m.content.slice(0, 1200)}`)
        .join('\n\n');

      const existingKind =
        existingArtifact && typeof existingArtifact === 'object' && 'kind' in existingArtifact
          ? String((existingArtifact as { kind?: unknown }).kind || '')
          : '';
      const isCrossKindConversion =
        Boolean(existingArtifact) &&
        ((isPresentation && existingKind === 'document') ||
          (!isPresentation && existingKind === 'presentation'));
      const existingLabel = isCrossKindConversion
        ? isPresentation
          ? '[형식 전환 원본 문서 — 아래 문서를 PPT 슬라이드 발표자료로 완벽하게 재구성·전환하세요]'
          : `[형식 전환 원본 PPT 발표자료 — 아래 슬라이드와 발표 대본을 ${format.toUpperCase()} 문서 형식으로 빠짐없이 전환하세요]`
        : '[현재까지 작성된 기존 자료 — 학생의 수정·변환 요청을 반영해 개선/업데이트하세요]';

      const textSections = [
        topic.trim() ? `[학생의 제작·수정·형식 전환 요청 (목표 형식: ${format.toUpperCase()})]\n${topic.trim()}` : '',
        sourceText.trim() ? `[기반 학습 대화 · 정리 내용]\n${sourceText.slice(0, 16000)}` : '',
        historySummary ? `[최근 대화 맥락]\n${historySummary}` : '',
        existingArtifact
          ? `${existingLabel}\n${JSON.stringify(existingArtifact).slice(0, 14000)}`
          : '',
        typeof memoryContext === 'string' && memoryContext.trim()
          ? `[이전 학습 기억 맥락]\n${memoryContext.slice(0, 2500)}`
          : '',
      ].filter(Boolean);

      const userParts: Array<Record<string, unknown>> = [];
      incomingAttachments.forEach((att, idx) => {
        if (att.dataBase64 && att.mimeType) {
          userParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
        if (att.textContent) {
          const perDocBudget = incomingAttachments.length > 1 ? 18000 : 35000;
          userParts.push({
            text: `[첨부 자료 ${idx + 1}: ${att.name}]\n\n${att.textContent.slice(0, perDocBudget)}`,
          });
        }
      });

      const resolvedThinking =
        thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;

      if (isPresentation) {
        const VALID_THEMES = new Set(['ivory', 'navy', 'sage', 'terracotta', 'cobalt', 'editorial', 'lavender']);
        const VALID_COVERS = new Set(['split', 'modern', 'framed', 'minimal']);

        const topicHasRichCue = /자세히|풍부|많이|깊게|심화|상세|길게|알차게|꼼꼼|디테일|10장|11장|12장|13장|14장|15장/.test(
          topic
        );
        const topicHasConciseCue = /간결|짧게|핵심만|요약본|5장|6장/.test(topic);
        const topicHasDesignCue = /디자인|예쁘게|다채롭게|인포그래픽|시각화|깔끔하게|멋지게|꾸며|레이아웃/.test(
          topic
        );

        const effectiveDensity: 'concise' | 'balanced' | 'rich' =
          pptDensity === 'rich' || (topicHasRichCue && pptDensity !== 'concise')
            ? 'rich'
            : pptDensity === 'concise' || (topicHasConciseCue && !topicHasRichCue)
              ? 'concise'
              : 'balanced';

        const effectiveDesignStyle: 'auto' | 'infographic' | 'analytical' | 'editorial' =
          pptDesignStyle !== 'auto'
            ? pptDesignStyle
            : topicHasDesignCue
              ? 'infographic'
              : 'auto';

        const slideCountGuidance =
          effectiveDensity === 'rich'
            ? '9~12장(단, 학생이 특정 장수를 직접 명시했다면 그 장수를 우선 준수)'
            : effectiveDensity === 'concise'
              ? '6~7장(단, 학생이 특정 장수를 직접 명시했다면 그 장수를 우선 준수)'
              : '7~9장(단, 학생이 특정 장수를 직접 명시했다면 그 장수를 우선 준수)';

        const densityDetailGuidance =
          effectiveDensity === 'rich'
            ? `정보 밀도 [풍부 심화형]: 각 슬라이드가 텅 비지 않도록 원리·메커니즘·구체적 실제 사례·비교 근거를 충실히 채우세요. 일반 bullets는 4~6개(각 55~95자), cards는 3~4개(각 카드 body를 2~3문장 60~110자로 상세 서술), steps는 4~5단계(detail 45~85자), table은 3~4열×3~5행으로 풍부하게 채우고, speakerNotes도 실제 발표처럼 3~5문장으로 상세히 작성하세요.`
            : effectiveDensity === 'concise'
              ? `정보 밀도 [간결 핵심형]: 한눈에 읽히도록 각 bullet을 25~45자 이내의 명쾌한 키워드 문장으로 압축하고(3~4개), 카드·스텝도 핵심 문구 위주로 간결하게 작성하세요.`
              : `정보 밀도 [표준 균형형]: 핵심 개념과 구체적 예시가 균형을 이루도록 bullet 3~5개(각 40~70자), 카드 body 40~75자, 단계별 설명·비교표를 알차게 구성하세요.`;

        const designStyleGuidance =
          effectiveDesignStyle === 'infographic'
            ? `디자인 스타일 [인포그래픽·시각 카드형]: 단순 텍스트 나열을 지양하고 "cards"(카드 그리드), "timeline"(단계 흐름도), "stats"(핵심 지표/요점 하이라이트), "two-column"(좌우 대비)을 전체 본문 슬라이드의 75% 이상 적극 활용하세요. 표지 스타일(coverStyle)은 가급적 "modern" 또는 "split"을 선택하세요.`
            : effectiveDesignStyle === 'analytical'
              ? `디자인 스타일 [분석·비교표형]: "table"(비교표), "two-column"(원인 vs 결과 / 이론 vs 사례), "stats"(핵심 구조 지표), "timeline"(탐구·실험 절차)을 중심으로 논리적이고 구조적인 발표 자료로 설계하세요. 표지 스타일은 "split" 또는 "framed"가 잘 어울립니다.`
              : effectiveDesignStyle === 'editorial'
                ? `디자인 스타일 [에디토리얼·스토리텔링형]: "agenda"(목차), "quote"(핵심 명제/인용 강조), "timeline"(흐름 전개), "cards"(핵심 포인트 카드), "two-column"을 리듬감 있게 배치해 세련된 키노트·매거진 느낌으로 구성하세요. 표지 스타일은 "framed" 또는 "minimal"이 어울립니다.`
                : `디자인 스타일 [자동 맞춤 다채로운 구성]: 주제에 맞춰 "agenda", "cards", "timeline", "stats", "two-column", "table", "quote", "bullets", "summary"를 다채롭게 조합하세요. 단순 "bullets" 슬라이드가 전체의 30%를 넘지 않도록 시각적 레이아웃 다양성을 확보하세요.`;

        const trackHint =
          subTrackId === 'perf-ppt'
            ? '학교 수행평가 발표 형식(표지 → 탐구 목차 → 탐구 동기·배경 → 이론적 원리 → 탐구/실험 과정 → 분석 결과·비교 → 한계 및 제언/결론, 예상 Q&A 포인트 포함)'
            : subTrackId === 'pitch-ppt'
              ? '진로·세특 연계 심화 탐구 피칭 형식(표지 → 아젠다 → 문제 제기 → 핵심 원리/해결책 → 적용 사례·근거 → 진로 확장 및 결론)'
              : '수업·개념 심화 발표 형식(표지 → 발표 목차 → 핵심 개념·원리 → 과정/흐름 → 비교·사례 → 적용 및 마무리 요약)';

        userParts.push({
          text: `다음 요청과 자료를 바탕으로 ${trackHint}에 맞는 고품질·고디자인 PPT 슬라이드(${slideCountGuidance})를 JSON으로 직접 제작(또는 첨부 자료/기존 문서를 PPT로 전환·수정)해 주세요.\n\n${textSections.join('\n\n')}`,
        });

        const response = await withRetry(
          (_attempt, useFallbackModel) =>
            withTimeout(
              ai.models.generateContent({
                model: useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME,
                contents: [{ role: 'user', parts: userParts }],
                config: {
                  systemInstruction:
                    `당신은 한국 ${gradeLabel} 학생을 위해 시각적으로 세련되고 내용이 탄탄한 파워포인트(.pptx)를 직접 설계·제작·전환·편집해 주는 "전문 프레젠테이션 디자이너 & 교과 튜터 AI"입니다.` +
                    `${careerGoal ? ` 학생의 희망 진로(${careerGoal})와 연결 가능한 경우 탐구·응용 포인트나 발표 노트에 자연스럽게 녹여내세요.` : ''}\n` +
                    `[PPT 디자인 및 콘텐츠 구성 원칙]:\n` +
                    `1) assistantSummary: 학생에게 건네는 친절한 한국어 안내 2~3문장(슬라이드 장수, 적용한 레이아웃·디자인 구성, 핵심 내용 반영 결과를 요약 안내).\n` +
                    `2) [요청 범위 엄수]: 학생이 특정 장수, 특정 주제, 특정 목차/범위만 지정했다면 반드시 그 지정 범위와 장수를 지키세요. 별도 장수 지정이 없다면 ${slideCountGuidance}으로 구성하세요.\n` +
                    `3) ${densityDetailGuidance}\n` +
                    `4) ${designStyleGuidance}\n` +
                    `5) [레이아웃 다양성 필수 규칙] 1번 슬라이드는 "title"(표지), 2번 슬라이드는 가급적 "agenda"(목차·발표 흐름 3~5개), 마지막 슬라이드는 "summary"(핵심 결론·정리)로 구성하세요. 본문 슬라이드는 같은 layout을 2번 연속 반복하지 말고 아래 10가지 layout별 전용 필드를 정확히 채우세요:\n` +
                    `   - "title": 표지 슬라이드 (subtitle에 발표 부제/핵심 메시지, bullets에 1~2개 보조 키워드)\n` +
                    `   - "agenda": 발표 목차·구성 흐름 (bullets에 3~5개 목차 제목과 한 줄 설명, subtitle에 발표 전체 흐름 요약)\n` +
                    `   - "cards": 2~4열 카드 그리드 (cards 배열에 3~4개, 최대 6개 객체 { title, body, tag } 작성 — 각 주제의 하위 개념·사례·장단점을 카드로 시각화)\n` +
                    `   - "timeline": 순서·역사·실험/알고리즘 단계 흐름도 (steps 배열에 3~5개 { step: "01", title, detail } 작성)\n` +
                    `   - "stats": 핵심 지표·요점 하이라이트 박스 3~4개 (stats 배열에 { value, label, note } 작성) + 하단 보충 bullets 2~3개\n` +
                    `   - "two-column": 좌우 2단 비교·대조 (leftTitle, bullets, rightTitle, rightBullets 모두 빠짐없이 작성)\n` +
                    `   - "table": 비교표·정리표 (tableHeaders 2~4열, tableRows 2~5행)\n` +
                    `   - "quote": 핵심 법칙·명언·핵심 문장 스포트라이트 (quoteText, quoteAuthor 작성 + 하단 해설 bullets 2~3개)\n` +
                    `   - "bullets" / "summary": 번호 배지가 붙는 핵심 정리 (bullets 3~6개, callout 1줄)\n` +
                    `6) 각 본문 슬라이드의 subtitle(선택)에 슬라이드 내용을 요약하는 1줄 부제를 넣고, callout에는 청중이 꼭 기억할 핵심 요약 1줄을 담으세요.\n` +
                    `7) recommendedTheme는 주제 분위기에 맞는 테마("ivory", "navy", "sage", "terracotta", "cobalt", "editorial", "lavender") 중 하나를 추천하고, coverStyle은 "split", "modern", "framed", "minimal" 중 어울리는 것을 선택하세요.\n` +
                    `8) 첨부 파일(한글·워드·PDF·엑셀 등)이나 기존 문서(existingArtifact)를 PPT로 전환하는 경우, 원본의 핵심 주제·수치·표·용어·결론을 누락 없이 적절한 시각 레이아웃(cards/timeline/table/two-column 등)으로 분배하고 상세 맥락은 speakerNotes에 담으세요.\n` +
                    `9) 수식은 PowerPoint에서 깨지지 않게 LaTeX 달러 기호($) 없이 유니코드 수식(x², √, ±, ≤, ≥, ≠, →, ×, ÷, ∑, π)으로 작성하세요.\n` +
                    `10) 모든 슬라이드에 자연스러운 구어체 발표 대본(speakerNotes)을 반드시 포함하세요.\n` +
                    `11) 같은 형식의 existingArtifact가 주어진 경우 학생의 수정 지시("내용 더 풍부하게", "디자인 다양하게" 등)를 정교하게 반영하되 유지해야 할 완성된 맥락은 보존하세요.\n` +
                    `12) [사실 기반 작성 · 허구 금지]: 첨부 자료·대화 내용·검증된 교과 사실에 없는 가상 설문 통계(가짜 % 수치), 거짓 실험 결과, 존재하지 않는 논문·책·출처를 절대 지어내지 마세요. "stats" 레이아웃에서도 검증된 실제 수치가 없다면 가짜 숫자를 만들지 말고 "3대 원리", "1단계", "핵심 4요소" 같은 구조적 강조나 "[조사 데이터 입력 필요]"를 사용하세요.\n` +
                    `13) subjectLabel은 교과 주제에 맞게 간결히(기본값 "${subjectLabel}"), authorLine은 "${defaultAuthorLine}" 형식을 따르세요.`,
                  thinkingConfig: { thinkingLevel: resolvedThinking },
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      assistantSummary: {
                        type: Type.STRING,
                        description: '학생에게 보여주는 친절한 제작/수정 완료 안내 2~3문장',
                      },
                      title: { type: Type.STRING, description: '프레젠테이션 전체 제목' },
                      subtitle: { type: Type.STRING, description: '부제목 또는 한 줄 요약' },
                      subjectLabel: { type: Type.STRING },
                      authorLine: { type: Type.STRING },
                      recommendedTheme: {
                        type: Type.STRING,
                        description: 'ivory, navy, sage, terracotta, cobalt, editorial, lavender 중 하나',
                      },
                      coverStyle: {
                        type: Type.STRING,
                        description: 'split, modern, framed, minimal 중 하나',
                      },
                      slides: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            layout: {
                              type: Type.STRING,
                              description: 'title, agenda, bullets, two-column, cards, timeline, stats, table, quote, summary 중 하나',
                            },
                            kicker: { type: Type.STRING, description: '슬라이드 상단 작은 섹션 분류명' },
                            title: { type: Type.STRING, description: '슬라이드 제목' },
                            subtitle: { type: Type.STRING, description: '슬라이드 제목 아래 짧은 부제/핵심 메시지' },
                            bullets: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                              description: '핵심 항목 목록',
                            },
                            leftTitle: { type: Type.STRING, description: 'two-column일 때 왼쪽 열 제목' },
                            rightTitle: { type: Type.STRING, description: 'two-column일 때 오른쪽 열 제목' },
                            rightBullets: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                              description: 'two-column일 때 오른쪽 열 항목 목록',
                            },
                            cards: {
                              type: Type.ARRAY,
                              description: 'cards 레이아웃일 때 3~6개의 시각 카드 항목',
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  title: { type: Type.STRING },
                                  body: { type: Type.STRING },
                                  tag: { type: Type.STRING },
                                },
                                required: ['title', 'body'],
                              },
                            },
                            steps: {
                              type: Type.ARRAY,
                              description: 'timeline 레이아웃일 때 3~5개의 단계 항목',
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  step: { type: Type.STRING },
                                  title: { type: Type.STRING },
                                  detail: { type: Type.STRING },
                                },
                                required: ['step', 'title', 'detail'],
                              },
                            },
                            stats: {
                              type: Type.ARRAY,
                              description: 'stats 레이아웃일 때 3~4개의 핵심 지표/요점 하이라이트',
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  value: { type: Type.STRING },
                                  label: { type: Type.STRING },
                                  note: { type: Type.STRING },
                                },
                                required: ['value', 'label'],
                              },
                            },
                            quoteText: { type: Type.STRING, description: 'quote 레이아웃일 때 핵심 인용문 또는 원리 문장' },
                            quoteAuthor: { type: Type.STRING, description: 'quote 레이아웃일 때 출처 또는 인물' },
                            callout: { type: Type.STRING, description: '하단 강조 포인트 한 줄' },
                            tableHeaders: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                            },
                            tableRows: {
                              type: Type.ARRAY,
                              items: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                              },
                            },
                            speakerNotes: { type: Type.STRING, description: '발표자 대본' },
                          },
                          required: ['layout', 'title', 'bullets', 'speakerNotes'],
                        },
                      },
                    },
                    required: ['assistantSummary', 'title', 'subtitle', 'subjectLabel', 'authorLine', 'slides'],
                  },
                },
              }),
              effectiveDensity === 'rich'
                ? useFallbackModel
                  ? 68000
                  : 64000
                : useFallbackModel
                  ? 52000
                  : 50000,
              'PPT 슬라이드 생성 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
            ),
          1
        );

        const rawJson = (response.text ?? '{}').trim();
        const parsed = JSON.parse(rawJson);
        const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
        const resolvedTheme =
          typeof pptThemeId === 'string' && VALID_THEMES.has(pptThemeId)
            ? pptThemeId
            : typeof parsed.recommendedTheme === 'string' && VALID_THEMES.has(parsed.recommendedTheme)
              ? parsed.recommendedTheme
              : 'ivory';
        const resolvedCoverStyle =
          typeof parsed.coverStyle === 'string' && VALID_COVERS.has(parsed.coverStyle)
            ? parsed.coverStyle
            : effectiveDesignStyle === 'infographic'
              ? 'modern'
              : effectiveDesignStyle === 'editorial'
                ? 'framed'
                : 'split';

        res.json({
          assistantSummary:
            parsed.assistantSummary ||
            `요청하신 주제로 총 ${slides.length}장의 PPT 발표자료와 발표 대본을 완성했습니다. 아래 미리보기에서 슬라이드를 넘겨 확인하고 바로 .pptx 파일로 저장하거나 수정할 부분을 말씀해 주세요.`,
          document: {
            kind: 'presentation',
            title: parsed.title || topic.trim() || `${subjectLabel} 발표 자료`,
            subtitle: parsed.subtitle || `${gradeLabel} ${subjectLabel} 핵심 발표`,
            subjectLabel: parsed.subjectLabel || subjectLabel,
            authorLine: parsed.authorLine || defaultAuthorLine,
            themeId: resolvedTheme,
            density: effectiveDensity,
            designStyle: effectiveDesignStyle,
            coverStyle: resolvedCoverStyle,
            slides,
          },
        });
        return;
      }

      const isReportTemplate =
        templateKind === 'report' ||
        subTrackId === 'report' ||
        /보고서|탐구|수행평가|서론|결론|비평/.test(topic);
      const docRoleDesc = isReportTemplate
        ? '학교 제출용 수행평가·탐구 보고서(탐구 동기, 이론적 배경, 본론 분석, 비교표, 탐구 결과 및 성찰/결론)'
        : '한글(.hwpx)·PDF·워드(.docx)로 바로 활용 가능한 고품질 학습 정리 문서(핵심 요약, 원리 설명, 예시·풀이, 비교표, 체크포인트)';
      const mathFormatRule =
        format === 'pdf'
          ? 'PDF 미리보기에서는 KaTeX 수식이 지원되므로 필요한 수식은 인라인 `$...$` 형식으로 정확히 작성할 수 있습니다. (단, 표 안의 짧은 수치/기호는 깔끔한 유니코드도 좋습니다.)'
          : '한글(.hwpx) 및 워드(.docx) 파일에서는 `$` 기호가 그대로 노출되지 않도록 수식을 반드시 깔끔한 유니코드 표기(x², aₙ, √(b²-4ac), ≤, ≥, ≠, →, ×, ÷, ∑, π 등)로 작성하고 불필요한 마크다운 기호(`**`, `###`) 없이 순수 문장으로 작성하세요.';

      const targetFormatLabel =
        format === 'pdf'
          ? 'PDF(.pdf)'
          : format === 'docx'
            ? 'MS Word(.docx)'
            : '한컴 한글(.hwpx)';

      userParts.push({
        text: `다음 요청과 자료를 바탕으로 ${docRoleDesc} (${targetFormatLabel}) 형식의 완성도 높은 문서를 JSON으로 직접 작성(또는 첨부 파일/PPT를 문서로 전환·수정)해 주세요.\n\n${textSections.join('\n\n')}`,
      });

      const response = await withRetry(
        (_attempt, useFallbackModel) =>
          withTimeout(
            ai.models.generateContent({
              model: useFallbackModel ? FAST_GATE_MODEL : MODEL_NAME,
              contents: [{ role: 'user', parts: userParts }],
              config: {
                systemInstruction:
                  `당신은 한국 ${gradeLabel} 학생을 위해 한글(.hwpx)·PDF·워드(.docx) 문서를 직접 작성·전환·편집해 주는 "문서 제작 · 형식 전환 AI"입니다.` +
                  `${careerGoal ? ` 학생의 희망 진로(${careerGoal})와 연결할 수 있는 탐구·응용 포인트가 있다면 결론이나 마지막 섹션에 자연스럽게 반영하세요.` : ''}\n` +
                  `[문서 작성 및 형식 전환 원칙]:\n` +
                  `1) assistantSummary: 학생에게 건네는 친절한 한국어 안내 2~3문장(요청한 내용/자료 기준으로 어떤 문서를 완성했는지 간결히 안내).\n` +
                  `2) [요청 범위 엄수]: 학생이 특정 부분·범위·섹션 수("서론만", "이 단원까지만", "목차만", "3개 항목으로")를 지정했다면 반드시 그 범위만 작성하고 요청하지 않은 다음 단원이나 추가 내용을 임의로 덧붙이지 마세요. 별도 지정이 없을 때만 제목·부제·핵심 요약(overview)·3~7개 섹션·결론(conclusion)을 갖춰 작성하세요.\n` +
                  `3) PPT(.pptx/.ppt)나 기존 발표자료(existingArtifact.kind==="presentation") 또는 다른 문서(PDF·HWP·DOCX·XLSX)를 이 문서 형식으로 전환할 때는, 원본 슬라이드/문서의 모든 주제·핵심 논점·수치·공식·비교표·발표자 대본 설명을 빠짐없이 보존하면서 읽기 좋은 자연스러운 설명 문단(paragraphs), 구조화된 항목(bullets), 표(tableHeaders/tableRows)로 재구성하세요.\n` +
                  `4) 각 섹션은 heading, summary(선택), paragraphs(1~3개 완성된 문단), bullets(핵심 정리 항목), 선택적 callout(주의점·핵심 공식·시험 함정), 필요 시 비교표(tableHeaders + tableRows)를 알차게 담으세요.\n` +
                  `5) ${mathFormatRule}\n` +
                  `6) 같은 형식의 existingArtifact가 주어진 경우 학생의 수정 지시 부분만 정확히 반영하고 나머지 완성된 부분은 임의로 바꾸지 마세요.\n` +
                  `7) [사실 기반 작성 · 허구 금지]: 첨부 자료·대화 내용·검증된 교과 사실에 없는 가상 설문 통계, 거짓 실험 결과, 존재하지 않는 논문·책·판례·인용구를 절대 지어내지 마세요. 실제 조사·실험 수치가 필요하지만 제공되지 않은 경우 가짜 숫자를 채우지 말고 "[직접 조사·실험 데이터 입력 필요]"로 명확히 표기하세요.\n` +
                  `8) subjectLabel은 교과 주제에 맞게 간결히(기본값 "${subjectLabel}"), authorLine은 "${defaultAuthorLine}" 형식을 따르세요.`,
                thinkingConfig: { thinkingLevel: resolvedThinking },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    assistantSummary: {
                      type: Type.STRING,
                      description: '학생에게 보여주는 친절한 문서 제작/수정 완료 안내 2~3문장',
                    },
                    title: { type: Type.STRING, description: '문서 제목' },
                    subtitle: { type: Type.STRING, description: '문서 부제 또는 주제 설명' },
                    subjectLabel: { type: Type.STRING },
                    authorLine: { type: Type.STRING },
                    overview: { type: Type.STRING, description: '문서 전체 핵심 요약 2~4문장' },
                    sections: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          heading: { type: Type.STRING, description: '섹션 소제목 (예: 1. 핵심 개념과 원리)' },
                          summary: { type: Type.STRING, description: '소단원 한 줄 요약' },
                          paragraphs: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: '충실한 설명 문단 1~3개',
                          },
                          bullets: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: '핵심 요약·예시 항목 목록',
                          },
                          callout: { type: Type.STRING, description: '꼭 기억할 핵심 팁 또는 오답 주의 포인트' },
                          tableHeaders: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          tableRows: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.ARRAY,
                              items: { type: Type.STRING },
                            },
                          },
                        },
                        required: ['heading', 'paragraphs'],
                      },
                    },
                    conclusion: { type: Type.STRING, description: '마무리 결론 또는 성찰·학습 제언' },
                  },
                  required: ['assistantSummary', 'title', 'subtitle', 'subjectLabel', 'authorLine', 'overview', 'sections'],
                },
              },
            }),
            useFallbackModel ? 50000 : 48000,
            '문서 구조 생성 대기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
          ),
        1
      );

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson);
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      res.json({
        assistantSummary:
          parsed.assistantSummary ||
          `요청하신 주제로 ${sections.length}개 섹션으로 구성된 문서를 완성했습니다. 아래 문서 시트를 확인한 뒤 한글(.hwpx), PDF, 워드(.docx) 중 원하는 파일로 바로 저장하거나 수정 사항을 말씀해 주세요.`,
        document: {
          kind: 'document',
          title: parsed.title || topic.trim() || `${subjectLabel} 학습 문서`,
          subtitle: parsed.subtitle || `${gradeLabel} ${subjectLabel} 정리`,
          subjectLabel: parsed.subjectLabel || subjectLabel,
          authorLine: parsed.authorLine || defaultAuthorLine,
          overview: parsed.overview || '',
          sections,
          conclusion: parsed.conclusion || '',
        },
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STUDY:ON server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
