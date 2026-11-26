import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpRight,
  Bookmark,
  BookmarkPlus,
  BookMarked,
  Check,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  FileOutput,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Paperclip,
  Presentation,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { CareerModal } from './components/CareerModal';
import { DisplaySettingsModal } from './components/DisplaySettingsModal';
import { FlashcardsModal } from './components/FlashcardsModal';
import { GeneratedArtifactCard } from './components/GeneratedArtifactCard';
import { LobbyView } from './components/LobbyView';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { ProfileModal } from './components/ProfileModal';
import { PromptsModal } from './components/PromptsModal';
import { QuizModal } from './components/QuizModal';
import { Sidebar } from './components/Sidebar';
import { StudioSplitPane } from './components/StudioSplitPane';
import { StudyNotesModal } from './components/StudyNotesModal';
import { SubjectIcon } from './components/SubjectIcon';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { CAREER_PRESETS, WORKSPACE_MAP, WORKSPACES } from './data/subjects';
import {
  extractAttachmentsFromFile,
  getAttachmentVisualInfo,
  SUPPORTED_DOC_AND_MEDIA_ACCEPT,
} from './utils/fileExtractor';
import { fileToOptimizedImageAttachment } from './utils/imageOptimize';
import { buildCrossSessionMemoryContext } from './utils/memoryContext';
import { getAnswerFontOption, getFontSizeOption } from './utils/typography';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, testConnection } from './firebase';
import {
  clearKnownCloudIds,
  deletePromptFromCloud,
  deleteSessionFromCloud,
  deleteStudyNoteFromCloud,
  ensureUserProfileDoc,
  migrateGuestDataToCloud,
  savePromptToCloud,
  saveSearchHistoryToCloud,
  saveSessionToCloud,
  saveStudyNoteToCloud,
  subscribeUserStudyData,
  toggleSessionPinInCloud,
  toggleStudyNoteMasteredInCloud,
  updateUserStudyPrefs,
} from './services/firestoreStudy';
import type {
  AnswerFontPreset,
  AttachmentPayload,
  ChatMessage,
  ExportFormat,
  FlashcardItem,
  FontSizePreset,
  GeneratedDocumentPayload,
  GradeLevel,
  GroundingSource,
  NotebookSession,
  PptDensity,
  PptDesignStyle,
  PptThemeId,
  QuizQuestion,
  SavedPrompt,
  SavedStudyNote,
  SearchHistoryEntry,
  StudentProfile,
  StudyMode,
  ThinkingDepth,
  WorkspaceId,
} from './types/study';

const GUEST_STORAGE_KEY = 'studynote_guest_profile_v1';

const DEFAULT_GUEST_PROFILE: StudentProfile = {
  id: 'guest',
  name: '게스트 학습자',
  authProvider: 'guest',
  gradeLevel: 'high',
  isGuest: true,
  createdAt: 0,
};

const STORAGE_THEME_KEY = 'studynote_theme_v1';
const STORAGE_FONT_SIZE_KEY = 'studynote_font_size_v1';
const STORAGE_ANSWER_FONT_KEY = 'studynote_answer_font_v1';

const VALID_FONT_SIZES: FontSizePreset[] = ['sm', 'md', 'lg', 'xl'];
const VALID_ANSWER_FONTS: AnswerFontPreset[] = ['sans', 'plex', 'serif', 'gowun', 'handwriting'];

function loadStoredFontSize(): FontSizePreset {
  try {
    const raw = localStorage.getItem(STORAGE_FONT_SIZE_KEY) as FontSizePreset | null;
    return raw && VALID_FONT_SIZES.includes(raw) ? raw : 'md';
  } catch {
    return 'md';
  }
}

function loadStoredAnswerFont(): AnswerFontPreset {
  try {
    const raw = localStorage.getItem(STORAGE_ANSWER_FONT_KEY) as AnswerFontPreset | null;
    return raw && VALID_ANSWER_FONTS.includes(raw) ? raw : 'sans';
  } catch {
    return 'sans';
  }
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultSubTrack(workspaceId: WorkspaceId, gradeLevel: GradeLevel): string | undefined {
  const tracks = WORKSPACE_MAP[workspaceId].subTracks;
  if (!tracks || tracks.length === 0) return undefined;
  const matched = tracks.find((t) => !t.gradeHint || t.gradeHint === gradeLevel);
  return matched ? matched.id : tracks[0].id;
}

function createEmptySession(
  workspaceId: WorkspaceId,
  gradeLevel: GradeLevel,
  studyMode: StudyMode,
  thinkingDepth: ThinkingDepth = 'standard'
): NotebookSession {
  return {
    id: createId('note'),
    workspaceId,
    subTrackId: getDefaultSubTrack(workspaceId, gradeLevel),
    gradeLevel,
    studyMode,
    thinkingDepth,
    title: `${WORKSPACE_MAP[workspaceId].name} 새 노트`,
    messages: [],
    updatedAt: Date.now(),
  };
}

function loadGuestProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return DEFAULT_GUEST_PROFILE;
    return { ...DEFAULT_GUEST_PROFILE, ...JSON.parse(raw), id: 'guest', isGuest: true };
  } catch {
    return DEFAULT_GUEST_PROFILE;
  }
}

function loadSessionsForProfile(profileId: string): NotebookSession[] {
  try {
    const raw = localStorage.getItem(`studynote_sessions_${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionsForProfile(profileId: string, sessions: NotebookSession[]) {
  const trimmed = sessions.slice(0, 40);
  try {
    localStorage.setItem(`studynote_sessions_${profileId}`, JSON.stringify(trimmed));
  } catch {
    try {
      const compact = trimmed.map((s) => ({
        ...s,
        messages: s.messages.map((m) => ({
          ...m,
          attachment: m.attachment ? { ...m.attachment, previewUrl: undefined } : undefined,
          attachments: m.attachments
            ? m.attachments.map((att) => ({ ...att, previewUrl: undefined }))
            : undefined,
        })),
      }));
      localStorage.setItem(`studynote_sessions_${profileId}`, JSON.stringify(compact));
    } catch {
      // ignore
    }
  }
}

function loadActiveSessionId(profileId: string): string | null {
  try {
    return localStorage.getItem(`studynote_active_session_${profileId}`);
  } catch {
    return null;
  }
}

function saveActiveSessionId(profileId: string, sessionId: string | null) {
  try {
    if (sessionId) {
      localStorage.setItem(`studynote_active_session_${profileId}`, sessionId);
    } else {
      localStorage.removeItem(`studynote_active_session_${profileId}`);
    }
  } catch {
    // ignore
  }
}

function loadPromptsForProfile(profileId: string): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(`studynote_prompts_${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePromptsForProfile(profileId: string, prompts: SavedPrompt[]) {
  try {
    localStorage.setItem(`studynote_prompts_${profileId}`, JSON.stringify(prompts.slice(0, 60)));
  } catch {
    // ignore
  }
}

function loadSearchHistoryForProfile(profileId: string): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`studynote_searches_${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSearchHistoryForProfile(profileId: string, entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(`studynote_searches_${profileId}`, JSON.stringify(entries.slice(0, 20)));
  } catch {
    // ignore
  }
}

function loadStudyNotesForProfile(profileId: string): SavedStudyNote[] {
  try {
    const raw = localStorage.getItem(`studynote_studynotes_${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStudyNotesForProfile(profileId: string, notes: SavedStudyNote[]) {
  try {
    localStorage.setItem(`studynote_studynotes_${profileId}`, JSON.stringify(notes.slice(0, 80)));
  } catch {
    // ignore
  }
}

function extractDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

const VALID_EXPORT_FORMATS: ExportFormat[] = ['pdf', 'hwpx', 'docx', 'pptx'];

function parseAssistantDirectives(raw: string): {
  cleanContent: string;
  switchWorkspaceId?: WorkspaceId;
  docDirective?: { format: ExportFormat; title: string };
} {
  const switchMatch = raw.match(/\[\[SWITCH:([a-z-]+)\]\]/);
  const candidate = switchMatch?.[1] as WorkspaceId | undefined;
  const switchWorkspaceId =
    candidate && candidate in WORKSPACE_MAP ? candidate : undefined;

  const docMatch = raw.match(/\[\[DOC_READY:(pdf|hwpx|docx|pptx)(?:\|([^\]]*))?\]\]/i);
  let docDirective: { format: ExportFormat; title: string } | undefined;
  if (docMatch) {
    const rawFmt = docMatch[1].toLowerCase() as ExportFormat;
    if (VALID_EXPORT_FORMATS.includes(rawFmt)) {
      docDirective = {
        format: rawFmt,
        title: (docMatch[2] || '').trim(),
      };
    }
  }

  const cleanContent = raw
    .replace(/\s*\[\[SWITCH:[a-z-]*\]?\]?\s*$/g, '')
    .replace(/\s*\[\[SWITCH:[a-z-]+\]\]\s*/g, '\n')
    .replace(/\s*\[\[DOC_READY:[^\]\n]*\]?\]?\s*$/gi, '')
    .replace(/\s*\[\[DOC_READY:[^\]\n]+\]\]\s*/gi, '\n')
    .trim();

  return { cleanContent, switchWorkspaceId, docDirective };
}

const TARGET_FORMAT_PATTERNS: Array<{ format: ExportFormat; re: RegExp }> = [
  {
    format: 'pptx',
    re: /(?:(?:\.pptx|\.ppt|pptx|ppt|피피티|파워포인트|슬라이드|발표\s*자료|프레젠테이션)(?:\s*\([^)]*\))?(?:\s*(?:파일|문서|자료|형식))?\s*(?:으?로(?:\s*(?:변환|전환|바꿔|바꾸|변경|만들|제작|생성|저장|내보내))?|\s*(?:변환|전환|만들어|제작해|작성해|생성해|뽑아))|(?:to|into|as)\s+(?:\.?pptx|\.?ppt|powerpoint|slides?))/gi,
  },
  {
    format: 'pdf',
    re: /(?:(?:\.pdf|pdf|피디에프)(?:\s*\([^)]*\))?(?:\s*(?:파일|문서|자료|형식))?\s*(?:으?로(?:\s*(?:변환|전환|바꿔|바꾸|변경|만들|제작|생성|저장|내보내))?|\s*(?:변환|전환|만들어|제작해|작성해|생성해|뽑아))|(?:to|into|as)\s+\.?pdf\b)/gi,
  },
  {
    format: 'docx',
    re: /(?:(?:\.docx|\.doc|docx|워드|word)(?:\s*\([^)]*\))?(?:\s*(?:파일|문서|자료|형식))?\s*(?:으?로(?:\s*(?:변환|전환|바꿔|바꾸|변경|만들|제작|생성|저장|내보내))?|\s*(?:변환|전환|만들어|제작해|작성해|생성해|뽑아))|(?:to|into|as)\s+(?:\.?docx|word)\b)/gi,
  },
  {
    format: 'hwpx',
    re: /(?:(?:(?:\.hwpx|\.hwp|hwpx|hwp|한컴\s*한글|아래아\s*한글)(?:\s*\([^)]*\))?(?:\s*(?:파일|문서|자료|형식))?\s*(?:으?로(?:\s*(?:변환|전환|바꿔|바꾸|변경|만들|제작|생성|저장|내보내))?|\s*(?:변환|전환|만들어|제작해|작성해|생성해|뽑아)))|(?:한글(?:\s*\([^)]*\))?\s*(?:파일|문서|보고서|자료|형식)\s*(?:으?로|\s*(?:변환|전환|만들어|제작해|작성해))|한글로\s*(?:변환|전환|바꿔|바꾸|변경|만들|제작|생성|내보내|저장))|(?:to|into|as)\s+(?:\.?hwpx|\.?hwp|hangul)\b)/gi,
  },
];

function detectExplicitTargetFormat(promptText: string): ExportFormat | null {
  let bestMatch: { format: ExportFormat; endIndex: number } | null = null;
  for (const { format, re } of TARGET_FORMAT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(promptText)) !== null) {
      const endIndex = m.index + m[0].length;
      if (!bestMatch || endIndex > bestMatch.endIndex) {
        bestMatch = { format, endIndex };
      }
    }
  }
  if (bestMatch) return bestMatch.format;

  // Fallback: check creation intent paired with a single clear format mention (not followed by source particles 를/을/에서)
  if (/(만들|제작|작성|생성|변환|전환|바꿔|내보내|저장)/.test(promptText)) {
    const lower = promptText.toLowerCase();
    const candidates: Array<{ format: ExportFormat; idx: number }> = [];
    const scanLast = (fmt: ExportFormat, re: RegExp) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(lower)) !== null) {
        const tail = lower.slice(m.index + m[0].length, m.index + m[0].length + 6);
        if (/^\s*(?:\([^)]*\)\s*)?(?:파일|문서|자료)?\s*(?:을|를|에서|의\b|가\b|이\b)/.test(tail)) {
          continue;
        }
        candidates.push({ format: fmt, idx: m.index + m[0].length });
      }
    };
    scanLast('pptx', /(?:\.?pptx|\.?ppt|피피티|파워포인트|슬라이드|발표자료)/gi);
    scanLast('pdf', /(?:\.?pdf|피디에프)/gi);
    scanLast('docx', /(?:\.?docx|워드|\bword\b)/gi);
    scanLast('hwpx', /(?:\.?hwpx|\.?hwp|한컴\s*한글|아래아\s*한글)/gi);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.idx - a.idx);
      return candidates[0].format;
    }
  }

  return null;
}

function determineTargetFormat(
  workspaceId: WorkspaceId,
  subTrackId: string | undefined,
  promptText: string
): ExportFormat {
  const explicit = detectExplicitTargetFormat(promptText);
  if (explicit) return explicit;

  if (workspaceId === 'ppt-maker') {
    return 'pptx';
  }
  if (workspaceId === 'doc-maker') {
    if (subTrackId === 'pdf') return 'pdf';
    if (subTrackId === 'docx') return 'docx';
    return 'hwpx';
  }
  return 'hwpx';
}

function isDirectConversionRequest(
  promptText: string,
  hasAttachments: boolean,
  hasPriorContext: boolean
): boolean {
  const target = detectExplicitTargetFormat(promptText);
  if (!target) return false;
  const hasConversionVerb =
    /(전환|변환|바꿔|바꾸|변경|내보내|만들|제작|작성|생성|convert|export|turn\s+into)/i.test(
      promptText
    );
  if (!hasConversionVerb) return false;
  if (hasAttachments || hasPriorContext) return true;
  return /(으?로\s*(?:전환|변환|바꿔|바꾸|만들|제작)|(?:전환|변환|바꿔)\s*해)/i.test(promptText);
}

function isCasualMakerGreeting(
  promptText: string,
  hasAttachments: boolean,
  hasExistingArtifact: boolean
): boolean {
  if (hasAttachments || hasExistingArtifact) return false;
  const trimmed = promptText.trim();
  if (!trimmed) return true;
  if (/^(안녕|안녕하|하이|헬로|ㅎㅇ|반가|반갑|뭐\s*할|뭐해|사용법|도움말|어떻게\s*쓰)[!.?~\s가-힣]*$/i.test(trimmed) && trimmed.length <= 20) {
    return true;
  }
  return false;
}

const FORMAT_BUILD_LABELS: Record<ExportFormat, string> = {
  hwpx: '한글(.hwpx) 문서를 작성하고 있습니다...',
  pdf: '인쇄용 PDF 노트를 작성하고 있습니다...',
  docx: '워드(.docx) 문서를 작성하고 있습니다...',
  pptx: 'PPT 슬라이드와 발표 대본을 제작하고 있습니다...',
};

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [fontSize, setFontSize] = useState<FontSizePreset>(() => loadStoredFontSize());
  const [answerFont, setAnswerFont] = useState<AnswerFontPreset>(() => loadStoredAnswerFont());

  const [currentProfile, setCurrentProfile] = useState<StudentProfile>(() => loadGuestProfile());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<string | null>(null);
  const [cloudSyncRetryTick, setCloudSyncRetryTick] = useState(0);
  const pendingGuestMigrationRef = useRef(false);
  const currentGradeRef = useRef<GradeLevel>(currentProfile.gradeLevel);

  const initialSessions = loadSessionsForProfile(currentProfile.id);
  const initialActiveId = loadActiveSessionId(currentProfile.id);
  const restoredSession = initialActiveId
    ? initialSessions.find((s) => s.id === initialActiveId && s.messages.length > 0)
    : undefined;

  const [activeView, setActiveView] = useState<'lobby' | 'workspace'>('lobby');
  const [sessions, setSessions] = useState<NotebookSession[]>(initialSessions);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<WorkspaceId>(
    restoredSession ? restoredSession.workspaceId : 'korean'
  );
  const [activeSession, setActiveSession] = useState<NotebookSession>(
    () => restoredSession || createEmptySession('korean', currentProfile.gradeLevel, 'fast')
  );

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(() =>
    loadPromptsForProfile(currentProfile.id)
  );
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() =>
    loadSearchHistoryForProfile(currentProfile.id)
  );
  const [savedStudyNotes, setSavedStudyNotes] = useState<SavedStudyNote[]>(() =>
    loadStudyNotesForProfile(currentProfile.id)
  );

  const [connectCareer, setConnectCareer] = useState(true);
  const [inlineCareerDraft, setInlineCareerDraft] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [savedNoteIds, setSavedNoteIds] = useState<Record<string, boolean>>({});
  const [promptSavedNotice, setPromptSavedNotice] = useState(false);

  const [studioCollapsed, setStudioCollapsed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [failedRetryMap, setFailedRetryMap] = useState<
    Record<string, { prompt: string; attachments?: AttachmentPayload[] }>
  >({});
  const [sentAttachmentMap, setSentAttachmentMap] = useState<Record<string, AttachmentPayload[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceAutoRead, setVoiceAutoRead] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isExtractingFiles, setIsExtractingFiles] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [promptsModalOpen, setPromptsModalOpen] = useState(false);
  const [studyNotesModalOpen, setStudyNotesModalOpen] = useState(false);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [pptDensity, setPptDensity] = useState<PptDensity>('balanced');
  const [pptDesignStyle, setPptDesignStyle] = useState<PptDesignStyle>('auto');
  const [pptThemePref, setPptThemePref] = useState<PptThemeId | 'auto'>('auto');
  const [generatingArtifactMap, setGeneratingArtifactMap] = useState<
    Record<string, ExportFormat>
  >({});

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerFileRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const sendingRef = useRef(false);
  const activeSessionRef = useRef<NotebookSession>(activeSession);
  activeSessionRef.current = activeSession;

  const workspace = WORKSPACE_MAP[activeWorkspaceId];
  const workspaceIndex = WORKSPACES.findIndex((w) => w.id === activeWorkspaceId) + 1;
  const isSplitStudio =
    activeWorkspaceId === 'doc-summary' || activeWorkspaceId === 'photo-analysis';
  const isSearchStudio = activeWorkspaceId === 'resource-search';
  const isFreeChat = activeWorkspaceId === 'free-chat';
  const isDocMaker = activeWorkspaceId === 'doc-maker';
  const isPptMaker = activeWorkspaceId === 'ppt-maker';
  const isMakerWorkspace = isDocMaker || isPptMaker;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    const sizeOpt = getFontSizeOption(fontSize);
    const fontOpt = getAnswerFontOption(answerFont);
    const scaledAnswerPx = Math.round(sizeOpt.answerPx * fontOpt.scaleMultiplier * 10) / 10;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--study-answer-font', fontOpt.cssFamily);
    rootStyle.setProperty('--study-answer-size', `${scaledAnswerPx}px`);
    rootStyle.setProperty('--study-chat-size', `${sizeOpt.chatPx}px`);
    rootStyle.setProperty('--study-answer-line-height', fontOpt.lineHeight);
    try {
      localStorage.setItem(STORAGE_FONT_SIZE_KEY, fontSize);
      localStorage.setItem(STORAGE_ANSWER_FONT_KEY, answerFont);
    } catch {
      // ignore
    }
  }, [fontSize, answerFont]);

  useEffect(() => {
    currentGradeRef.current = currentProfile.gradeLevel;
    try {
      if (currentProfile.isGuest) {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(currentProfile));
      }
    } catch {
      // ignore
    }
  }, [currentProfile]);

  const handleCloudError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err ?? '');
    if (raw.includes('Quota exceeded')) {
      setCloudSyncNotice(
        '무료 데이터베이스 일일 사용 한도를 초과했습니다. 현재 화면에서 학습을 계속할 수 있으며, 한도는 내일 초기화됩니다.'
      );
      return;
    }
    if (raw.includes('Missing or insufficient permissions') || raw.includes('permission-denied')) {
      setCloudSyncNotice(
        '클라우드 동기화 권한 확인 중 문제가 발생했습니다. 다시 시도하거나 로그아웃 후 게스트로 계속 이용할 수 있습니다.'
      );
      return;
    }
    if (raw.includes('offline') || raw.includes('unavailable') || raw.includes('network')) {
      setCloudSyncNotice(
        '네트워크 연결이 불안정하여 클라우드 동기화를 일시 대기 중입니다. 연결 후 다시 시도해 주세요.'
      );
      return;
    }
    setCloudSyncNotice(
      '클라우드 동기화 중 일시적인 문제가 발생했습니다. 다시 시도하거나 로그아웃 후 이용해 주세요.'
    );
  };

  useEffect(() => {
    testConnection();
    let unsubscribeCloud: (() => void) | null = null;
    let isCancelled = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeCloud) {
        unsubscribeCloud();
        unsubscribeCloud = null;
      }

      if (!user) {
        clearKnownCloudIds();
        const guest = loadGuestProfile();
        if (isCancelled) return;
        setCloudSyncNotice(null);
        setCurrentProfile(guest);
        setSessions(loadSessionsForProfile('guest'));
        setSavedPrompts(loadPromptsForProfile('guest'));
        setSearchHistory(loadSearchHistoryForProfile('guest'));
        setSavedStudyNotes(loadStudyNotesForProfile('guest'));
        return;
      }

      const fallbackProfile: StudentProfile = {
        id: user.uid,
        name:
          user.displayName?.trim() ||
          user.email?.split('@')[0] ||
          'Google 학습자',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        authProvider: 'google',
        gradeLevel: currentGradeRef.current,
        isGuest: false,
        createdAt: Date.now(),
      };

      setCloudSyncNotice(null);

      try {
        const prefs = await ensureUserProfileDoc(user, currentGradeRef.current);
        if (isCancelled) return;

        if (pendingGuestMigrationRef.current) {
          pendingGuestMigrationRef.current = false;
          const guestProfile = loadGuestProfile();
          await migrateGuestDataToCloud(user.uid, {
            sessions: loadSessionsForProfile('guest'),
            prompts: loadPromptsForProfile('guest'),
            studyNotes: loadStudyNotesForProfile('guest'),
            searchHistory: loadSearchHistoryForProfile('guest'),
            careerGoal: guestProfile.careerGoal,
            gradeLevel: guestProfile.gradeLevel,
          });
        }

        if (isCancelled) return;

        const googleProfile: StudentProfile = {
          id: user.uid,
          name: prefs.displayName,
          email: prefs.email,
          photoURL: prefs.photoURL,
          authProvider: 'google',
          gradeLevel: prefs.gradeLevel,
          careerGoal: prefs.careerGoal,
          careerPromptDismissed: prefs.careerPromptDismissed,
          isGuest: false,
          createdAt: Date.now(),
        };

        setCurrentProfile(googleProfile);
        setConnectCareer(prefs.connectCareer ?? true);
        setActiveSession((prev) =>
          prev.messages.length === 0
            ? {
                ...prev,
                gradeLevel: prefs.gradeLevel,
                subTrackId: getDefaultSubTrack(prev.workspaceId, prefs.gradeLevel),
              }
            : prev
        );

        unsubscribeCloud = subscribeUserStudyData(
          user.uid,
          {
            onProfilePrefs: (cloudPrefs) => {
              setCurrentProfile((prev) =>
                prev.id === user.uid
                  ? {
                      ...prev,
                      name: cloudPrefs.displayName || prev.name,
                      email: cloudPrefs.email || prev.email,
                      photoURL: cloudPrefs.photoURL || prev.photoURL,
                      gradeLevel: cloudPrefs.gradeLevel || prev.gradeLevel,
                      careerGoal: cloudPrefs.careerGoal,
                      careerPromptDismissed: cloudPrefs.careerPromptDismissed,
                    }
                  : prev
              );
              if (typeof cloudPrefs.connectCareer === 'boolean') {
                setConnectCareer(cloudPrefs.connectCareer);
              }
            },
            onSessions: (cloudSessions) => setSessions(cloudSessions),
            onPrompts: (cloudPrompts) => setSavedPrompts(cloudPrompts),
            onStudyNotes: (cloudNotes) => setSavedStudyNotes(cloudNotes),
            onSearchHistory: (cloudSearches) => setSearchHistory(cloudSearches),
          },
          (err) => {
            handleCloudError(err);
          }
        );
      } catch (err) {
        if (isCancelled) return;
        pendingGuestMigrationRef.current = false;
        setCurrentProfile(fallbackProfile);
        handleCloudError(err);
      }
    });

    return () => {
      isCancelled = true;
      if (unsubscribeCloud) unsubscribeCloud();
      unsubscribeAuth();
    };
  }, [cloudSyncRetryTick]);

  useEffect(() => {
    if (currentProfile.isGuest) {
      saveSessionsForProfile('guest', sessions);
    }
  }, [sessions, currentProfile.isGuest]);

  useEffect(() => {
    saveActiveSessionId(
      currentProfile.id,
      activeSession.messages.length > 0 ? activeSession.id : null
    );
  }, [activeSession.id, activeSession.messages.length, currentProfile.id]);

  useEffect(() => {
    if (currentProfile.isGuest) {
      savePromptsForProfile('guest', savedPrompts);
    }
  }, [savedPrompts, currentProfile.isGuest]);

  useEffect(() => {
    if (currentProfile.isGuest) {
      saveSearchHistoryForProfile('guest', searchHistory);
    }
  }, [searchHistory, currentProfile.isGuest]);

  useEffect(() => {
    if (currentProfile.isGuest) {
      saveStudyNotesForProfile('guest', savedStudyNotes);
    }
  }, [savedStudyNotes, currentProfile.isGuest]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isStreaming ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [activeSession.messages, isStreaming]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      const clipboardFiles = e.clipboardData?.files ? Array.from(e.clipboardData.files) : [];
      if (!items && clipboardFiles.length === 0) return;

      const imageFiles = items
        ? Array.from(items)
            .filter((item) => item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file))
        : [];

      const docFiles = clipboardFiles.filter((file) => !file.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        const stamp = new Date()
          .toLocaleTimeString('ko-KR', { hour12: false })
          .replace(/:/g, '');
        Promise.all(
          imageFiles.map((file, idx) =>
            fileToOptimizedImageAttachment(
              file,
              `붙여넣은_이미지_${stamp}${imageFiles.length > 1 ? `_${idx + 1}` : ''}.jpg`
            ).catch(() => null)
          )
        ).then((results) => {
          const added = results.filter((item): item is AttachmentPayload => Boolean(item));
          if (added.length > 0) {
            setAttachments((prev) => [...prev, ...added]);
            setStudioCollapsed(false);
          }
        });
      }

      if (docFiles.length > 0) {
        Promise.all(docFiles.map((f) => extractAttachmentsFromFile(f))).then((results) => {
          const added = results.flatMap((r) => r.attachments);
          const firstErr = results.find((r) => r.error)?.error;
          if (added.length > 0) {
            setAttachments((prev) => [...prev, ...added]);
            setStudioCollapsed(false);
          }
          if (firstErr) {
            setVoiceNotice(firstErr);
          }
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const updateCurrentProfile = (patch: Partial<StudentProfile>) => {
    setCurrentProfile((prev) => {
      const updated = { ...prev, ...patch };
      if (!updated.isGuest) {
        void updateUserStudyPrefs(updated.id, {
          ...(patch.gradeLevel !== undefined ? { gradeLevel: patch.gradeLevel } : {}),
          ...(patch.careerGoal !== undefined ? { careerGoal: patch.careerGoal || '' } : {}),
          ...(patch.careerPromptDismissed !== undefined
            ? { careerPromptDismissed: patch.careerPromptDismissed }
            : {}),
        }).catch(handleCloudError);
      }
      return updated;
    });
  };

  const handleToggleConnectCareer = () => {
    setConnectCareer((prev) => {
      const next = !prev;
      if (!currentProfile.isGuest) {
        void updateUserStudyPrefs(currentProfile.id, { connectCareer: next }).catch(
          handleCloudError
        );
      }
      return next;
    });
  };

  const handleSaveCareerGoal = (goal: string) => {
    updateCurrentProfile({
      careerGoal: goal || undefined,
      careerPromptDismissed: true,
    });
    if (goal) {
      setConnectCareer(true);
      if (!currentProfile.isGuest) {
        void updateUserStudyPrefs(currentProfile.id, { connectCareer: true }).catch(
          handleCloudError
        );
      }
    }
  };

  const handleCopyNote = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedNoteId(msgId);
    setTimeout(() => setCopiedNoteId(null), 1600);
  };

  const handleSaveStudyNote = (msg: ChatMessage) => {
    const subTrackLabel = workspace.subTracks?.find(
      (t) => t.id === activeSession.subTrackId
    )?.label;
    const item: SavedStudyNote = {
      id: createId('studynote'),
      workspaceId: activeWorkspaceId,
      subTrackLabel,
      gradeLevel: activeSession.gradeLevel,
      title: activeSession.title,
      content: msg.content,
      mastered: false,
      createdAt: Date.now(),
    };
    setSavedStudyNotes((prev) => [item, ...prev]);
    setSavedNoteIds((prev) => ({ ...prev, [msg.id]: true }));
    if (!currentProfile.isGuest) {
      void saveStudyNoteToCloud(currentProfile.id, item).catch(handleCloudError);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const handleSpeakResponse = (msgId: string, content: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingMsgId === msgId) {
      stopSpeaking();
      return;
    }
    window.speechSynthesis.cancel();
    const cleaned = content
      .replace(/\[\[SWITCH:[a-z-]+\]\]/g, '')
      .replace(/```[\s\S]*?```/g, ' 코드 블록. ')
      .replace(/[#*`>$_[\]()|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);
    if (!cleaned) return;
    const utter = new SpeechSynthesisUtterance(cleaned);
    if (activeWorkspaceId === 'english' || activeSession.subTrackId === 'english-talk') {
      utter.lang = 'en-US';
    } else if (activeSession.subTrackId === 'japanese') {
      utter.lang = 'ja-JP';
    } else if (activeSession.subTrackId === 'chinese') {
      utter.lang = 'zh-CN';
    } else {
      utter.lang = 'ko-KR';
    }
    utter.rate = 0.98;
    utter.onend = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
    utter.onerror = () => setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utter);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setVoiceNotice(null);
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((ev: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNotice('현재 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 이용해 주세요.');
      return;
    }
    try {
      const rec = new Recognition();
      rec.lang =
        activeWorkspaceId === 'english' || activeSession.subTrackId === 'english-talk'
          ? 'en-US'
          : activeSession.subTrackId === 'japanese'
            ? 'ja-JP'
            : activeSession.subTrackId === 'chinese'
              ? 'zh-CN'
              : 'ko-KR';
      rec.interimResults = true;
      rec.continuous = false;
      const baseText = inputText.trim() ? `${inputText.trim()} ` : '';
      rec.onresult = (ev) => {
        let spoken = '';
        for (let i = 0; i < ev.results.length; i++) {
          spoken += ev.results[i]?.[0]?.transcript || '';
        }
        setInputText(baseText + spoken);
      };
      rec.onerror = (ev) => {
        setIsListening(false);
        if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
          setVoiceNotice('마이크 권한이 차단되어 있습니다. 브라우저 주소창에서 마이크 권한을 허용해 주세요.');
        } else if (ev?.error !== 'aborted' && ev?.error !== 'no-speech') {
          setVoiceNotice('음성을 인식하지 못했습니다. 다시 한 번 말씀해 주세요.');
        }
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      setVoiceNotice('마이크를 시작할 수 없습니다. 권한을 확인해 주세요.');
    }
  };

  const handleAddPrompt = (
    title: string,
    content: string,
    workspaceId: WorkspaceId | 'all'
  ) => {
    const item: SavedPrompt = {
      id: createId('prompt'),
      title,
      content,
      workspaceId,
      createdAt: Date.now(),
    };
    setSavedPrompts((prev) => [item, ...prev]);
    setPromptSavedNotice(true);
    setTimeout(() => setPromptSavedNotice(false), 1800);
    if (!currentProfile.isGuest) {
      void savePromptToCloud(currentProfile.id, item).catch(handleCloudError);
    }
  };

  const handleSaveCurrentInputAsPrompt = () => {
    const text = inputText.trim();
    if (!text) return;
    const title = text.slice(0, 26) + (text.length > 26 ? '...' : '');
    handleAddPrompt(title, text, activeWorkspaceId);
  };

  const upsertSession = (updated: NotebookSession) => {
    setActiveSession(updated);
    if (updated.messages.length === 0) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
    if (!currentProfile.isGuest) {
      void saveSessionToCloud(currentProfile.id, updated).catch(handleCloudError);
    }
  };

  const stopVoiceAndSpeech = () => {
    stopSpeaking();
    recognitionRef.current?.stop();
    setIsListening(false);
    setVoiceNotice(null);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSelectWorkspace = (
    id: WorkspaceId,
    preserveInput = false,
    studyModeOverride?: StudyMode
  ) => {
    if (isStreaming) return;
    stopVoiceAndSpeech();
    setActiveView('workspace');
    setActiveWorkspaceId(id);
    setAttachments([]);
    setStudioCollapsed(false);
    if (!preserveInput) setInputText('');
    setActiveSession(
      createEmptySession(
        id,
        activeSession.gradeLevel,
        studyModeOverride ?? activeSession.studyMode,
        activeSession.thinkingDepth || 'standard'
      )
    );
  };

  const handleOpenMakerWorkspace = (
    id: 'doc-maker' | 'ppt-maker',
    subTrackId: string
  ) => {
    if (isStreaming) return;
    stopVoiceAndSpeech();
    setActiveView('workspace');
    setActiveWorkspaceId(id);
    setAttachments([]);
    setStudioCollapsed(false);
    setInputText('');
    const base = createEmptySession(
      id,
      activeSession.gradeLevel,
      activeSession.studyMode,
      activeSession.thinkingDepth || 'standard'
    );
    setActiveSession({
      ...base,
      subTrackId,
    });
  };

  const handleNewNote = () => {
    if (isStreaming) return;
    stopVoiceAndSpeech();
    setActiveView('workspace');
    setAttachments([]);
    setStudioCollapsed(false);
    setInputText('');
    setActiveSession(
      createEmptySession(
        activeWorkspaceId,
        activeSession.gradeLevel,
        activeSession.studyMode,
        activeSession.thinkingDepth || 'standard'
      )
    );
  };

  const handleSelectSession = (session: NotebookSession) => {
    if (isStreaming) return;
    stopVoiceAndSpeech();
    setActiveView('workspace');
    setActiveWorkspaceId(session.workspaceId);
    setActiveSession(session);
    setAttachments([]);
    setStudioCollapsed(session.messages.length > 0);
    setInputText('');
  };

  const handleTogglePinSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    const nextPinned = !target?.pinned;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
    );
    if (activeSession.id === sessionId) {
      setActiveSession((prev) => ({ ...prev, pinned: !prev.pinned }));
    }
    if (!currentProfile.isGuest) {
      void toggleSessionPinInCloud(currentProfile.id, sessionId, nextPinned).catch(
        handleCloudError
      );
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSession.id === sessionId) {
      handleNewNote();
    }
    if (!currentProfile.isGuest) {
      void deleteSessionFromCloud(currentProfile.id, sessionId).catch(handleCloudError);
    }
  };

  const handleComposerFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setVoiceNotice(null);
    setIsExtractingFiles(true);
    const added: AttachmentPayload[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        const res = await extractAttachmentsFromFile(file);
        if (res.attachments.length > 0) {
          added.push(...res.attachments);
        }
        if (res.error) {
          errors.push(res.error);
        }
      }
      if (added.length > 0) {
        setAttachments((prev) => [...prev, ...added]);
      }
      if (errors.length > 0) {
        setVoiceNotice(errors[0]);
      }
    } finally {
      setIsExtractingFiles(false);
    }
  };

  const requestGeneratedArtifact = async (params: {
    format: ExportFormat;
    templateKind?: 'study-note' | 'report' | 'presentation';
    topic: string;
    sourceText?: string;
    workspaceId: WorkspaceId;
    subTrackId?: string;
    gradeLevel: GradeLevel;
    thinkingDepth: ThinkingDepth;
    careerGoal?: string;
    studentName: string;
    memoryContext?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    attachments?: AttachmentPayload[];
    existingArtifact?: GeneratedDocumentPayload;
    pptDensity?: PptDensity;
    pptDesignStyle?: PptDesignStyle;
    pptThemeId?: PptThemeId;
  }): Promise<{ assistantSummary: string; document: GeneratedDocumentPayload }> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 110000);
    try {
      const resolvedThemeId =
        params.pptThemeId ?? (pptThemePref !== 'auto' ? pptThemePref : undefined);
      const response = await fetch('/api/ai/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          format: params.format,
          templateKind:
            params.templateKind ||
            (params.format === 'pptx'
              ? 'presentation'
              : params.subTrackId === 'report'
                ? 'report'
                : 'study-note'),
          topic: params.topic,
          sourceText: params.sourceText || '',
          workspaceId: params.workspaceId,
          subTrackId: params.subTrackId,
          gradeLevel: params.gradeLevel,
          thinkingDepth: params.thinkingDepth,
          careerGoal: params.careerGoal,
          studentName: params.studentName,
          memoryContext: params.memoryContext,
          history: params.history,
          attachments:
            params.attachments && params.attachments.length > 0
              ? params.attachments.map((a) => ({
                  name: a.name,
                  mimeType: a.mimeType,
                  dataBase64: a.dataBase64,
                  textContent: a.textContent,
                }))
              : undefined,
          existingArtifact: params.existingArtifact,
          ...(params.format === 'pptx'
            ? {
                pptDensity: params.pptDensity ?? pptDensity,
                pptDesignStyle: params.pptDesignStyle ?? pptDesignStyle,
                pptThemeId: resolvedThemeId,
              }
            : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        assistantSummary?: string;
        document?: GeneratedDocumentPayload;
        error?: string;
      };
      if (!response.ok || !data.document) {
        throw new Error(data.error || `문서/PPT 제작 중 오류가 발생했습니다. (${response.status})`);
      }
      return {
        assistantSummary:
          data.assistantSummary ||
          '요청하신 자료를 완성했습니다. 아래 미리보기에서 확인하고 파일로 저장하거나 수정할 내용을 이어서 말씀해 주세요.',
        document: data.document,
      };
    } finally {
      window.clearTimeout(timer);
    }
  };

  const patchAssistantMessageArtifact = (
    sessionSnapshot: NotebookSession,
    msgId: string,
    patch: Partial<ChatMessage>
  ): NotebookSession => {
    const base =
      activeSessionRef.current.id === sessionSnapshot.id &&
      activeSessionRef.current.messages.length >= sessionSnapshot.messages.length
        ? activeSessionRef.current
        : sessionSnapshot;
    const updated: NotebookSession = {
      ...base,
      messages: base.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
      updatedAt: Date.now(),
    };
    upsertSession(updated);
    return updated;
  };

  const handleGenerateArtifactForMessage = async (
    msgId: string,
    format: ExportFormat,
    customTitle?: string,
    overrideSourceText?: string
  ) => {
    const snapshot = activeSessionRef.current;
    const targetMsg = snapshot.messages.find((m) => m.id === msgId);
    if (!targetMsg || generatingArtifactMap[msgId]) return;

    const cleanMsgText = parseAssistantDirectives(targetMsg.content).cleanContent;
    const sourceText = (overrideSourceText ?? cleanMsgText).trim();
    if (!sourceText && !targetMsg.generatedDocument) return;

    const derivedTopic =
      customTitle?.trim() ||
      snapshot.title.replace(/\s*새 노트$/, '').trim() ||
      WORKSPACE_MAP[snapshot.workspaceId].name;

    const targetIdx = snapshot.messages.findIndex((m) => m.id === msgId);
    let precedingAttachments: AttachmentPayload[] | undefined;
    for (let i = targetIdx - 1; i >= 0; i--) {
      const m = snapshot.messages[i];
      if (m.role === 'user' && sentAttachmentMap[m.id]?.length) {
        precedingAttachments = sentAttachmentMap[m.id];
        break;
      }
    }

    setGeneratingArtifactMap((prev) => ({ ...prev, [msgId]: format }));
    try {
      const result = await requestGeneratedArtifact({
        format,
        topic: derivedTopic,
        sourceText,
        workspaceId: snapshot.workspaceId,
        subTrackId: snapshot.subTrackId,
        gradeLevel: snapshot.gradeLevel,
        thinkingDepth: snapshot.thinkingDepth || 'standard',
        careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
        studentName: currentProfile.name,
        attachments: precedingAttachments,
        existingArtifact: targetMsg.generatedDocument,
      });
      patchAssistantMessageArtifact(snapshot, msgId, {
        generatedDocument: result.document,
        requestedFormat: format,
      });
    } catch (err) {
      const msgText =
        err instanceof Error ? err.message : '문서·PPT 생성 중 오류가 발생했습니다.';
      setVoiceNotice(msgText);
    } finally {
      setGeneratingArtifactMap((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    }
  };

  const handleConvertArtifactFromMessage = async (
    msgId: string,
    targetFormat: ExportFormat
  ) => {
    if (isStreaming || sendingRef.current) return;
    const snapshot = activeSessionRef.current;
    const targetIdx = snapshot.messages.findIndex((m) => m.id === msgId);
    const targetMsg = targetIdx >= 0 ? snapshot.messages[targetIdx] : undefined;
    if (!targetMsg || !targetMsg.generatedDocument) return;

    const cleanMsgText = parseAssistantDirectives(targetMsg.content).cleanContent;
    let precedingAttachments: AttachmentPayload[] | undefined;
    for (let i = targetIdx - 1; i >= 0; i--) {
      const m = snapshot.messages[i];
      if (m.role === 'user' && sentAttachmentMap[m.id]?.length) {
        precedingAttachments = sentAttachmentMap[m.id];
        break;
      }
    }

    const formatNames: Record<ExportFormat, string> = {
      pdf: 'PDF(.pdf) 문서',
      hwpx: '한글(.hwpx) 문서',
      docx: 'MS Word(.docx) 문서',
      pptx: 'PPT(.pptx) 발표자료',
    };

    const newAssistantId = createId('msg');
    const newAssistantMsg: ChatMessage = {
      id: newAssistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    const updatedSnapshot: NotebookSession = {
      ...snapshot,
      messages: [...snapshot.messages, newAssistantMsg],
      updatedAt: Date.now(),
    };
    upsertSession(updatedSnapshot);
    setGeneratingArtifactMap((prev) => ({ ...prev, [newAssistantId]: targetFormat }));

    try {
      const result = await requestGeneratedArtifact({
        format: targetFormat,
        templateKind:
          targetFormat === 'pptx'
            ? 'presentation'
            : snapshot.subTrackId === 'report'
              ? 'report'
              : 'study-note',
        topic: `기존 자료("${targetMsg.generatedDocument.title}")를 ${formatNames[targetFormat]} 형식으로 빠짐없이 전환해 주세요.`,
        sourceText: cleanMsgText,
        workspaceId: snapshot.workspaceId,
        subTrackId: snapshot.subTrackId,
        gradeLevel: snapshot.gradeLevel,
        thinkingDepth: snapshot.thinkingDepth || 'standard',
        careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
        studentName: currentProfile.name,
        attachments: precedingAttachments,
        existingArtifact: targetMsg.generatedDocument,
      });
      patchAssistantMessageArtifact(updatedSnapshot, newAssistantId, {
        content: result.assistantSummary,
        generatedDocument: result.document,
        requestedFormat: targetFormat,
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : '파일 형식 전환 중 오류가 발생했습니다.';
      patchAssistantMessageArtifact(updatedSnapshot, newAssistantId, {
        content: errMsg,
        error: true,
      });
    } finally {
      setGeneratingArtifactMap((prev) => {
        const next = { ...prev };
        delete next[newAssistantId];
        return next;
      });
    }
  };

  const handleConvertAttachmentsWithPrompt = (
    targetFormat: ExportFormat,
    overrideAttachments?: AttachmentPayload[]
  ) => {
    const formatNames: Record<ExportFormat, string> = {
      pdf: 'PDF(.pdf) 문서',
      hwpx: '한글(.hwpx) 문서',
      docx: 'MS Word(.docx) 문서',
      pptx: 'PPT(.pptx) 발표자료',
    };
    void sendMessage(
      `첨부한 자료의 전체 내용을 빠짐없이 보존하여 ${formatNames[targetFormat]} 형식으로 AI 전환·재구성해 주세요.`,
      overrideAttachments
    );
  };

  const handleConvertConversationToArtifact = async (format: 'hwpx' | 'pptx') => {
    if (isStreaming) return;
    const snapshot = activeSessionRef.current;
    const lastAssistant = [...snapshot.messages]
      .reverse()
      .find((m) => m.role === 'assistant' && !m.error && m.content.trim());
    if (!lastAssistant) return;

    const conversationSource = snapshot.messages
      .filter((m) => !m.error && m.content.trim())
      .map(
        (m) =>
          `${m.role === 'user' ? '학생 질문' : 'AI 정리'}: ${
            m.role === 'assistant'
              ? parseAssistantDirectives(m.content).cleanContent
              : m.content
          }`
      )
      .join('\n\n')
      .slice(-14000);

    const hasDifferentExistingArtifact =
      lastAssistant.generatedDocument &&
      ((format === 'pptx' && lastAssistant.generatedDocument.kind !== 'presentation') ||
        (format !== 'pptx' && lastAssistant.generatedDocument.kind === 'presentation'));

    if (!hasDifferentExistingArtifact) {
      await handleGenerateArtifactForMessage(
        lastAssistant.id,
        format,
        snapshot.title,
        conversationSource
      );
      return;
    }

    const newAssistantId = createId('msg');
    const newAssistantMsg: ChatMessage = {
      id: newAssistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    const updatedSnapshot: NotebookSession = {
      ...snapshot,
      messages: [...snapshot.messages, newAssistantMsg],
      updatedAt: Date.now(),
    };
    upsertSession(updatedSnapshot);
    setGeneratingArtifactMap((prev) => ({ ...prev, [newAssistantId]: format }));

    try {
      const result = await requestGeneratedArtifact({
        format,
        topic: `${snapshot.title} (${format === 'pptx' ? '발표자료' : '문서'})`,
        sourceText: conversationSource,
        workspaceId: snapshot.workspaceId,
        subTrackId: snapshot.subTrackId,
        gradeLevel: snapshot.gradeLevel,
        thinkingDepth: snapshot.thinkingDepth || 'standard',
        careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
        studentName: currentProfile.name,
      });
      patchAssistantMessageArtifact(updatedSnapshot, newAssistantId, {
        content: result.assistantSummary,
        generatedDocument: result.document,
        requestedFormat: format,
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : '문서·PPT 생성 중 오류가 발생했습니다.';
      patchAssistantMessageArtifact(updatedSnapshot, newAssistantId, {
        content: errMsg,
        error: true,
      });
    } finally {
      setGeneratingArtifactMap((prev) => {
        const next = { ...prev };
        delete next[newAssistantId];
        return next;
      });
    }
  };

  const sendMessage = async (
    customPrompt?: string,
    overrideAttachments?: AttachmentPayload[],
    retryAssistantId?: string,
    options?: { verifyMode?: boolean }
  ) => {
    if (isStreaming || sendingRef.current) return;
    const promptToSend = (customPrompt ?? inputText).trim();
    const activeAtts = overrideAttachments ?? (retryAssistantId ? [] : attachments);

    if (!promptToSend && activeAtts.length === 0) return;
    sendingRef.current = true;

    const hasDoc = activeAtts.some(
      (a) => a.mimeType === 'application/pdf' || Boolean(a.textContent)
    );
    const displayPrompt =
      promptToSend ||
      (isSearchStudio
        ? '첨부한 자료의 주제와 관련된 신뢰할 수 있는 학습 사이트와 공부 앱을 검색해 정리해 주세요.'
        : isPptMaker
          ? '첨부한 자료를 바탕으로 핵심 발표 슬라이드와 발표 대본(.pptx)을 제작해 주세요.'
          : isDocMaker
            ? '첨부한 자료를 바탕으로 깔끔하게 정리된 학습·보고서 문서를 작성해 주세요.'
            : activeSession.studyMode === 'solve-only'
              ? hasDoc
                ? '첨부한 자료를 바탕으로 문제와 단계별 풀이 과정만 출력해 주세요.'
                : activeAtts.length > 1
                  ? `첨부한 사진 ${activeAtts.length}장 속 문제들의 풀이 과정과 정답만 간결하게 출력해 주세요.`
                  : '첨부한 사진 속 문제의 풀이 과정과 정답만 간결하게 출력해 주세요.'
              : activeSession.studyMode === 'performance'
                ? hasDoc
                  ? '첨부한 수행평가 안내문·자료의 채점 기준과 필수 조건을 체크리스트로 정리하고, 주제·개요·개선 포인트를 안내해 주세요.'
                  : '첨부한 수행평가 안내문·루브릭·초안 사진을 모두 읽고 필수 조건 체크리스트, 감점 주의사항, 작성/수정 가이드를 정리해 주세요.'
                : hasDoc
                  ? activeAtts.length > 1
                    ? `첨부한 자료 ${activeAtts.length}건을 핵심 노트로 요약하고 출제 포인트를 정리해 주세요.`
                    : '첨부한 문서·자료의 핵심 내용을 구조화된 노트로 정리해 주세요.'
                  : activeAtts.length > 1
                    ? `첨부한 사진 ${activeAtts.length}장을 모두 분석하고 단계별로 설명해 주세요.`
                    : '첨부한 사진을 분석하고 풀이해 주세요.');

    const attachmentsMeta = activeAtts.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      previewUrl: a.previewUrl,
      textSnippet: a.textContent?.slice(0, 140),
    }));

    const assistantMessageId = retryAssistantId || createId('msg');
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    const baseMessages = activeSession.messages;
    let workingSession: NotebookSession;
    let historyPayload: Array<{ role: 'user' | 'assistant'; content: string }>;

    if (retryAssistantId) {
      setFailedRetryMap((prev) => {
        const next = { ...prev };
        delete next[retryAssistantId];
        return next;
      });
      const failIdx = baseMessages.findIndex((m) => m.id === retryAssistantId);
      const historyBeforeRetry =
        failIdx > 0 ? baseMessages.slice(0, failIdx - 1) : baseMessages.slice(0, -1);
      const userMsgToKeep =
        failIdx > 0 && baseMessages[failIdx - 1]?.role === 'user'
          ? baseMessages[failIdx - 1]
          : {
              id: createId('msg'),
              role: 'user' as const,
              content: displayPrompt,
              createdAt: Date.now(),
              attachments: attachmentsMeta.length > 0 ? attachmentsMeta : undefined,
            };

      historyPayload = historyBeforeRetry
        .filter((m) => !m.error && m.content.trim())
        .slice(-16)
        .map((m) => {
          const attNames = m.attachments?.map((a) => a.name).filter(Boolean) || [];
          return {
            role: m.role,
            content:
              attNames.length > 0
                ? `${m.content}\n[첨부했던 자료: ${attNames.join(', ')}]`
                : m.content,
          };
        });

      workingSession = {
        ...activeSession,
        messages: [...historyBeforeRetry, userMsgToKeep, assistantPlaceholder],
        updatedAt: Date.now(),
      };
    } else {
      const userMessage: ChatMessage = {
        id: createId('msg'),
        role: 'user',
        content: displayPrompt,
        createdAt: Date.now(),
        attachments: attachmentsMeta.length > 0 ? attachmentsMeta : undefined,
      };

      if (activeAtts.length > 0) {
        setSentAttachmentMap((prev) => ({ ...prev, [userMessage.id]: activeAtts }));
      }

      const derivedTitle =
        activeSession.messages.length === 0
          ? displayPrompt.slice(0, 28) + (displayPrompt.length > 28 ? '...' : '')
          : activeSession.title;

      historyPayload = activeSession.messages
        .filter((m) => !m.error && m.content.trim())
        .slice(-16)
        .map((m) => {
          const attNames = m.attachments?.map((a) => a.name).filter(Boolean) || [];
          return {
            role: m.role,
            content:
              attNames.length > 0
                ? `${m.content}\n[첨부했던 자료: ${attNames.join(', ')}]`
                : m.content,
          };
        });

      workingSession = {
        ...activeSession,
        title: derivedTitle,
        messages: [...activeSession.messages, userMessage, assistantPlaceholder],
        updatedAt: Date.now(),
      };
    }

    upsertSession(workingSession);

    if (isSearchStudio) {
      const searchEntry: SearchHistoryEntry = {
        id: createId('search'),
        query: displayPrompt,
        subTrackId: activeSession.subTrackId,
        sessionId: workingSession.id,
        createdAt: Date.now(),
      };
      setSearchHistory((prev) => {
        const filtered = prev.filter((item) => item.query !== displayPrompt);
        return [searchEntry, ...filtered].slice(0, 20);
      });
      if (!currentProfile.isGuest) {
        void saveSearchHistoryToCloud(currentProfile.id, searchEntry).catch(handleCloudError);
      }
    }

    if (!customPrompt) setInputText('');
    if (!isSplitStudio) setAttachments([]);
    setIsStreaming(true);

    const memoryContext = buildCrossSessionMemoryContext({
      activeSessionId: workingSession.id,
      activeWorkspaceId,
      sessions,
      savedStudyNotes,
    });

    try {
      const latestArtifact = [...workingSession.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && !m.error && m.generatedDocument)
        ?.generatedDocument;

      const latestSessionAttachments =
        activeAtts.length > 0
          ? activeAtts
          : [...workingSession.messages]
              .slice(0, -2)
              .reverse()
              .map((m) => (m.role === 'user' ? sentAttachmentMap[m.id] : undefined))
              .find((atts) => atts && atts.length > 0) || [];

      const hasPriorConversation = workingSession.messages
        .slice(0, -2)
        .some((m) => !m.error && m.content.trim().length > 0);

      const directConversionTriggered =
        (!isSearchStudio || activeAtts.length > 0) &&
        isDirectConversionRequest(
          displayPrompt,
          latestSessionAttachments.length > 0,
          Boolean(latestArtifact) || hasPriorConversation
        );

      if (
        (isMakerWorkspace &&
          !isCasualMakerGreeting(
            displayPrompt,
            latestSessionAttachments.length > 0,
            Boolean(latestArtifact)
          )) ||
        directConversionTriggered
      ) {
        const explicitTarget = detectExplicitTargetFormat(displayPrompt);
        let targetFormat =
          explicitTarget ||
          determineTargetFormat(activeWorkspaceId, activeSession.subTrackId, displayPrompt);

        if (!explicitTarget && latestArtifact) {
          targetFormat =
            latestArtifact.kind === 'presentation'
              ? 'pptx'
              : activeSession.subTrackId === 'pdf'
                ? 'pdf'
                : activeSession.subTrackId === 'docx'
                  ? 'docx'
                  : 'hwpx';
        }

        const fallbackConversationSource =
          !latestArtifact && latestSessionAttachments.length === 0 && hasPriorConversation
            ? workingSession.messages
                .slice(0, -2)
                .filter((m) => !m.error && m.content.trim())
                .slice(-6)
                .map(
                  (m) =>
                    `${m.role === 'user' ? '학생 질문' : 'AI 정리'}: ${
                      m.role === 'assistant'
                        ? parseAssistantDirectives(m.content).cleanContent
                        : m.content
                    }`
                )
                .join('\n\n')
                .slice(-14000)
            : '';

        setGeneratingArtifactMap((prev) => ({
          ...prev,
          [assistantMessageId]: targetFormat,
        }));

        try {
          const result = await requestGeneratedArtifact({
            format: targetFormat,
            templateKind:
              targetFormat === 'pptx'
                ? 'presentation'
                : activeSession.subTrackId === 'report'
                  ? 'report'
                  : 'study-note',
            topic: displayPrompt,
            sourceText: fallbackConversationSource,
            workspaceId: activeWorkspaceId,
            subTrackId: activeSession.subTrackId,
            gradeLevel: activeSession.gradeLevel,
            thinkingDepth: activeSession.thinkingDepth || 'standard',
            careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
            studentName: currentProfile.name,
            memoryContext: memoryContext || undefined,
            history: historyPayload,
            attachments: latestSessionAttachments,
            existingArtifact: latestArtifact,
          });

          workingSession = {
            ...workingSession,
            messages: workingSession.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: result.assistantSummary,
                    generatedDocument: result.document,
                    requestedFormat: targetFormat,
                  }
                : m
            ),
            updatedAt: Date.now(),
          };
          upsertSession(workingSession);
          return;
        } finally {
          setGeneratingArtifactMap((prev) => {
            const next = { ...prev };
            delete next[assistantMessageId];
            return next;
          });
        }
      }

      if (isSearchStudio) {
        const response = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subTrackId: activeSession.subTrackId,
            gradeLevel: activeSession.gradeLevel,
            careerGoal: currentProfile.careerGoal,
            memoryContext: memoryContext || undefined,
            history: historyPayload,
            prompt: displayPrompt,
            attachments:
              activeAtts.length > 0
                ? activeAtts.map((a) => ({
                    name: a.name,
                    mimeType: a.mimeType,
                    dataBase64: a.dataBase64,
                    textContent: a.textContent,
                  }))
                : undefined,
          }),
        });
        const data = (await response.json()) as {
          text?: string;
          sources?: GroundingSource[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || `검색 요청 오류 (${response.status})`);
        }
        const rawSearchText = data.text || '';
        workingSession = {
          ...workingSession,
          messages: workingSession.messages.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: rawSearchText,
                  sources: Array.isArray(data.sources) ? data.sources : [],
                }
              : m
          ),
          updatedAt: Date.now(),
        };
        upsertSession(workingSession);

        const parsedSearch = parseAssistantDirectives(rawSearchText);
        if (parsedSearch.docDirective) {
          const fmt = parsedSearch.docDirective.format;
          setGeneratingArtifactMap((prev) => ({ ...prev, [assistantMessageId]: fmt }));
          try {
            const docRes = await requestGeneratedArtifact({
              format: fmt,
              topic: parsedSearch.docDirective.title || displayPrompt,
              sourceText: parsedSearch.cleanContent,
              workspaceId: activeWorkspaceId,
              subTrackId: activeSession.subTrackId,
              gradeLevel: activeSession.gradeLevel,
              thinkingDepth: activeSession.thinkingDepth || 'standard',
              careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
              studentName: currentProfile.name,
              memoryContext: memoryContext || undefined,
              history: historyPayload,
              attachments: latestSessionAttachments,
            });
            workingSession = patchAssistantMessageArtifact(
              workingSession,
              assistantMessageId,
              {
                generatedDocument: docRes.document,
                requestedFormat: fmt,
              }
            );
          } catch {
            // Keep search text intact even if secondary artifact generation fails
          } finally {
            setGeneratingArtifactMap((prev) => {
              const next = { ...prev };
              delete next[assistantMessageId];
              return next;
            });
          }
        }
        return;
      }

      const controller = new AbortController();
      const fetchTimer = window.setTimeout(() => controller.abort(), 145000);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            workspaceId: activeWorkspaceId,
            subTrackId: activeSession.subTrackId,
            gradeLevel: activeSession.gradeLevel,
            studyMode: activeSession.studyMode,
            thinkingDepth: activeSession.thinkingDepth || 'standard',
            careerGoal: currentProfile.careerGoal,
            connectCareer,
            memoryContext: memoryContext || undefined,
            verifyMode: Boolean(options?.verifyMode),
            history: historyPayload,
            prompt: displayPrompt,
            attachments:
              activeAtts.length > 0
                ? activeAtts.map((a) => ({
                    name: a.name,
                    mimeType: a.mimeType,
                    dataBase64: a.dataBase64,
                    textContent: a.textContent,
                  }))
                : undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `서버 응답 오류 (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('스트림을 읽을 수 없습니다.');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let collectedSources: GroundingSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = JSON.parse(line.slice(6)) as {
              text?: string;
              sources?: GroundingSource[];
              done?: boolean;
              error?: string;
            };
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (Array.isArray(payload.sources) && payload.sources.length > 0) {
              collectedSources = payload.sources;
              workingSession = {
                ...workingSession,
                messages: workingSession.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, sources: collectedSources }
                    : m
                ),
                updatedAt: Date.now(),
              };
              setActiveSession(workingSession);
            }
            if (payload.text) {
              accumulated += payload.text;
              workingSession = {
                ...workingSession,
                messages: workingSession.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: accumulated,
                        sources: collectedSources.length > 0 ? collectedSources : m.sources,
                      }
                    : m
                ),
                updatedAt: Date.now(),
              };
              setActiveSession(workingSession);
            }
          }
        }
        upsertSession(workingSession);

        const parsedStream = parseAssistantDirectives(accumulated);
        if (parsedStream.docDirective && !parsedStream.switchWorkspaceId) {
          const fmt = parsedStream.docDirective.format;
          setGeneratingArtifactMap((prev) => ({ ...prev, [assistantMessageId]: fmt }));
          try {
            const docRes = await requestGeneratedArtifact({
              format: fmt,
              topic: parsedStream.docDirective.title || displayPrompt,
              sourceText: parsedStream.cleanContent,
              workspaceId: activeWorkspaceId,
              subTrackId: activeSession.subTrackId,
              gradeLevel: activeSession.gradeLevel,
              thinkingDepth: activeSession.thinkingDepth || 'standard',
              careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
              studentName: currentProfile.name,
              memoryContext: memoryContext || undefined,
              history: historyPayload,
              attachments: latestSessionAttachments,
            });
            workingSession = patchAssistantMessageArtifact(
              workingSession,
              assistantMessageId,
              {
                generatedDocument: docRes.document,
                requestedFormat: fmt,
              }
            );
          } catch {
            // Keep streamed content intact even if secondary artifact generation fails
          } finally {
            setGeneratingArtifactMap((prev) => {
              const next = { ...prev };
              delete next[assistantMessageId];
              return next;
            });
          }
        }

        if (voiceAutoRead && accumulated.trim() && !accumulated.includes('[[SWITCH:')) {
          handleSpeakResponse(assistantMessageId, accumulated);
        }
      } finally {
        window.clearTimeout(fetchTimer);
      }
    } catch (err) {
      const errMsg =
        err instanceof Error && err.name === 'AbortError'
          ? '응답 시간이 초과되었습니다. 잠시 후 아래 "다시 시도" 버튼을 눌러 주세요.'
          : err instanceof Error
            ? err.message
            : '알 수 없는 오류가 발생했습니다.';
      setFailedRetryMap((prev) => ({
        ...prev,
        [assistantMessageId]: {
          prompt: displayPrompt,
          attachments: activeAtts.length > 0 ? activeAtts : undefined,
        },
      }));
      workingSession = {
        ...workingSession,
        messages: workingSession.messages.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: errMsg, error: true }
            : m
        ),
        updatedAt: Date.now(),
      };
      upsertSession(workingSession);
    } finally {
      sendingRef.current = false;
      setIsStreaming(false);
    }
  };

  const handleVerifyAssistantMessage = (msgIdx: number) => {
    if (isStreaming || sendingRef.current) return;
    const targetAssistant = activeSession.messages[msgIdx];
    let prevUser: ChatMessage | undefined;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (activeSession.messages[i]?.role === 'user') {
        prevUser = activeSession.messages[i];
        break;
      }
    }
    const carryAttachments = prevUser ? sentAttachmentMap[prevUser.id] : undefined;
    const targetSnippet = targetAssistant?.content
      ? parseAssistantDirectives(targetAssistant.content).cleanContent.slice(0, 260)
      : '';
    const verifyPrompt = prevUser?.content
      ? `방금 직전 답변을 백지 상태에서 독립적으로 사실 확인(팩트체크) 및 교차 검산해 줘. 원래 질문("${prevUser.content.slice(0, 180)}${prevUser.content.length > 180 ? '...' : ''}")에 대해 직전 답변(${targetSnippet ? `"${targetSnippet}${targetSnippet.length >= 260 ? '...' : ''}"` : '직전 응답'}) 중 사실과 다르거나 지어낸 정보(날짜·인물·통계·출처·개념 오류), 또는 조건·부호·계산·선지 오류가 있는지 하나씩 검증하고 정확한 사실과 확정 정답만 알려줘.`
      : '방금 직전 답변의 사실 관계(날짜·인물·개념·출처)와 풀이·계산 과정을 백지 상태에서 다시 검증해 줘. 사실이 아니거나 확인되지 않은 부분이 있으면 솔직히 정정해 줘.';
    void sendMessage(verifyPrompt, carryAttachments, undefined, { verifyMode: true });
  };

  const generateQuiz = async () => {
    const contextText = activeSession.messages
      .filter((m) => !m.error && m.content.trim())
      .map((m) => `${m.role === 'user' ? '학생 질문' : 'AI 정리'}: ${m.content}`)
      .join('\n\n');

    if (!contextText) return;

    setQuizOpen(true);
    setQuizLoading(true);
    setQuizError(null);
    setQuizQuestions([]);

    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          subTrackId: activeSession.subTrackId,
          gradeLevel: activeSession.gradeLevel,
          careerGoal: connectCareer ? currentProfile.careerGoal : undefined,
          contextText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '퀴즈 생성에 실패했습니다.');
      }
      setQuizQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : '퀴즈 생성 중 오류가 발생했습니다.');
    } finally {
      setQuizLoading(false);
    }
  };

  const generateFlashcards = async () => {
    const contextText = activeSession.messages
      .filter((m) => !m.error && m.content.trim())
      .map((m) => `${m.role === 'user' ? '학생 질문' : 'AI 정리'}: ${m.content}`)
      .join('\n\n');

    setFlashcardsOpen(true);
    setFlashcardsLoading(true);
    setFlashcardsError(null);
    setFlashcards([]);

    try {
      const response = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          subTrackId: activeSession.subTrackId,
          gradeLevel: activeSession.gradeLevel,
          contextText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '암기 카드 생성에 실패했습니다.');
      }
      setFlashcards(Array.isArray(data.cards) ? data.cards : []);
    } catch (err) {
      setFlashcardsError(err instanceof Error ? err.message : '암기 카드 생성 중 오류가 발생했습니다.');
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const handleGoogleSignIn = async (importGuestNotes: boolean) => {
    setAuthError(null);
    setCloudSyncNotice(null);
    setAuthLoading(true);
    pendingGuestMigrationRef.current = importGuestNotes;
    try {
      await signInWithPopup(auth, googleProvider);
      setProfileModalOpen(false);
    } catch (err) {
      pendingGuestMigrationRef.current = false;
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          '브라우저에서 팝업이 차단되었습니다. 주소창의 팝업 차단 설정을 해제한 뒤 다시 눌러 주세요.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError('현재 도메인에서 Google 로그인이 승인되지 않았습니다.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('네트워크 연결 상태를 확인한 뒤 다시 시도해 주세요.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError('Google 로그인이 현재 프로젝트에서 활성화되지 않았습니다.');
      } else if (code !== 'auth/cancelled-popup-request') {
        setAuthError('Google 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthError(null);
    setCloudSyncNotice(null);
    setAuthLoading(true);
    try {
      await signOut(auth);
      setProfileModalOpen(false);
    } catch {
      setAuthError('로그아웃 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setAuthLoading(false);
    }
  };

  const canGenerateQuiz = activeSession.messages.some(
    (m) => m.role === 'assistant' && !m.error && m.content.trim().length > 20
  );

  const showInitialCareerAsk =
    !currentProfile.careerGoal &&
    !currentProfile.careerPromptDismissed &&
    activeSession.messages.length === 0;

  const isSolveOnly =
    activeSession.studyMode === 'solve-only' && !isSearchStudio && !isMakerWorkspace;
  const isPerformanceMode =
    activeSession.studyMode === 'performance' &&
    !isSearchStudio &&
    !isFreeChat &&
    !isMakerWorkspace;

  const dynamicQuickPrompts = (() => {
    const subLabel =
      workspace.subTracks?.find((t) => t.id === activeSession.subTrackId)?.label ||
      workspace.name;

    if (isPerformanceMode) {
      return [
        `${subLabel} 수행평가 주제를 아직 못 정했어. ${currentProfile.careerGoal ? `'${currentProfile.careerGoal}' 진로와 연결되면서 ` : ''}자료 찾기 좋고 차별화되는 탐구 주제 3가지를 추천해 줘.`,
        `${subLabel} 수행평가 안내문·채점 기준표를 올릴 테니 만점 조건 체크리스트와 보고서 목차(개요)를 짜줘.`,
        `내가 작성한 ${subLabel} 수행평가 초안을 붙일 테니 채점 기준에 맞춰 감점 요인을 첨삭하고 문장을 다듬어 줘.`,
        `${subLabel} 수행평가 발표 대본 구성과 선생님이 물어보실 만한 예상 질문·답변 3가지를 정리해 줘.`,
      ];
    }

    if (isSolveOnly) {
      return [
        `${subLabel} 대표 유형 문제 3개를 출제하고, 개념 노트 없이 문제와 단계별 풀이 과정·정답만 보여줘.`,
        `${subLabel} 고난도 서술형 문제 1개를 출제하고 채점 기준과 단계별 풀이만 간결하게 풀어줘.`,
        ...workspace.quickPrompts.slice(0, 2),
      ];
    }
    const base = [...workspace.quickPrompts];
    if (currentProfile.careerGoal) {
      if (isSearchStudio) {
        base.unshift(
          `${currentProfile.careerGoal} 진로 준비에 도움이 되는 학습 사이트와 공부 앱을 찾아서 정리해 줘`
        );
      } else if (workspace.category === 'subject') {
        base.push(
          `${workspace.name} 교과 내용을 '${currentProfile.careerGoal}' 진로·학과와 연결해 탐구 주제를 추천해 줘`
        );
      }
    }
    return base;
  })();

  const formattedIndex = workspaceIndex < 10 ? `0${workspaceIndex}` : `${workspaceIndex}`;

  const chatPane = (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-4 lg:px-10 pt-6 pb-10">
        <div className="max-w-3xl mx-auto">
          {activeSession.messages.length === 0 ? (
            <motion.div
              key={`${activeWorkspaceId}-${activeSession.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="py-5 lg:py-9 space-y-8"
            >
              {/* First-visit Career / Major Inline Sheet */}
              {showInitialCareerAsk && (
                <div className="rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#2A2E38] p-6 space-y-4 shadow-[0_1px_2px_rgba(23,25,28,0.03),0_12px_32px_-16px_rgba(23,25,28,0.08)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F2EDE3] dark:bg-[#22252E] border border-[#E6DFD1] dark:border-[#303542] flex items-center justify-center shrink-0 mt-0.5">
                        <Compass className="w-4 h-4 text-[#17191C] dark:text-[#EFECE4]" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#17191C] dark:text-[#EFECE4]">
                          먼저 관심 진로나 희망 학과를 알려주세요
                        </h3>
                        <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] mt-1 leading-relaxed">
                          진로를 설정하면 모든 과목의 답변 끝에 진로·세특 연계 포인트가 함께 정리됩니다. 나중에 상단에서 언제든 변경할 수 있습니다.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateCurrentProfile({ careerPromptDismissed: true })}
                      className="text-xs text-[#787B84] dark:text-[#848077] hover:text-[#17191C] dark:hover:text-[#EFECE4] whitespace-nowrap shrink-0"
                    >
                      나중에 설정
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CAREER_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSaveCareerGoal(preset)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#2A2E38] bg-[#FAF7F0] dark:bg-[#14161A] text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!inlineCareerDraft.trim()) return;
                      handleSaveCareerGoal(inlineCareerDraft.trim());
                      setInlineCareerDraft('');
                    }}
                    className="flex gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={inlineCareerDraft}
                      onChange={(e) => setInlineCareerDraft(e.target.value)}
                      placeholder="원하는 진로·학과 직접 입력 (예: 수의예과, 반도체공학, 역사교사...)"
                      maxLength={48}
                      className="flex-1 min-w-0 px-3.5 py-2 text-xs rounded-xl border border-[#E6DFD1] dark:border-[#2A2E38] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none focus:border-[#17191C] dark:focus:border-[#8E8B82]"
                    />
                    <button
                      type="submit"
                      disabled={!inlineCareerDraft.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] disabled:opacity-35 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                    >
                      적용하기
                    </button>
                  </form>
                </div>
              )}

              {/* Modern Editorial Notebook Cover Header */}
              <div className="space-y-3 border-b border-[#E6DFD1] dark:border-[#272A33] pb-7">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#686C75] dark:text-[#8E8A80]">
                  <span className="font-mono-code">{formattedIndex}.</span>
                  <span>{activeSession.gradeLevel === 'middle' ? '중학교 과정' : '고등학교 과정'}</span>
                  {!isSearchStudio && !isFreeChat && !isMakerWorkspace && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {activeSession.studyMode === 'performance'
                          ? '수행평가 모드'
                          : activeSession.studyMode === 'solve-only'
                            ? '문제·풀이 전용'
                            : activeSession.studyMode === 'tutor'
                              ? '튜터 모드'
                              : '빠른 해설 모드'}
                      </span>
                    </>
                  )}
                  {activeSession.subTrackId && workspace.subTracks && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {workspace.subTracks.find((t) => t.id === activeSession.subTrackId)?.label}
                      </span>
                    </>
                  )}
                  {!isSolveOnly && (!isFreeChat || activeSession.subTrackId === 'career-talk') && currentProfile.careerGoal && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>진로 연계: {currentProfile.careerGoal}</span>
                    </>
                  )}
                </div>

                <h2 className="font-display text-[28px] sm:text-[32px] font-bold tracking-[-0.025em] leading-[1.2] text-[#17191C] dark:text-[#F5F2EA] [text-wrap:balance]">
                  {isDocMaker
                    ? '한글 · 문서 제작 AI'
                    : isPptMaker
                      ? 'PPT 발표자료 제작 AI'
                      : isSearchStudio
                        ? '학습 사이트 · 공부 앱 검색'
                        : isFreeChat
                          ? 'AI와 자유롭게 대화하기'
                          : isPerformanceMode
                            ? `${workspace.name} 수행평가 코치`
                            : isSolveOnly
                              ? `${workspace.name} 문제 · 풀이 전용`
                              : `${workspace.name} 학습 노트`}
                </h2>
                <p className="text-[15px] text-[#5A5E66] dark:text-[#A5A197] leading-relaxed max-w-2xl">
                  {isDocMaker
                    ? '만들고 싶은 주제나 수행평가 조건을 말하거나 PDF·필기 사진을 첨부하면 AI가 한글(.hwpx)·PDF·워드(.docx) 문서를 직접 완성합니다. 완성된 뒤에도 대화를 이어가며 원하는 부분만 수정할 수 있습니다.'
                    : isPptMaker
                      ? '발표 주제와 원하는 장수를 입력하거나 자료를 첨부하면 AI가 슬라이드 구성, 비교표, 발표 대본까지 갖춘 .pptx 발표자료를 직접 제작합니다. 마음에 들지 않는 슬라이드는 말로 바로 수정해 보세요.'
                      : isSearchStudio
                        ? '웹 검색을 통해 공부나 진로 탐구에 유용한 사이트와 앱을 찾아 특징, 비용, 활용법과 접속 링크를 정리합니다.'
                        : isFreeChat
                          ? '과목 제한 없이 공부 고민, 진로 이야기, 영어 회화, 일상 질문까지 편하게 대화를 나눌 수 있습니다. 아래 마이크 버튼으로 말로도 대화해 보세요.'
                          : isPerformanceMode
                            ? `${workspace.name} 수행평가 안내문·채점 기준표(루브릭) 사진을 올리거나 주제를 말하면, 탐구 주제 추천·보고서 개요·초안 첨삭·발표 예상 질문·참고 자료 링크까지 단계별로 도와줍니다.`
                            : isSolveOnly
                              ? `${workspace.category === 'subject' ? `${workspace.name} 전용 AI로 해당 과목 문제만 풀이합니다. ` : ''}개념 노트 정리 없이 문제와 단계별 풀이 과정·정답만 간결하게 제시합니다. 사진 여러 장도 한 번에 올릴 수 있습니다.`
                              : workspace.category === 'subject'
                                ? `${workspace.shortDesc}. ${workspace.name} 질문·풀이·수행평가 준비·참고 자료 링크 검색은 물론 튜터와 대화도 가능하며, 사진·문서는 개수 제한 없이 첨부할 수 있습니다.`
                                : `${workspace.shortDesc}. 궁금한 개념이나 문제를 입력하거나, 사진·문서를 여러 개 첨부해 바로 질문해 보세요.`}
                </p>
              </div>

              {/* PPT Design & Density Options Panel inside PPT Maker Cover */}
              {isPptMaker && (
                <div className="rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                      PPT 구성 · 디자인 맞춤 설정
                    </div>
                    <div className="text-[11px] text-[#686C75] dark:text-[#8E8A80]">
                      선택한 설정에 맞춰 카드·타임라인·지표·비교표 슬라이드가 자동 조합됩니다
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                        내용 분량 · 장수
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: 'concise', label: '간결 핵심 (6~7장)' },
                            { id: 'balanced', label: '표준 균형 (7~9장)' },
                            { id: 'rich', label: '풍부 심화 (9~12장)' },
                          ] as Array<{ id: PptDensity; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPptDensity(opt.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                              pptDensity === opt.id
                                ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                                : 'bg-[#FAF7F0] dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#2E323D] text-[#4C5059] dark:text-[#C5C1B7] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                        레이아웃 스타일
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: 'auto', label: '자동 다양화' },
                            { id: 'infographic', label: '인포그래픽 · 카드' },
                            { id: 'analytical', label: '비교표 · 분석' },
                            { id: 'editorial', label: '에디토리얼' },
                          ] as Array<{ id: PptDesignStyle; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPptDesignStyle(opt.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                              pptDesignStyle === opt.id
                                ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                                : 'bg-[#FAF7F0] dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#2E323D] text-[#4C5059] dark:text-[#C5C1B7] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-[#EFEAE0] dark:border-[#242730]">
                    <div className="text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                      기본 컬러 테마
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'auto', label: 'AI 자동 추천', color: undefined },
                          { id: 'ivory', label: '웜 아이보리', color: '#2E4A6F' },
                          { id: 'navy', label: '아카데믹 네이비', color: '#1E3A8A' },
                          { id: 'sage', label: '세이지 노트', color: '#1E5B46' },
                          { id: 'terracotta', label: '테라코타 인문', color: '#B44C2E' },
                          { id: 'cobalt', label: '코발트 테크', color: '#1D4ED8' },
                          { id: 'editorial', label: '다크 에디토리얼', color: '#D4A359' },
                          { id: 'lavender', label: '라벤더 스튜디오', color: '#5B3CC4' },
                        ] as Array<{ id: PptThemeId | 'auto'; label: string; color?: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPptThemePref(opt.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                            pptThemePref === opt.id
                              ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                              : 'bg-[#FAF7F0] dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#2E323D] text-[#4C5059] dark:text-[#C5C1B7] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                          }`}
                        >
                          {opt.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                              style={{ backgroundColor: opt.color }}
                            />
                          )}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Search History inside Search Studio */}
              {isSearchStudio && searchHistory.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#686C75] dark:text-[#8E8A80]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>최근 검색 기록</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchHistory([])}
                      className="text-xs text-[#787B84] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
                    >
                      검색 기록 비우기
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {searchHistory.slice(0, 6).map((entry) => {
                      const savedSession = sessions.find((s) => s.id === entry.sessionId);
                      return (
                        <div
                          key={entry.id}
                          className="group flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] hover:border-[#C5BCAA] dark:hover:border-[#3D4250] transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (savedSession) {
                                handleSelectSession(savedSession);
                              } else {
                                sendMessage(entry.query);
                              }
                            }}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <Search className="w-3.5 h-3.5 shrink-0 text-[#8A8D95]" />
                            <span className="text-xs font-medium text-[#17191C] dark:text-[#EFECE4] truncate">
                              {entry.query}
                            </span>
                            {savedSession && (
                              <span className="text-[11px] text-[#787B84] dark:text-[#848077] shrink-0">
                                · 결과 이어보기
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSearchHistory((prev) => prev.filter((item) => item.id !== entry.id))
                            }
                            className="p-1 text-[#8A8D95] hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
                            aria-label="검색어 삭제"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Refined Prompt Grid */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#686C75] dark:text-[#8E8A80]">
                  {isSearchStudio ? '추천 검색 주제' : isFreeChat ? '추천 대화 주제' : '빠른 학습 질문'}
                </div>
                <div
                  className={`grid grid-cols-1 gap-2.5 ${
                    dynamicQuickPrompts.length >= 4 || isSearchStudio
                      ? 'sm:grid-cols-2'
                      : 'sm:grid-cols-1'
                  }`}
                >
                  {dynamicQuickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="group flex items-start justify-between gap-3 w-full text-left p-4 rounded-xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] hover:border-[#C5BCAA] dark:hover:border-[#3D4250] shadow-[0_1px_2px_rgba(23,25,28,0.02)] hover:shadow-[0_4px_14px_-6px_rgba(23,25,28,0.08)] transition-all duration-150"
                    >
                      <span className="text-[13.5px] font-medium text-[#17191C] dark:text-[#EFECE4] leading-relaxed">
                        {q}
                      </span>
                      <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5 text-[#8A8D95] group-hover:text-[#17191C] dark:group-hover:text-[#EFECE4] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6 pb-4">
              <AnimatePresence initial={false}>
                {activeSession.messages.map((msg, msgIdx) => {
                  const isLastAssistant =
                    msg.role === 'assistant' && msgIdx === activeSession.messages.length - 1;
                  const isCurrentlySpeaking = speakingMsgId === msg.id;
                  const { cleanContent, switchWorkspaceId, docDirective } =
                    msg.role === 'assistant'
                      ? parseAssistantDirectives(msg.content)
                      : {
                          cleanContent: msg.content,
                          switchWorkspaceId: undefined,
                          docDirective: undefined,
                        };
                  const targetWorkspace = switchWorkspaceId
                    ? WORKSPACE_MAP[switchWorkspaceId]
                    : undefined;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className={msg.role === 'user' ? 'flex justify-end' : 'w-full'}
                    >
                      {msg.role === 'user' ? (
                        (() => {
                          const msgAtts =
                            msg.attachments && msg.attachments.length > 0
                              ? msg.attachments
                              : msg.attachment
                                ? [msg.attachment]
                                : [];
                          const imageAtts = msgAtts.filter((a) => a.previewUrl);
                          return (
                            <div className="group relative max-w-[85%] sm:max-w-[74%] rounded-2xl px-4 py-3 bg-[#EFEAE0] dark:bg-[#22252E] text-sm text-[#17191C] dark:text-[#EFECE4] space-y-2">
                              {msgAtts.length > 0 && (
                                <div className="space-y-1.5">
                                  {imageAtts.length > 0 && (
                                    <div
                                      className={`grid gap-1.5 ${
                                        imageAtts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                                      }`}
                                    >
                                      {imageAtts.map((att, attIdx) => (
                                        <img
                                          key={`${att.name}-${attIdx}`}
                                          src={att.previewUrl}
                                          alt={att.name}
                                          referrerPolicy="no-referrer"
                                          className={`w-full rounded-xl border border-[#DFD7C6] dark:border-[#333845] object-contain ${
                                            imageAtts.length > 1 ? 'max-h-40' : 'max-h-56'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {msgAtts.filter((a) => !a.previewUrl).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {msgAtts
                                        .filter((a) => !a.previewUrl)
                                        .map((att, attIdx) => {
                                          const badge = getAttachmentVisualInfo(att.name, att.mimeType);
                                          return (
                                            <div
                                              key={`${att.name}-doc-${attIdx}`}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFFEFA]/80 dark:bg-[#16181D] border border-[#DDD5C5] dark:border-[#333845] text-xs"
                                            >
                                              <span className="px-1.5 py-0.5 rounded font-mono-code text-[10px] font-semibold bg-[#E6DFD1] dark:bg-[#2A2E3A] text-[#17191C] dark:text-[#EFECE4]">
                                                {badge.label}
                                              </span>
                                              <span className="max-w-[200px] truncate font-medium text-[#17191C] dark:text-[#EFECE4]">
                                                {att.name}
                                              </span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  )}
                                  {imageAtts.length > 0 && (
                                    <div className="text-xs text-[#5A5E66] dark:text-[#9D998E] font-mono-code break-all">
                                      이미지({imageAtts.length}): {imageAtts.map((a) => a.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap leading-relaxed study-chat-text">{msg.content}</p>
                          <div className="flex justify-end pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleAddPrompt(
                                  msg.content.slice(0, 26) + (msg.content.length > 26 ? '...' : ''),
                                  msg.content,
                                  activeWorkspaceId
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 text-[11px] text-[#686C75] dark:text-[#9D998E] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-opacity"
                            >
                              <BookmarkPlus className="w-3 h-3" />
                              <span>프롬프트 저장</span>
                            </button>
                          </div>
                        </div>
                          );
                        })()
                      ) : (
                        <article
                          className={`rounded-2xl px-6 py-5 border shadow-[0_1px_2px_rgba(23,25,28,0.03),0_10px_28px_-14px_rgba(23,25,28,0.07)] ${
                            msg.error
                              ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                              : 'bg-[#FFFEFA] dark:bg-[#1A1C22] border-[#E6DFD1] dark:border-[#272A33]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-[#EFEAE0] dark:border-[#242730]">
                            <div className="flex items-center gap-2 text-xs font-medium text-[#5A5E66] dark:text-[#9D998E]">
                              <SubjectIcon id={activeWorkspaceId} className="w-3.5 h-3.5" />
                              <span>
                                {isDocMaker
                                  ? '한글 · 문서 제작 AI'
                                  : isPptMaker
                                    ? 'PPT 발표자료 제작 AI'
                                    : isSearchStudio
                                      ? '웹 검색 · 사이트·앱 정리'
                                      : isFreeChat
                                        ? 'AI 자유 대화'
                                        : isPerformanceMode
                                          ? `${workspace.name} 수행평가`
                                          : isSolveOnly
                                            ? `${workspace.name} 문제 · 풀이`
                                            : `${workspace.name} 노트`}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-code text-[11px] text-[#8A8D95]">
                                {new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            {cleanContent && !msg.error && !targetWorkspace && (
                              <div className="flex items-center gap-1">
                                {!isSearchStudio && !isMakerWorkspace && !isStreaming && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyAssistantMessage(msgIdx)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
                                    title="최고 추론(XHIGH)과 검색 대조로 사실 관계·풀이·정답을 백지 상태에서 검증합니다"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>{isFreeChat ? '사실 확인' : '검산 · 확인'}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleSpeakResponse(msg.id, cleanContent)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                    isCurrentlySpeaking
                                      ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215]'
                                      : 'text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                                  }`}
                                  title={isCurrentlySpeaking ? '음성 재생 중지' : '음성으로 듣기'}
                                >
                                  {isCurrentlySpeaking ? (
                                    <>
                                      <Square className="w-2.5 h-2.5 fill-current" />
                                      <span>중지</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-3 h-3" />
                                      <span>듣기</span>
                                    </>
                                  )}
                                </button>

                                {!isSearchStudio && !isMakerWorkspace && (
                                  <button
                                    type="button"
                                    disabled={savedNoteIds[msg.id]}
                                    onClick={() =>
                                      handleSaveStudyNote({ ...msg, content: cleanContent })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4] disabled:text-emerald-700 dark:disabled:text-emerald-400 transition-colors"
                                    title="오답·핵심노트 보관함에 저장"
                                  >
                                    {savedNoteIds[msg.id] ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>노트 저장됨</span>
                                      </>
                                    ) : (
                                      <>
                                        <BookMarked className="w-3 h-3" />
                                        <span>오답노트 저장</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {!isMakerWorkspace && !msg.generatedDocument && !generatingArtifactMap[msg.id] && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleGenerateArtifactForMessage(
                                          msg.id,
                                          'hwpx',
                                          docDirective?.title
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
                                      title="AI가 이 내용을 한글(.hwpx)·PDF·워드(.docx) 문서로 즉시 제작합니다"
                                    >
                                      <FileOutput className="w-3 h-3" />
                                      <span>한글·문서화</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleGenerateArtifactForMessage(
                                          msg.id,
                                          'pptx',
                                          docDirective?.title
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
                                      title="AI가 이 내용을 슬라이드와 발표 대본이 담긴 PPT(.pptx)로 제작합니다"
                                    >
                                      <Presentation className="w-3 h-3" />
                                      <span>PPT화</span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCopyNote(msg.id, cleanContent)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80] hover:bg-[#F2EDE3] dark:hover:bg-[#232630] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
                                  title="정리 내용 복사"
                                >
                                  {copiedNoteId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      <span>복사됨</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>복사</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {cleanContent || msg.generatedDocument || generatingArtifactMap[msg.id] ? (
                            <div className="space-y-4">
                              {cleanContent && <MarkdownRenderer content={cleanContent} />}

                              {generatingArtifactMap[msg.id] ? (
                                <div className="rounded-xl border border-[#E6DFD1] dark:border-[#2C303B] bg-[#FAF7F0] dark:bg-[#14161A] px-4 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] flex items-center justify-center shrink-0">
                                    {generatingArtifactMap[msg.id] === 'pptx' ? (
                                      <Presentation className="w-4 h-4 animate-pulse" />
                                    ) : (
                                      <FileOutput className="w-4 h-4 animate-pulse" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                                      AI가 {FORMAT_BUILD_LABELS[generatingArtifactMap[msg.id]]}
                                    </div>
                                    <div className="text-[11px] text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                                      완성되면 바로 미리보기와 파일 저장 버튼이 나타납니다.
                                    </div>
                                  </div>
                                </div>
                              ) : msg.generatedDocument ? (
                                <GeneratedArtifactCard
                                  artifact={msg.generatedDocument}
                                  preferredFormat={msg.requestedFormat}
                                  defaultExpanded={isLastAssistant || isMakerWorkspace}
                                  isConverting={isStreaming || Object.keys(generatingArtifactMap).length > 0}
                                  onUpdateArtifact={(updated) =>
                                    patchAssistantMessageArtifact(activeSession, msg.id, {
                                      generatedDocument: updated,
                                    })
                                  }
                                  onQuickRevise={(instruction) => sendMessage(instruction)}
                                  onConvertFormat={(fmt) =>
                                    handleConvertArtifactFromMessage(msg.id, fmt)
                                  }
                                />
                              ) : docDirective && !isStreaming && !msg.error ? (
                                <div className="pt-2 border-t border-[#EFEAE0] dark:border-[#242730] flex flex-wrap items-center justify-between gap-2.5">
                                  <div className="text-xs text-[#5A5E66] dark:text-[#9D998E]">
                                    <strong className="text-[#17191C] dark:text-[#EFECE4]">
                                      {docDirective.title || '학습 자료'}
                                    </strong>{' '}
                                    · AI에게 문서/PPT로 직접 제작을 요청할 수 있습니다
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {(
                                      [
                                        { id: 'hwpx', label: '한글 (.hwpx)' },
                                        { id: 'pdf', label: 'PDF' },
                                        { id: 'docx', label: '워드 (.docx)' },
                                        { id: 'pptx', label: 'PPT (.pptx)' },
                                      ] as Array<{ id: ExportFormat; label: string }>
                                    ).map((fmt) => {
                                      const isPrimary = fmt.id === docDirective.format;
                                      return (
                                        <button
                                          key={fmt.id}
                                          type="button"
                                          onClick={() =>
                                            handleGenerateArtifactForMessage(
                                              msg.id,
                                              fmt.id,
                                              docDirective.title
                                            )
                                          }
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                            isPrimary
                                              ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90'
                                              : 'border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#4C5059] dark:text-[#C5C1B7] hover:bg-[#EFEAE0] dark:hover:bg-[#22252E]'
                                          }`}
                                        >
                                          <FileOutput className="w-3 h-3" />
                                          <span>AI {fmt.label} 제작</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              {targetWorkspace && !isStreaming && !msg.error && (
                                <div className="pt-1 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prevUser =
                                        msgIdx > 0 ? activeSession.messages[msgIdx - 1] : undefined;
                                      const carryQuestion =
                                        prevUser?.role === 'user' ? prevUser.content : '';
                                      const carryAttachments =
                                        prevUser?.role === 'user'
                                          ? sentAttachmentMap[prevUser.id]
                                          : undefined;
                                      handleSelectWorkspace(targetWorkspace.id, true);
                                      if (carryQuestion) {
                                        setInputText(carryQuestion);
                                      }
                                      if (carryAttachments && carryAttachments.length > 0) {
                                        setAttachments(carryAttachments);
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity"
                                  >
                                    <SubjectIcon id={targetWorkspace.id} className="w-3.5 h-3.5" />
                                    <span>{targetWorkspace.name} AI로 이동해 질문하기</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              {msg.error && !isStreaming && (
                                <div className="pt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const saved = failedRetryMap[msg.id];
                                      if (saved) {
                                        sendMessage(saved.prompt, saved.attachments, msg.id);
                                        return;
                                      }
                                      const prevUser =
                                        msgIdx > 0 ? activeSession.messages[msgIdx - 1] : undefined;
                                      if (prevUser?.role === 'user') {
                                        sendMessage(prevUser.content, undefined, msg.id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>다시 시도</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-[#686C75] dark:text-[#9D998E] py-1.5">
                              {isSearchStudio ? (
                                <>
                                  <Search className="w-3.5 h-3.5" />
                                  <span>실시간 웹에서 관련 사이트와 앱을 검색·정리하고 있습니다...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    {isSolveOnly
                                      ? '노트 정리 없이 문제와 풀이 과정을 작성하고 있습니다...'
                                      : isPerformanceMode
                                        ? '수행평가 채점 기준과 탐구 구성을 정리하고 있습니다...'
                                        : (activeSession.thinkingDepth || 'standard') === 'deep'
                                          ? '심화 추론 모드로 원리와 함정까지 검증하며 정리하고 있습니다...'
                                          : '노트를 정리하고 있습니다...'}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Deep Follow-Up Action Strip */}
                          {isLastAssistant &&
                            !isStreaming &&
                            !isSearchStudio &&
                            !isFreeChat &&
                            !isMakerWorkspace &&
                            !msg.error &&
                            !targetWorkspace &&
                            cleanContent.trim().length > 30 && (
                              <div className="mt-5 pt-3.5 border-t border-[#EFEAE0] dark:border-[#242730] flex flex-wrap items-center gap-1.5">
                                    {isSolveOnly ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 문제와 같은 유형·난이도의 유사 문제 1개를 더 출제하고, 문제와 단계별 풀이 과정·정답만 바로 보여줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      유사 문제 1개 더 풀기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 문제보다 난이도를 한 단계 높인 응용 문제 1개를 출제하고, 풀이 과정과 정답만 보여줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      난이도 높여서 1문제 더
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 문제의 다른 풀이 방법(별해)이 있다면 간결하게 풀이 과정만 보여줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      다른 풀이 방법 보기
                                    </button>
                                  </>
                                ) : isPerformanceMode ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 논의한 수행평가 방향으로 바로 작성에 들어갈 수 있도록 보고서 목차와 문단별 작성 개요(뼈대)를 짜줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      보고서 개요 · 목차 짜기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '이 수행평가에서 선생님이 가장 중요하게 보실 감점 방지 체크포인트와 고득점 차별화 요소를 짚어줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      감점 체크 · 고득점 팁
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '이 수행평가 내용을 발표할 때 쓸 1~2분 발표 대본 구성과 예상 질의응답(Q&A) 3가지를 만들어 줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      발표 대본 · 예상 질문
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '이 수행평가 보고서에 인용하기 좋은 공신력 있는 통계, 기사, 학술 자료 사이트와 접속 링크를 검색해서 찾아줘.'
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      <Search className="w-3 h-3" />
                                      <span>참고 통계 · 자료 링크 찾기</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 내용과 같은 난이도의 유사 변형 문제 1개를 출제하고 단계별 풀이도 함께 알려줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      유사 변형 문제 풀기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '방금 설명한 핵심을 시험 직전에 10초 만에 볼 수 있도록 3줄 암기 요약으로 압축해 줘.'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      3줄 암기 압축
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        sendMessage(
                                          '이 주제와 관련해 공부하기 좋은 신뢰할 수 있는 학습 사이트, 강의, 참고 자료와 접속 링크를 찾아서 추천해 줘.'
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                    >
                                      <Search className="w-3 h-3" />
                                      <span>참고 자료 · 링크 찾기</span>
                                    </button>
                                    {currentProfile.careerGoal && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          sendMessage(
                                            `이 학습 주제를 '${currentProfile.careerGoal}' 진로·학과와 연결한 심화 탐구 보고서(세특) 주제 2가지와 탐구 방법을 제안해 줘.`
                                          )
                                        }
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                      >
                                        세특 · 심화 탐구 확장
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleVerifyAssistantMessage(msgIdx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] text-[#2C2F36] dark:text-[#D5D1C8] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>사실 · 풀이 다시 검증</span>
                                </button>
                              </div>
                            )}

                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-[#EFEAE0] dark:border-[#242730] space-y-2.5">
                              <div className="text-xs font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                                확인된 출처 · 참고 자료 ({msg.sources.length})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {msg.sources.map((src, i) => (
                                  <a
                                    key={i}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium text-[#17191C] dark:text-[#EFECE4] truncate">
                                        {src.title}
                                      </div>
                                      <div className="text-[11px] text-[#787B84] dark:text-[#848077] truncate mt-0.5">
                                        {extractDomain(src.uri)}
                                      </div>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#8A8D95] group-hover:text-[#17191C] dark:group-hover:text-[#EFECE4] transition-colors" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Floating Dock Composer */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsComposerDragOver(true);
        }}
        onDragLeave={() => setIsComposerDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsComposerDragOver(false);
          if (e.dataTransfer.files?.length) {
            void handleComposerFiles(e.dataTransfer.files);
          }
        }}
        className="shrink-0 bg-gradient-to-t from-[#FAF7F0] via-[#FAF7F0]/95 to-transparent dark:from-[#111215] dark:via-[#111215]/95 px-4 lg:px-10 pt-2 pb-4"
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {isPptMaker && activeSession.messages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-[#686C75] dark:text-[#8E8A80] mr-0.5">
                PPT 설정:
              </span>
              {(
                [
                  { id: 'concise', label: '간결' },
                  { id: 'balanced', label: '표준' },
                  { id: 'rich', label: '풍부(9~12장)' },
                ] as Array<{ id: PptDensity; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPptDensity(opt.id)}
                  className={`px-2 py-0.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
                    pptDensity === opt.id
                      ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                      : 'bg-[#FFFEFA] dark:bg-[#1A1C22] border-[#E2DACB] dark:border-[#2E323D] text-[#5A5E66] dark:text-[#9D998E]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="text-[#B8B1A3] dark:text-[#444A58]" aria-hidden="true">|</span>
              {(
                [
                  { id: 'auto', label: '자동 스타일' },
                  { id: 'infographic', label: '인포그래픽' },
                  { id: 'analytical', label: '비교분석' },
                  { id: 'editorial', label: '에디토리얼' },
                ] as Array<{ id: PptDesignStyle; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPptDesignStyle(opt.id)}
                  className={`px-2 py-0.5 rounded-md font-medium border transition-colors whitespace-nowrap ${
                    pptDesignStyle === opt.id
                      ? 'bg-[#EFEAE0] dark:bg-[#272B36] border-[#B9AF9C] dark:border-[#495063] text-[#17191C] dark:text-[#EFECE4]'
                      : 'bg-[#FFFEFA] dark:bg-[#1A1C22] border-[#E2DACB] dark:border-[#2E323D] text-[#5A5E66] dark:text-[#9D998E]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {(!isSplitStudio || studioCollapsed) && attachments.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {attachments.map((att, idx) => {
                    const badge = getAttachmentVisualInfo(att.name, att.mimeType);
                    return (
                      <div
                        key={`${att.name}-${idx}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] text-xs shadow-xs"
                      >
                        {att.previewUrl ? (
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-md object-cover"
                          />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded font-mono-code text-[10px] font-semibold bg-[#EFEAE0] dark:bg-[#232630] text-[#17191C] dark:text-[#EFECE4]">
                            {badge.label}
                          </span>
                        )}
                        <span className="max-w-[160px] truncate text-[#17191C] dark:text-[#EFECE4]">
                          {att.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-[#787B84] hover:text-rose-600 dark:hover:text-rose-400"
                          aria-label="첨부 제거"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {attachments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAttachments([])}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#787B84] hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap"
                    >
                      전체 비우기 ({attachments.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#686C75] dark:text-[#9D998E]">
                    <FileOutput className="w-3 h-3" />
                    <span>AI 형식 전환:</span>
                  </span>
                  {(
                    [
                      { id: 'pdf', label: 'PDF' },
                      { id: 'hwpx', label: '한글(.hwpx)' },
                      { id: 'docx', label: '워드(.docx)' },
                      { id: 'pptx', label: 'PPT(.pptx)' },
                    ] as Array<{ id: ExportFormat; label: string }>
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => handleConvertAttachmentsWithPrompt(fmt.id)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium border border-[#E2DACB] dark:border-[#2E323D] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div />
            )}

            {voiceNotice ? (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                <span>{voiceNotice}</span>
                <button
                  type="button"
                  onClick={() => setVoiceNotice(null)}
                  className="text-[#787B84] hover:text-[#17191C] dark:hover:text-[#EFECE4]"
                  aria-label="알림 닫기"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : promptSavedNotice ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>프롬프트 보관함에 저장되었습니다</span>
              </span>
            ) : null}
          </div>

          <div
            className={`flex items-end gap-1.5 rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border px-3 py-2.5 shadow-[0_2px_8px_rgba(23,25,28,0.04),0_12px_28px_-14px_rgba(23,25,28,0.12)] focus-within:border-[#17191C] dark:focus-within:border-[#8E8A80] transition-colors ${
              isComposerDragOver
                ? 'border-[#17191C] dark:border-[#EFECE4] ring-2 ring-[#17191C]/10 dark:ring-[#EFECE4]/15'
                : 'border-[#DDD5C5] dark:border-[#2C303B]'
            }`}
          >
            <input
              ref={composerFileRef}
              type="file"
              multiple
              accept={SUPPORTED_DOC_AND_MEDIA_ACCEPT}
              onChange={(e) => {
                if (e.target.files?.length) void handleComposerFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <button
              type="button"
              disabled={isExtractingFiles}
              onClick={() => composerFileRef.current?.click()}
              className="relative p-2 rounded-xl text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] hover:text-[#17191C] dark:hover:text-[#EFECE4] disabled:opacity-50 transition-colors shrink-0"
              title="한글(.hwpx/.hwp)·PPT(.pptx)·워드(.docx)·PDF·엑셀·사진 여러 개 첨부 (드래그 앤 드롭 · Ctrl+V 가능)"
              aria-label="문서, PPT 또는 사진 첨부"
            >
              {isExtractingFiles ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPromptsModalOpen(true)}
              className="p-2 rounded-xl text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors shrink-0"
              title="저장한 프롬프트 불러오기"
              aria-label="저장한 프롬프트 불러오기"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder={
                isListening
                  ? '말씀하시는 내용을 듣고 있습니다...'
                  : isPerformanceMode
                    ? '수행평가 주제·조건·내 초안을 입력하거나, 안내문/루브릭 사진을 여러 장 올려보세요...'
                    : isSolveOnly
                      ? '문제를 붙여넣거나 "이 단원 문제 3개 풀이과정만"처럼 입력해 보세요...'
                      : workspace.placeholder
              }
              className="flex-1 min-w-0 max-h-36 bg-transparent py-1.5 px-1 study-chat-text text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none resize-none leading-relaxed"
            />

            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
              }`}
              title={isListening ? '음성 입력 멈추기' : '마이크로 말해서 입력하기'}
              aria-label={isListening ? '음성 입력 멈추기' : '마이크로 말해서 입력하기'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {!isSearchStudio && (
              <button
                type="button"
                onClick={() => {
                  const next = !voiceAutoRead;
                  setVoiceAutoRead(next);
                  if (!next) stopSpeaking();
                }}
                className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-medium transition-colors shrink-0 whitespace-nowrap ${
                  voiceAutoRead
                    ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215]'
                    : 'text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832]'
                }`}
                title="켜두면 AI가 답변을 완료할 때마다 음성으로 읽어줍니다"
              >
                {voiceAutoRead ? (
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>음성 답변</span>
              </button>
            )}

            {inputText.trim() && (
              <button
                type="button"
                onClick={handleSaveCurrentInputAsPrompt}
                className="p-2 rounded-xl text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors shrink-0"
                title="입력 중인 프롬프트 저장하기"
                aria-label="입력 중인 프롬프트 저장하기"
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
            )}

            {activeSession.messages.length > 0 && !isStreaming && (
              <button
                type="button"
                onClick={handleNewNote}
                className="hidden sm:inline-flex p-2 rounded-xl text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] transition-colors shrink-0"
                title="새 노트로 초기화"
                aria-label="새 노트로 초기화"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              disabled={isStreaming || (!inputText.trim() && attachments.length === 0)}
              onClick={() => sendMessage()}
              className="p-2 rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
              aria-label="전송"
            >
              {isSearchStudio ? <Search className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#7A7D86] dark:text-[#7D7970] px-1">
            <span>
              {isSearchStudio
                ? 'Enter 검색 · 문서/PPT/사진 첨부 후 관련 사이트 검색 가능'
                : 'Enter 전송 · 한글(.hwpx/.hwp)·PPT·워드·PDF·사진 첨부 지원 · 음성 대화'}
            </span>
            <span>
              {currentProfile.isGuest ? '게스트 저장 중' : `${currentProfile.name} Google 계정 동기화`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-screen w-screen overflow-hidden flex bg-[#FAF7F0] dark:bg-[#111215] text-[#17191C] dark:text-[#EFECE4]">
        <Sidebar
          activeView={activeView}
          activeWorkspaceId={activeWorkspaceId}
          activeSubTrackId={activeSession.subTrackId}
          activeSessionId={activeSession.id}
          sessions={sessions}
          savedPromptCount={savedPrompts.length}
          savedStudyNoteCount={savedStudyNotes.length}
          currentProfile={currentProfile}
          isDark={isDark}
          fontSize={fontSize}
          answerFont={answerFont}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onGoLobby={() => {
            if (!isStreaming) {
              stopVoiceAndSpeech();
              setActiveView('lobby');
            }
          }}
          onSelectWorkspace={(id) => handleSelectWorkspace(id)}
          onOpenMakerWorkspace={handleOpenMakerWorkspace}
          onSelectSession={handleSelectSession}
          onTogglePinSession={handleTogglePinSession}
          onDeleteSession={handleDeleteSession}
          onNewNote={handleNewNote}
          onToggleDark={() => setIsDark((prev) => !prev)}
          onOpenDisplaySettings={() => setDisplaySettingsOpen(true)}
          onOpenProfileModal={() => setProfileModalOpen(true)}
          onOpenCareerModal={() => setCareerModalOpen(true)}
          onOpenPromptsModal={() => setPromptsModalOpen(true)}
          onOpenStudyNotesModal={() => setStudyNotesModalOpen(true)}
        />

        <main className="flex-1 min-w-0 flex flex-col h-full">
          {cloudSyncNotice && (
            <div className="shrink-0 px-4 lg:px-8 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="leading-snug">{cloudSyncNotice}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCloudSyncNotice(null);
                    setCloudSyncRetryTick((t) => t + 1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-900/10 dark:bg-amber-200/15 hover:bg-amber-900/20 dark:hover:bg-amber-200/25 font-medium transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>다시 시도</span>
                </button>
                {!currentProfile.isGuest && (
                  <button
                    type="button"
                    onClick={() => void handleGoogleSignOut()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-900/10 dark:bg-amber-200/15 hover:bg-amber-900/20 dark:hover:bg-amber-200/25 font-medium transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>로그아웃</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCloudSyncNotice(null)}
                  className="p-1 rounded-lg hover:bg-amber-900/10 dark:hover:bg-amber-200/15 transition-colors"
                  aria-label="알림 닫기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {activeView === 'lobby' ? (
            <LobbyView
              currentProfile={currentProfile}
              gradeLevel={activeSession.gradeLevel}
              sessions={sessions}
              savedStudyNoteCount={savedStudyNotes.length}
              savedPromptCount={savedPrompts.length}
              connectCareer={connectCareer}
              isDark={isDark}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onSelectWorkspace={(id, modeOverride) =>
                handleSelectWorkspace(id, false, modeOverride)
              }
              onOpenMakerWorkspace={handleOpenMakerWorkspace}
              onSelectSession={handleSelectSession}
              onChangeGradeLevel={(gradeLevel) => {
                updateCurrentProfile({ gradeLevel });
                setActiveSession((prev) => ({
                  ...prev,
                  gradeLevel,
                  subTrackId: getDefaultSubTrack(prev.workspaceId, gradeLevel),
                }));
              }}
              onSaveCareerGoal={handleSaveCareerGoal}
              onToggleConnectCareer={handleToggleConnectCareer}
              onOpenCareerModal={() => setCareerModalOpen(true)}
              onOpenProfileModal={() => setProfileModalOpen(true)}
              onOpenStudyNotesModal={() => setStudyNotesModalOpen(true)}
              onOpenPromptsModal={() => setPromptsModalOpen(true)}
              onOpenDisplaySettings={() => setDisplaySettingsOpen(true)}
              onToggleDark={() => setIsDark((prev) => !prev)}
            />
          ) : (
            <>
              <WorkspaceHeader
                workspace={workspace}
                activeSubTrackId={activeSession.subTrackId}
                gradeLevel={activeSession.gradeLevel}
                studyMode={activeSession.studyMode}
                thinkingDepth={activeSession.thinkingDepth || 'standard'}
                careerGoal={currentProfile.careerGoal}
                connectCareer={connectCareer}
                isDark={isDark}
                canGenerateQuiz={canGenerateQuiz}
                onOpenMobileMenu={() => setMobileMenuOpen(true)}
                onGoLobby={() => {
                  if (!isStreaming) {
                    stopVoiceAndSpeech();
                    setActiveView('lobby');
                  }
                }}
                onSelectSubTrack={(subTrackId) =>
                  upsertSession({ ...activeSession, subTrackId })
                }
                onChangeGradeLevel={(gradeLevel) =>
                  upsertSession({
                    ...activeSession,
                    gradeLevel,
                    subTrackId: getDefaultSubTrack(activeWorkspaceId, gradeLevel),
                  })
                }
                onChangeStudyMode={(studyMode) =>
                  upsertSession({ ...activeSession, studyMode })
                }
                onToggleThinkingDepth={() =>
                  upsertSession({
                    ...activeSession,
                    thinkingDepth:
                      (activeSession.thinkingDepth || 'standard') === 'deep'
                        ? 'standard'
                        : 'deep',
                  })
                }
                onToggleConnectCareer={handleToggleConnectCareer}
                onOpenCareerModal={() => setCareerModalOpen(true)}
                onOpenQuiz={generateQuiz}
                onOpenFlashcards={generateFlashcards}
                onConvertConversationToArtifact={handleConvertConversationToArtifact}
                onNewNote={handleNewNote}
                onOpenDisplaySettings={() => setDisplaySettingsOpen(true)}
                onToggleDark={() => setIsDark((prev) => !prev)}
              />

              <div className="flex-1 min-h-0 notebook-canvas-pattern">
                {isSplitStudio ? (
                  <div className="h-full flex flex-col lg:flex-row min-h-0">
                    <div
                      className={
                        studioCollapsed
                          ? 'shrink-0 px-4 pt-3 pb-1 lg:p-4 lg:w-16 lg:border-r border-[#E6DFD1] dark:border-[#272A33]'
                          : 'shrink-0 lg:w-[42%] p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-[#E6DFD1] dark:border-[#272A33] min-h-0 max-h-[46vh] lg:max-h-none overflow-hidden'
                      }
                    >
                      <StudioSplitPane
                        mode={activeWorkspaceId as 'doc-summary' | 'photo-analysis'}
                        studyMode={activeSession.studyMode}
                        attachments={attachments}
                        isLoading={isStreaming}
                        isCollapsed={studioCollapsed}
                        onToggleCollapse={() => setStudioCollapsed((prev) => !prev)}
                        onSetAttachments={setAttachments}
                        onQuickAnalyze={(p, overrideAtts) => sendMessage(p, overrideAtts)}
                        onConvertAttachments={(fmt) =>
                          handleConvertAttachmentsWithPrompt(fmt, attachments)
                        }
                      />
                    </div>
                    <div className="flex-1 min-h-0 h-full">{chatPane}</div>
                  </div>
                ) : (
                  chatPane
                )}
              </div>
            </>
          )}
        </main>

        <QuizModal
          isOpen={quizOpen}
          isLoading={quizLoading}
          error={quizError}
          questions={quizQuestions}
          subjectName={workspace.name}
          onClose={() => setQuizOpen(false)}
          onRetry={generateQuiz}
        />

        <FlashcardsModal
          isOpen={flashcardsOpen}
          isLoading={flashcardsLoading}
          error={flashcardsError}
          cards={flashcards}
          subjectName={workspace.name}
          workspaceId={activeWorkspaceId}
          subTrackId={activeSession.subTrackId}
          onClose={() => setFlashcardsOpen(false)}
          onRegenerate={generateFlashcards}
        />

        <StudyNotesModal
          isOpen={studyNotesModalOpen}
          notes={savedStudyNotes}
          onClose={() => setStudyNotesModalOpen(false)}
          onToggleMastered={(id) => {
            const target = savedStudyNotes.find((n) => n.id === id);
            const nextMastered = !target?.mastered;
            setSavedStudyNotes((prev) =>
              prev.map((n) => (n.id === id ? { ...n, mastered: !n.mastered } : n))
            );
            if (!currentProfile.isGuest) {
              void toggleStudyNoteMasteredInCloud(
                currentProfile.id,
                id,
                nextMastered
              ).catch(handleCloudError);
            }
          }}
          onDeleteNote={(id) => {
            setSavedStudyNotes((prev) => prev.filter((n) => n.id !== id));
            if (!currentProfile.isGuest) {
              void deleteStudyNoteFromCloud(currentProfile.id, id).catch(handleCloudError);
            }
          }}
        />

        <ProfileModal
          isOpen={profileModalOpen}
          currentProfile={currentProfile}
          guestNotebookCount={loadSessionsForProfile('guest').length}
          authLoading={authLoading}
          authError={authError}
          onClose={() => {
            setAuthError(null);
            setProfileModalOpen(false);
          }}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
          onChangeGradeLevel={(gradeLevel) => {
            updateCurrentProfile({ gradeLevel });
            setActiveSession((prev) => ({
              ...prev,
              gradeLevel,
              subTrackId: getDefaultSubTrack(prev.workspaceId, gradeLevel),
            }));
          }}
        />

        <CareerModal
          isOpen={careerModalOpen}
          currentCareerGoal={currentProfile.careerGoal}
          onClose={() => setCareerModalOpen(false)}
          onSaveCareerGoal={handleSaveCareerGoal}
        />

        <PromptsModal
          isOpen={promptsModalOpen}
          activeWorkspaceId={activeWorkspaceId}
          prompts={savedPrompts}
          onClose={() => setPromptsModalOpen(false)}
          onUsePrompt={(prompt) => {
            if (prompt.workspaceId !== 'all' && prompt.workspaceId !== activeWorkspaceId) {
              handleSelectWorkspace(prompt.workspaceId, true);
            }
            setInputText(prompt.content);
          }}
          onAddPrompt={handleAddPrompt}
          onDeletePrompt={(id) => {
            setSavedPrompts((prev) => prev.filter((item) => item.id !== id));
            if (!currentProfile.isGuest) {
              void deletePromptFromCloud(currentProfile.id, id).catch(handleCloudError);
            }
          }}
        />

        <DisplaySettingsModal
          isOpen={displaySettingsOpen}
          fontSize={fontSize}
          answerFont={answerFont}
          onClose={() => setDisplaySettingsOpen(false)}
          onChangeFontSize={setFontSize}
          onChangeAnswerFont={setAnswerFont}
          onResetDefaults={() => {
            setFontSize('md');
            setAnswerFont('sans');
          }}
        />
      </div>
    </MotionConfig>
  );
}
