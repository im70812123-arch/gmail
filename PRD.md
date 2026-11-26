# STUDY:ON — 제품 요구사항 정의서 (PRD)

> **문서 버전**: v1.0  
> **기준 코드베이스**: STUDY:ON (중·고등 전 과목 AI 디지털 학습 노트)  
> **작성 일자**: 2026-11-22

---

## 1. 제품 개요 (Product Overview)

### 1.1 제품 비전 및 목적
**STUDY:ON**은 대한민국 중·고등학생을 대상으로 하는 **과목 특화형 AI 디지털 학습 노트 및 멀티모달 튜터 플랫폼**이다.  
단순 질의응답 챗봇을 넘어, 한국 중·고등학교 교육과정(내신·모의고사·수능·수행평가·학교생활기록부 세특)의 맥락을 반영해 **학습 로비 → 과목별 전용 튜터/도구 스튜디오 → 확인 퀴즈·암기 카드·오답노트 복습**까지 이어지는 완결형 자기주도 학습 워크플로우를 제공한다.

### 1.2 핵심 가치 제안 (Value Proposition)
1. **과목 경계가 명확한 8개 교과 전용 AI + 4개 범용 스튜디오**: 타 과목 질문 혼입을 방지하는 과목 게이트(Subject Gate)와 원클릭 과목 전환(`[[SWITCH:id]]`) 제공.
2. **학습 목적에 맞춘 4가지 학습 모드 & 2단계 추론 깊이**: 소크라테스식 튜터 / 빠른 해설 / 문제·풀이만 / 수행평가 코치 모드와 표준·심화 추론(`LOW` / `HIGH`) 전환.
3. **진로·학과 연계 및 세특 확장**: 학생의 희망 진로·학과를 전 과목 개념 설명·수행평가·확인 퀴즈·웹 자료 검색에 자동 연결.
4. **멀티모달 스튜디오 & 음성 학습**: 다중 이미지 자동 최적화(클라이언트 리사이징/압축), PDF/코드/텍스트 다중 분석, Web Speech API 기반 STT/TTS 지원.
5. **세션 간 교차 기억(Cross-Session Memory) & 클라우드 동기화**: 게스트 모드(`localStorage`)로 즉시 시작 후 Google 로그인 시 Firebase Firestore로 무손실 마이그레이션 및 실시간 동기화.

### 1.3 타겟 사용자 (Target Personas)
| 페르소나 | 학년/상황 | 주요 니즈 | 핵심 활용 기능 |
| :--- | :--- | :--- | :--- |
| **중학생 학습자** | 중1~중3 (내신 기초·서술형 대비) | 직관적 비유, 기초 개념 확인, 수행평가 안내문 이해 | `중등` 학교급, `튜터` 모드, `수행평가` 모드, `사진 분석 AI` |
| **고등학생 학습자** | 고1~고3 (내신·수능·세특 대비) | 심화 원리·반례 검증, 빠른 풀이, 진로 연계 세특 주제 발굴 | `고등` 학교급, `심화 추론`, `문제·풀이만`, `진로 연계`, `확인 퀴즈` |
| **자기주도 복습 학습자** | 시험 직전 복습 및 오답 관리 | 핵심 요약 압축, 능동적 회상(Active Recall), 모바일/PC 연동 | `오답·핵심노트`, `암기 플래시카드`, `Google 계정 동기화` |

---

## 2. 정보 구조 및 화면 구성 (IA & User Flow)

### 2.1 전역 레이아웃 (App Shell)
- **좌측 고정 사이드바 (`Sidebar`, 데스크톱 268px / 모바일 드로어)**:
  - 브랜드 헤더 (`STUDY:ON`) + **새 노트** 생성 버튼
  - **학습 로비 (홈)** 진입 버튼
  - **AI 대화 · 자료 도구** 4종 (`AI 자유 대화`, `문서 요약 AI`, `사진 분석 AI`, `사이트 · 앱 검색 AI`)
  - **전 과목 전문 튜터** 8종 (`국어`, `수학`, `영어`, `과학`, `사회`, `역사`, `제2외국어`, `정보 · AI`)
  - **최근 대화 · 검색 기록** (최대 30개 표시, 필터: `전체` / `질문·노트` / `검색`, 상단 고정 `pin` 및 삭제 지원)
  - **하단 도크**: `오답 · 핵심노트` 카운터, `저장한 프롬프트` 카운터, `진로 · 학과 설정`, `프로필 / Google 로그인`, `웜 아이보리 / 다크 모드` 토글

### 2.2 화면별 상세 명세

#### A. 학습 로비 (`LobbyView`)
- **상단 바**: 학교급 토글(`중등` / `고등`), Google 로그인/프로필 버튼, 테마 전환(Light `#FAF7F0` / Dark `#111215`).
- **인사 히어로 영역**: 시간대별 인사말 + 사용자 이름, 학습 통계 요약(`학습 노트 N개 · 오답노트 N개 · 프롬프트 N개`), `AI와 자유 대화하기` CTA.
- **상단 2단 카드 그리드**:
  - **희망 진로 · 학과 카드**: 미설정 시 프리셋 8종 빠른 선택 + 직접 입력 폼 / 설정 완료 시 전 과목 진로 연계 ON/OFF 토글, 진로 수정 모달, 진로 탐구 사이트 찾기 이동.
  - **최근 AI 답변 이어보기 카드**: 최근 유효 AI 응답이 있는 세션 최대 4건 프리뷰 및 원클릭 이어보기.
- **과목별 전용 AI 바로가기 (8개 카드 그리드)**:
  - 상단 진입 모드 스위치: `일반 학습` vs `수행평가 준비` (선택 시 해당 과목의 `performance` 모드로 즉시 진입).
  - 각 과목 카드에 고유 아이콘·액센트 컬러, 핵심 설명, 누적 대화 수, 현재 학교급 기준 세부 트랙 수 표시.
- **빠른 실행 · 전 과목 자료 도구 독**: 4개 스튜디오 바로가기 + `오답 · 핵심노트`, `저장한 프롬프트` 모달 열기.

#### B. 학습 워크스페이스 (`WorkspaceHeader` + `ChatPane` / `StudioSplitPane`)
- **워크스페이스 헤더**:
  - 로비 복귀 버튼, 과목 아이콘·이름·요약 설명.
  - 컨트롤 바: `진로 설정` 모달, `진로 연계` 토글, `심화 추론` 토글(`standard` / `deep`), 학교급(`중등` / `고등`), 학습 모드 4종(`튜터` / `빠른 해설` / `문제·풀이만` / `수행평가`), `암기 카드` 버튼, `확인 퀴즈` 버튼(유효 AI 응답 존재 시 활성), 테마 전환.
  - **세부 트랙 스트립**: 과목 및 학교급(`gradeHint`)에 따라 필터링된 세부 단원/영역 탭 선택.
- **빈 노트 커버 화면 (Empty State)**:
  - 최초 방문 시 인라인 희망 진로 설정 시트(나중에 설정 가능).
  - 인덱스 번호(`01.`~`12.`), 학교급·모드·세부 트랙·진로 연계 메타데이터 표시.
  - 모드별 맞춤 안내 문구 및 동적 빠른 학습 질문 카드 그리드(수행평가/문제·풀이만/진로/검색에 따라 자동 생성).
- **스플릿 스튜디오 (`StudioSplitPane`)** — `문서 요약 AI`, `사진 분석 AI` 전용:
  - 좌측(데스크톱 42% / 모바일 상단 46vh) 원본 자료 패널 + 우측 대화 패널, 좌측 패널 접기/펼치기 지원.
  - **문서 요약 AI**: PDF, TXT, MD, CSV, 코드(`.py`, `.js`, `.ts`, `.json`) 다중 업로드(파일당 최대 15MB) + 교과서/필기 텍스트 직접 붙여넣기 + 즉시 분석 액션 버튼(모드별 분기).
  - **사진 분석 AI**: PNG, JPG, WEBP 다중 업로드, 드래그 앤 드롭, 전역 `Ctrl+V` 클립보드 연속 붙여넣기, 미리보기 그리드 및 일괄 분석/오답 체크 버튼.
- **메시지 타임라인 & 디지털 노트 카드**:
  - 사용자 버블: 첨부 이미지 썸네일 그리드, 첨부 파일 목록, hover 시 `프롬프트 저장` 버튼.
  - AI 노트 카드: Markdown + GFM 표 + KaTeX 수식(`$...$`, `$$...$$`) 렌더링, 헤더 액션(`듣기/중지` TTS, `오답노트 저장`, `복사`).
  - 타 과목 안내 시 원클릭 이동 버튼(`[[SWITCH:workspaceId]]` 파싱 -> 기존 질문 및 첨부 파일 자동 이관).
  - 오류 발생 시 실패 컨텍스트(프롬프트+첨부) 기반 `다시 시도` 버튼.
  - 마지막 AI 응답 하단 **심화 후속 액션 스트립**:
    - 일반/튜터: `유사 변형 문제 풀기`, `3줄 암기 압축`, `참고 자료 · 링크 찾기`, `세특 · 심화 탐구 확장`
    - 문제·풀이만: `유사 문제 1개 더 풀기`, `난이도 높여서 1문제 더`, `다른 풀이 방법 보기`
    - 수행평가: `보고서 개요 · 목차 짜기`, `감점 체크 · 고득점 팁`, `발표 대본 · 예상 질문`, `참고 통계 · 자료 링크 찾기`
  - **참고 자료 · 추천 링크 카드**: Google Search Grounding 출처 도메인 및 외부 링크 카드 렌더링.
- **플로팅 입력 도크 (Composer)**:
  - 파일 첨부(다중 드래그 앤 드롭 및 `Ctrl+V`), 저장 프롬프트 불러오기, 입력 중 텍스트 프롬프트 저장, 마이크 음성 입력(STT), 음성 자동 읽기(`음성 답변`) 토글, 새 노트 초기화, 전송(`Enter` 전송 / `Shift+Enter` 줄바꿈).

---

## 3. 기능 요구사항 (Functional Requirements)

### FR-01. 12개 워크스페이스 및 세부 트랙 체계
| 구분 | ID | 워크스페이스명 | 세부 트랙 (`subTracks`) | 핵심 역할 |
| :--- | :--- | :--- | :--- | :--- |
| 교과 | `korean` | 국어 | 독서(비문학), 현대·고전문학, 문법·언매, 서술형·논술 | 문단 구조·표현법·음운변동·서술형 첨삭 |
| 교과 | `math` | 수학 | 중등 대수·함수, 중등 도형·피타고라스, 공통수학, 수학Ⅰ, 수학Ⅱ, 미적분·확통·기하 | LaTeX 수식 전개, 조건 점검, 반례·함정 체크 |
| 교과 | `english` | 영어 | 구문·독해, 핵심 어법, 영작·서술형, 어휘·숙어 | S/V/O/C 끊어 읽기, 어법 포인트, 원어민 수준 교정 |
| 교과 | `science` | 과학 | 물리학, 화학, 생명과학, 지구과학 | 공식/반응식 LaTeX 표기, 실험 변인(독립·종속·통제) 해석 |
| 교과 | `social` | 사회 | 통합사회·일반, 경제, 정치와 법, 지리, 윤리 | 개념 비교표, 경제 그래프·선거·헌법·사상 판별 |
| 교과 | `history` | 역사 | 한국사(전근대), 한국사(근현대), 세계사 | 시대 배경-전개-결과 인과관계, 사료 키워드 추론 |
| 교과 | `foreign` | 제2외국어 | 일본어, 중국어, 한문 | 후리가나 병기, 간체자+병음(성조), 음·뜻·부수·겉/속뜻 |
| 교과 | `informatics` | 정보 · AI | 인공지능 기초, 파이썬·알고리즘, 데이터·AI 윤리 | ML/DL 원리, 실행 코드, 한 줄 추적(Trace), 복잡도 |
| 스튜디오 | `free-chat` | AI 자유 대화 | 자유 대화, 학습 계획·공부법, 진로·세특 상담, 영어 회화 연습 | 과목 제한 없는 대화, 학습 코칭, 영어 프리토킹 |
| 스튜디오 | `doc-summary` | 문서 요약 AI | 없음 | PDF/텍스트 다중 문서 요약·구조화·예상 출제 포인트 |
| 스튜디오 | `photo-analysis` | 사진 분석 AI | 자동 과목 판별, 수학·과학 문제, 국어·영어·탐구 | 다중 문제/필기 사진 판독, 손글씨 풀이 오류 지점 탐지 |
| 스튜디오 | `resource-search` | 사이트 · 앱 검색 AI | 사이트·앱 통합, 웹사이트 중심, 학습 앱 중심, 진로·학과 탐구 | 실시간 Google 검색 기반 학습 플랫폼·앱 표 및 링크 정리 |

### FR-02. 4가지 학습 모드 (`StudyMode`) & 추론 깊이 (`ThinkingDepth`)
- **`tutor` (튜터 모드)**: 정답 즉시 제공을 지양하고, 핵심 개념 실마리 1단계 + 유도 질문 1~2개를 우선 제시(학생이 풀이 시도를 입력하거나 전체 풀이를 명시 요청한 경우 전체 풀이 제공).
- **`fast` (빠른 해설 모드)**: 핵심 결론·개념 요약 → 원리/단계별 풀이·비교표 → 빈출 오답 함정 순으로 디지털 노트 구조화.
- **`solve-only` (문제·풀이만)**: 서론·개념 노트·진로 부연·웹 검색을 모두 생략하고 `### 문제`, `### 풀이 과정`, `### 정답`만 출력.
- **`performance` (수행평가 코치)**: 과목별 수행평가 특화 루브릭 체크리스트 표, 감점 주의 포인트, 차별화 주제 3종 제안, 서론-본론-결론 목차, 초안 정밀 첨삭, 예상 Q&A, 통계·공식 출처 검색 지원.
- **추론 깊이 (`thinkingDepth`)**: `standard`(`ThinkingLevel.LOW`) / `deep`(`ThinkingLevel.HIGH`) 전환.

### FR-03. 과목 엄격 경계 및 스마트 라우팅 (Subject Gate)
- 8개 교과(`STRICT_SUBJECT_NAMES`) 워크스페이스에서는 해당 교과 학습·수행평가·자연스러운 튜터 대화·이전 학습 회상만 허용.
- **멀티모달 게이트**: 이미지/PDF 등 바이너리 미디어 첨부 시 경량 모델(`gemini-3.1-flash-lite`, 타임아웃 4.5s, JSON 스키마 응답)로 사전 과목 판별 수행. 텍스트 전용 요청은 1회 호출로 쿼터를 절감하기 위해 메인 시스템 프롬프트에서 경계 판별.
- **차단 및 전환 UX**: 타 과목 요청으로 판별되면 풀이를 거절하고 `[[SWITCH:<targetSubjectId>]]` 지시자를 반환하며, 프론트엔드는 질문 텍스트와 첨부 파일을 유지한 채 대상 과목 AI로 즉시 전환하는 버튼을 렌더링한다.

### FR-04. 능동적 복습 도구 (Quiz, Flashcards, Study Notes, Saved Prompts)
- **확인 퀴즈 (`QuizModal`)**: 현재 세션 대화 문맥(최대 8,000자) 기반으로 4지선다 3문항 JSON 생성(진로 연계 문항 최대 1개 포함) → 선택·채점·정오답 및 함정 해설·다시 풀기·새 문제 출제.
- **암기 플래시카드 (`FlashcardsModal`)**: 대화 내용 또는 과목 핵심 개념 기반 6장 카드(`front`, `hint`, `back`, `example`) 생성 → 카드 플립, 힌트 토글, 암기 완료 체크, 영어/제2외국어 발음 듣기(TTS), 새 세트 생성.
- **오답 · 핵심노트 보관함 (`StudyNotesModal`)**: AI 응답 카드에서 원클릭 저장 → 상태 필터(`전체`, `복습 필요`, `복습 완료`), 과목별 필터, 복습 완료 토글(`mastered`), 삭제.
- **저장한 프롬프트 (`PromptsModal`)**: 입력창·사용자 메시지 버블·모달 생성 폼에서 저장(`all` 또는 특정 과목 범위) → 필터링 및 입력창 즉시 불러오기.

### FR-05. 세션 간 교차 기억 (`memoryContext`)
- 새로운 질문을 보낼 때 클라이언트(`buildCrossSessionMemoryContext`)가 현재 세션을 제외한 최근 학습 기록을 최대 4,800자 예산 내에서 자동 조립해 API에 전달:
  - 동일 과목(AI) 최근 세션 최대 4건 (각 최근 4턴)
  - 타 과목/자유 대화/검색 최근 세션 최대 4건
  - 저장한 오답·핵심노트 최대 3건 (현재 과목 우선)

### FR-06. 음성 입출력 (Web Speech API)
- **음성 입력 (STT)**: `SpeechRecognition` / `webkitSpeechRecognition` 활용. 과목/트랙에 맞춰 인식 언어 자동 전환 (`en-US`, `ja-JP`, `zh-CN`, `ko-KR`). 권한 차단/미지원 브라우저 안내 처리.
- **음성 출력 (TTS)**: `window.speechSynthesis` 활용. Markdown/코드블록/지시자 정제 후 최대 900자 낭독. `음성 답변` 자동 읽기 토글 및 개별 응답 재생/중지 지원.

### FR-07. 클라이언트 이미지 최적화 (`imageOptimize.ts`)
- 첨부/붙여넣기 이미지가 `160KB`를 초과할 경우 Canvas를 통해 최대 너비 `1280px`, 최대 높이 `2600px`, 최대 픽셀 `2,200,000px` 이하로 리사이징하고 JPEG(품질 0.85)로 압축(원본보다 작을 때만 적용)해 전송 페이로드와 API 지연 최소화.

---

## 4. 백엔드 API 및 AI 오케스트레이션 명세

### 4.1 기술 스택 및 모델 전략
- **서버**: Node.js + Express (`server.ts`, Port `3000`, 개발 환경에서 Vite 미들웨어 통합, JSON body limit `100mb`)
- **AI SDK**: `@google/genai` (서버 사이드 전용 `GEMINI_API_KEY` 사용, 클라이언트에 키 노출 금지)
- **모델 라우팅**:
  - 주 모델 (`MODEL_NAME`): `gemini-4-hydrogen`
  - 게이트 및 폴백 모델 (`FAST_GATE_MODEL`): `gemini-3.1-flash-lite`
- **회복탄력성 (Resilience)**:
  - **SSE Keepalive**: `/api/ai/chat`은 즉시 SSE 헤더를 열고 5초 간격으로 `: keepalive` 코멘트를 전송해 프록시/브라우저 타임아웃 방지.
  - **자동 재시도 및 모델 폴백 (`withRetry`)**: `429`/`503`/`500`/네트워크 오류/타임아웃 시 쿨다운(`60s`~`90s`) 및 지수 백오프/Retry-Delay 파싱을 적용해 `FAST_GATE_MODEL`로 자동 폴백(재시도 시 `ThinkingLevel.LOW` 하향 및 Google Search 도구 비활성화로 429 회피).
  - **검색 도구 동적 트리거 (`needsWebSearchForChat`)**: `solve-only` 모드가 아니고 질문에 검색 의도 키워드(`링크`, `사이트`, `출처`, `논문`, `통계`, `최신` 등)가 포함된 경우에만 `{ googleSearch: {} }` 활성화.

### 4.2 엔드포인트 정의
| Method & Path | 설명 | 입력 주요 필드 | 출력 포맷 |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | 서버 및 모델 헬스 체크 | - | `{ ok: true, model }` |
| `POST /api/ai/chat` | 과목/스튜디오 스트리밍 AI 응답 | `workspaceId`, `subTrackId`, `gradeLevel`, `studyMode`, `thinkingDepth`, `careerGoal`, `connectCareer`, `memoryContext`, `history`(최근 16개), `prompt`, `attachments` | SSE (`data: { text }`, `{ sources }`, `{ done: true }`, `{ error }`) |
| `POST /api/ai/search` | 사이트·앱 검색 큐레이션 | `subTrackId`, `gradeLevel`, `careerGoal`, `memoryContext`, `history`(최근 10개), `prompt` | JSON `{ text, sources[] }` |
| `POST /api/ai/quiz` | 학습 내용 기반 4지선다 3문항 생성 | `workspaceId`, `subTrackId`, `gradeLevel`, `careerGoal`, `contextText` | JSON `{ questions: QuizQuestion[] }` |
| `POST /api/ai/flashcards` | 능동 회상용 플래시카드 6장 생성 | `workspaceId`, `subTrackId`, `gradeLevel`, `contextText` | JSON `{ cards: FlashcardItem[] }` |

---

## 5. 데이터 모델 및 보안 설계 (Firebase & Local Storage)

### 5.1 저장소 이중화 및 마이그레이션
- **비로그인(Guest) 모드**: 브라우저 `localStorage` 저장 (`studynote_guest_profile_v1`, `studynote_sessions_guest`, `studynote_prompts_guest`, `studynote_studynotes_guest`, `studynote_searches_guest`, `studynote_theme_v1`). 용량 초과 시 이미지 `previewUrl`을 제외한 경량 폴백 저장.
- **Google 로그인(Cloud) 모드**: Firebase Auth (`signInWithPopup` + `GoogleAuthProvider`) 인증 후 Cloud Firestore 실시간 `onSnapshot` 구독.
  - 로그인 시 체크박스 선택에 따라 게스트 로컬 데이터(세션 최대 20개, 프롬프트 30개, 오답노트 40개, 검색기록 20개, 학교급/진로 설정)를 클라우드로 일괄 마이그레이션(`migrateGuestDataToCloud`).
  - 클라우드 저장 시 Base64 `previewUrl` 등 대용량 필드는 자동 제거(`stripHeavyAttachmentFields`).

### 5.2 Firestore 데이터 스키마 (`firebase-blueprint.json`)
- `/users/{userId}` (`UserProfile`): `uid`, `displayName`, `email`, `photoURL?`, `gradeLevel`, `careerGoal?`, `careerPromptDismissed?`, `connectCareer?`, `createdAt`, `updatedAt`
- `/users/{userId}/sessions/{sessionId}` (`NotebookSession`): `id`, `ownerId`, `workspaceId`, `subTrackId?`, `gradeLevel`, `studyMode`, `thinkingDepth?`, `title`, `messages[]`(최대 120개), `pinned?`, `updatedAtMs`, `createdAt`, `updatedAt`
- `/users/{userId}/prompts/{promptId}` (`SavedPrompt`): `id`, `ownerId`, `title`, `content`(최대 4,000자), `workspaceId`, `createdAtMs`, `createdAt`, `updatedAt`
- `/users/{userId}/studyNotes/{noteId}` (`SavedStudyNote`): `id`, `ownerId`, `workspaceId`, `subTrackLabel?`, `gradeLevel`, `title`, `content`(최대 30,000자), `mastered`, `createdAtMs`, `createdAt`, `updatedAt`
- `/users/{userId}/searchHistory/{entryId}` (`SearchHistoryEntry`): `id`, `ownerId`, `query`, `subTrackId?`, `sessionId`, `createdAtMs`, `createdAt`, `updatedAt`

### 5.3 보안 규칙 (`firestore.rules`)
- **기본 전면 거부**: `match /{document=**} { allow read, write: if false; }`
- **이메일 검증 기반 소유자 격리**: `isVerifiedUser()` (`request.auth != null && request.auth.token.email_verified == true`) 및 `request.auth.uid == userId` 강제.
- **불변 필드 및 화이트리스트 검증**: `createdAt`/`uid`/`ownerId`/`id` 불변성 검증, `affectedKeys().hasOnly(...)`를 통한 허용 필드만 부분 업데이트 가능, 서버 타임스탬프(`request.time`) 강제, 문자열 길이 및 enum 엄격 검증.

---

## 6. 비기능 요구사항 및 디자인 시스템 (NFR & Design System)

### 6.1 에디토리얼 디지털 노트북 UI/UX
- **컬러 팔레트**:
  - **웜 아이보리(Light)**: 캔버스 `#FAF7F0`, 사이드바 `#F2EDE3`, 시트 카드 `#FFFEFA`, 보더 `#E6DFD1`, 잉크 `#17191C`
  - **다크(Dark)**: 캔버스 `#111215`, 사이드바 `#16181C`, 시트 카드 `#1A1C22`, 보더 `#272A33`, 텍스트 `#EFECE4`
  - **도트 그리드 패턴**: 24px 간격의 미세한 노트북 점선 격자(`.notebook-canvas-pattern`)
- **타이포그래피**:
  - 본문/UI: `Plus Jakarta Sans`, `Noto Sans KR`
  - 코드/통계/인덱스: `JetBrains Mono` (`tabular-nums`)
  - 수식/본문 렌더링: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex` (`max-width: 74ch`, `line-height: 1.76`)
- **모션 및 접근성**: `motion/react` + `<MotionConfig reducedMotion="user">`로 OS 동작 축소 설정 존중, 키보드 접근성(`Enter`/`Space` 카드 플립 등), 전역 `ErrorBoundary` 탑재.

### 6.2 성능 및 제약사항
- **파일 제한**: 첨부 파일당 최대 `15MB`, 문서 텍스트 입력 프롬프트 컨텍스트 예산 최대 `45,000자`(다중 첨부 시 파일당 `22,000자`).
- **요청 타임아웃**: 클라이언트 Fetch Abort `110초`, 서버 주 모델 `16초`(첨부/심화 추론 시 `25초`), 폴백 모델 `38초`.
- **세션 보관 상한**: 클라이언트/클라우드 동기화 기준 세션 최근 40개, 프롬프트 60개, 오답노트 80개, 검색기록 20개 유지.

---

## 7. 향후 확장 로드맵 (Future Enhancements)
1. **학습 대시보드 및 성취도 분석**: 과목별 질문 빈도, 퀴즈 정답률, 오답노트 복습 완료율 시각화.
2. **수능/내신 타이머 & 모의고사 OMR 연습 모드**: 제한 시간 내 문제 풀이 및 자동 채점 워크플로우.
3. **공유 및 내보내기**: 학습 노트/오답노트 PDF 인쇄 최적화 및 링크 공유(읽기 전용).
4. **오프라인 PWA 지원**: 저장된 오답노트 및 암기 플래시카드 오프라인 복습 기능.
