export type WorkspaceId =
  | 'korean'
  | 'math'
  | 'english'
  | 'science'
  | 'social'
  | 'history'
  | 'foreign'
  | 'informatics'
  | 'free-chat'
  | 'doc-summary'
  | 'photo-analysis'
  | 'resource-search'
  | 'doc-maker'
  | 'ppt-maker';

export type GradeLevel = 'middle' | 'high';
export type StudyMode = 'tutor' | 'fast' | 'solve-only' | 'performance';
export type ThinkingDepth = 'standard' | 'deep';
export type FontSizePreset = 'sm' | 'md' | 'lg' | 'xl';
export type AnswerFontPreset = 'sans' | 'plex' | 'serif' | 'gowun' | 'handwriting';

export interface SubTrack {
  id: string;
  label: string;
  description: string;
  gradeHint?: GradeLevel;
}

export interface WorkspaceConfig {
  id: WorkspaceId;
  category: 'subject' | 'studio';
  name: string;
  shortDesc: string;
  accentLight: string;
  accentDark: string;
  accentTextLight: string;
  accentTextDark: string;
  subTracks?: SubTrack[];
  quickPrompts: string[];
  placeholder: string;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
  previewUrl?: string;
  sizeBytes: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatAttachmentMeta {
  name: string;
  mimeType: string;
  previewUrl?: string;
  textSnippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  attachment?: ChatAttachmentMeta;
  attachments?: ChatAttachmentMeta[];
  sources?: GroundingSource[];
  generatedDocument?: GeneratedDocumentPayload;
  requestedFormat?: ExportFormat;
  error?: boolean;
}

export interface NotebookSession {
  id: string;
  workspaceId: WorkspaceId;
  subTrackId?: string;
  gradeLevel: GradeLevel;
  studyMode: StudyMode;
  thinkingDepth?: ThinkingDepth;
  title: string;
  messages: ChatMessage[];
  pinned?: boolean;
  updatedAt: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  workspaceId: WorkspaceId | 'all';
  createdAt: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  subTrackId?: string;
  sessionId: string;
  createdAt: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface FlashcardItem {
  front: string;
  hint: string;
  back: string;
  example: string;
}

export interface SavedStudyNote {
  id: string;
  workspaceId: WorkspaceId;
  subTrackLabel?: string;
  gradeLevel: GradeLevel;
  title: string;
  content: string;
  mastered: boolean;
  createdAt: number;
}

export interface StudentProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  authProvider?: 'google' | 'guest';
  gradeLevel: GradeLevel;
  careerGoal?: string;
  careerPromptDismissed?: boolean;
  isGuest: boolean;
  createdAt: number;
}

export type ExportFormat = 'pdf' | 'hwpx' | 'docx' | 'pptx';
export type DocumentTemplateKind = 'study-note' | 'report' | 'presentation';
export type PptThemeId =
  | 'ivory'
  | 'navy'
  | 'sage'
  | 'terracotta'
  | 'cobalt'
  | 'editorial'
  | 'lavender';
export type PptDensity = 'concise' | 'balanced' | 'rich';
export type PptDesignStyle = 'auto' | 'infographic' | 'analytical' | 'editorial';
export type PptCoverStyle = 'split' | 'modern' | 'framed' | 'minimal';

export interface StructuredDocSection {
  heading: string;
  summary?: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

export interface StructuredDocumentData {
  kind: 'document';
  title: string;
  subtitle: string;
  subjectLabel: string;
  authorLine: string;
  overview: string;
  sections: StructuredDocSection[];
  conclusion?: string;
}

export interface SlideCardItem {
  title: string;
  body: string;
  tag?: string;
}

export interface SlideStepItem {
  step: string;
  title: string;
  detail: string;
}

export interface SlideStatItem {
  value: string;
  label: string;
  note?: string;
}

export type SlideLayoutType =
  | 'title'
  | 'agenda'
  | 'bullets'
  | 'two-column'
  | 'cards'
  | 'timeline'
  | 'stats'
  | 'table'
  | 'quote'
  | 'summary';

export interface StructuredSlide {
  layout: SlideLayoutType;
  title: string;
  subtitle?: string;
  kicker?: string;
  bullets: string[];
  leftTitle?: string;
  rightTitle?: string;
  rightBullets?: string[];
  cards?: SlideCardItem[];
  steps?: SlideStepItem[];
  stats?: SlideStatItem[];
  quoteText?: string;
  quoteAuthor?: string;
  callout?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
  speakerNotes?: string;
}

export interface StructuredPresentationData {
  kind: 'presentation';
  title: string;
  subtitle: string;
  subjectLabel: string;
  authorLine: string;
  themeId?: PptThemeId;
  density?: PptDensity;
  designStyle?: PptDesignStyle;
  coverStyle?: PptCoverStyle;
  slides: StructuredSlide[];
}

export type GeneratedDocumentPayload =
  | StructuredDocumentData
  | StructuredPresentationData;

