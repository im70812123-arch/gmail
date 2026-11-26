import React, { useState } from 'react';
import {
  Bookmark,
  BookMarked,
  Check,
  ChevronRight,
  Compass,
  Download,
  FileOutput,
  FileText,
  Home,
  Loader2,
  Moon,
  Pin,
  Plus,
  Presentation,
  Sun,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';
import { WORKSPACES, WORKSPACE_MAP } from '../data/subjects';
import type {
  AnswerFontPreset,
  FontSizePreset,
  NotebookSession,
  StudentProfile,
  WorkspaceId,
} from '../types/study';
import { downloadGithubProjectZip } from '../utils/projectExport';
import { getAnswerFontOption, getFontSizeOption } from '../utils/typography';
import { SubjectIcon } from './SubjectIcon';

interface SidebarProps {
  activeView: 'lobby' | 'workspace';
  activeWorkspaceId: WorkspaceId;
  activeSubTrackId?: string;
  activeSessionId: string;
  sessions: NotebookSession[];
  savedPromptCount: number;
  savedStudyNoteCount: number;
  currentProfile: StudentProfile;
  fontSize: FontSizePreset;
  answerFont: AnswerFontPreset;
  isDark: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onGoLobby: () => void;
  onSelectWorkspace: (id: WorkspaceId) => void;
  onOpenMakerWorkspace: (id: 'doc-maker' | 'ppt-maker', subTrackId: string) => void;
  onSelectSession: (session: NotebookSession) => void;
  onTogglePinSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewNote: () => void;
  onToggleDark: () => void;
  onOpenDisplaySettings: () => void;
  onOpenProfileModal: () => void;
  onOpenCareerModal: () => void;
  onOpenPromptsModal: () => void;
  onOpenStudyNotesModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  activeWorkspaceId,
  activeSubTrackId,
  activeSessionId,
  sessions,
  savedPromptCount,
  savedStudyNoteCount,
  currentProfile,
  fontSize,
  answerFont,
  isDark,
  mobileOpen,
  onCloseMobile,
  onGoLobby,
  onSelectWorkspace,
  onOpenMakerWorkspace,
  onSelectSession,
  onTogglePinSession,
  onDeleteSession,
  onNewNote,
  onToggleDark,
  onOpenDisplaySettings,
  onOpenProfileModal,
  onOpenCareerModal,
  onOpenPromptsModal,
  onOpenStudyNotesModal,
}) => {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'subject' | 'search'>('all');
  const [exportingZip, setExportingZip] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportZip = async () => {
    if (exportingZip) return;
    setExportingZip(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      await downloadGithubProjectZip();
      setExportSuccess(true);
      window.setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : '압축 파일 다운로드 중 오류가 발생했습니다.'
      );
    } finally {
      setExportingZip(false);
    }
  };

  const subjectWorkspaces = WORKSPACES.filter((w) => w.category === 'subject');
  const studioWorkspaces = WORKSPACES.filter(
    (w) => w.category === 'studio' && w.id !== 'doc-maker' && w.id !== 'ppt-maker'
  );

  const nonEmptySessions = sessions.filter((s) => s.messages.length > 0);
  const filteredHistory = nonEmptySessions
    .filter((s) => {
      if (historyFilter === 'search') return s.workspaceId === 'resource-search';
      if (historyFilter === 'subject') return s.workspaceId !== 'resource-search';
      return true;
    })
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 30);

  const formatShortTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F2EDE3] dark:bg-[#16181C] border-r border-[#E6DFD1] dark:border-[#272A33] text-[#17191C] dark:text-[#EFECE4] select-none">
      {/* Minimalist Brand Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#E6DFD1] dark:border-[#272A33] shrink-0">
        <button
          type="button"
          onClick={() => {
            onGoLobby();
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition-opacity"
          title="학습 로비로 이동"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-[#17191C] dark:text-[#EFECE4]"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="3"
              width="16"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M8.5 3V21"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeOpacity="0.45"
            />
            <path
              d="M11.5 9H16.5M11.5 13H15.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display text-[15px] font-bold tracking-[0.02em] whitespace-nowrap shrink-0">
            STUDY:ON
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewNote}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FFFEFA] dark:bg-[#20232B] border border-[#E2DAC9] dark:border-[#2E323D] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#FAF7F0] dark:hover:bg-[#272B35] transition-colors whitespace-nowrap shrink-0"
            title="새 학습 노트 열기"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 노트</span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-[#5A5E66] dark:text-[#9D998E] hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="메뉴 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Lobby Entry */}
        <div>
          <button
            type="button"
            onClick={() => {
              onGoLobby();
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
              activeView === 'lobby'
                ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] font-semibold shadow-xs'
                : 'text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#E7E0D3]/80 dark:hover:bg-[#20232A]'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="truncate whitespace-nowrap">학습 로비 (홈)</span>
          </button>
        </div>

        {/* Free Chat, Multimodal & Search Studios */}
        <div>
          <div className="px-2.5 mb-2 text-[11px] font-semibold text-[#686C75] dark:text-[#8E8A80]">
            AI 대화 · 자료 도구
          </div>
          <div className="space-y-0.5">
            {studioWorkspaces.map((item) => {
              const active = activeView === 'workspace' && activeWorkspaceId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
                    active
                      ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] font-semibold shadow-xs'
                      : 'text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#E7E0D3]/80 dark:hover:bg-[#20232A]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <SubjectIcon id={item.id} className="w-4 h-4 shrink-0" />
                    <span className="truncate whitespace-nowrap">{item.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversational Document, Hangul (.hwpx), PDF & PPT AI Makers */}
        <div>
          <div className="px-2.5 mb-2 text-[11px] font-semibold text-[#686C75] dark:text-[#8E8A80]">
            한글 · PPT · 문서 제작 AI
          </div>
          <div className="space-y-0.5">
            {(() => {
              const hwpxActive =
                activeView === 'workspace' &&
                activeWorkspaceId === 'doc-maker' &&
                activeSubTrackId !== 'pdf';
              const pptActive =
                activeView === 'workspace' && activeWorkspaceId === 'ppt-maker';
              const pdfActive =
                activeView === 'workspace' &&
                activeWorkspaceId === 'doc-maker' &&
                activeSubTrackId === 'pdf';

              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMakerWorkspace('doc-maker', 'hwpx');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
                      hwpxActive
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] font-semibold shadow-xs'
                        : 'text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#E7E0D3]/80 dark:hover:bg-[#20232A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate whitespace-nowrap">한글 문서 만들기 AI</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono-code shrink-0 ${
                        hwpxActive
                          ? 'text-[#FAF7F0]/75 dark:text-[#111215]/75'
                          : 'text-[#787B84] dark:text-[#848077]'
                      }`}
                    >
                      .hwpx
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenMakerWorkspace('ppt-maker', 'class-ppt');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
                      pptActive
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] font-semibold shadow-xs'
                        : 'text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#E7E0D3]/80 dark:hover:bg-[#20232A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Presentation className="w-4 h-4 shrink-0" />
                      <span className="truncate whitespace-nowrap">PPT 발표자료 만들기 AI</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono-code shrink-0 ${
                        pptActive
                          ? 'text-[#FAF7F0]/75 dark:text-[#111215]/75'
                          : 'text-[#787B84] dark:text-[#848077]'
                      }`}
                    >
                      .pptx
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenMakerWorkspace('doc-maker', 'pdf');
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
                      pdfActive
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] font-semibold shadow-xs'
                        : 'text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#E7E0D3]/80 dark:hover:bg-[#20232A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FileOutput className="w-4 h-4 shrink-0" />
                      <span className="truncate whitespace-nowrap">PDF · 워드 만들기 AI</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono-code shrink-0 ${
                        pdfActive
                          ? 'text-[#FAF7F0]/75 dark:text-[#111215]/75'
                          : 'text-[#787B84] dark:text-[#848077]'
                      }`}
                    >
                      .pdf/.docx
                    </span>
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        {/* 8 Core School Subjects */}
        <div>
          <div className="px-2.5 mb-2 text-[11px] font-semibold text-[#686C75] dark:text-[#8E8A80]">
            전 과목 전문 튜터
          </div>
          <div className="space-y-0.5">
            {subjectWorkspaces.map((item) => {
              const active = activeView === 'workspace' && activeWorkspaceId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 text-left ${
                    active
                      ? 'bg-[#FFFEFA] dark:bg-[#22252E] text-[#17191C] dark:text-[#EFECE4] font-semibold border border-[#E0D8C8] dark:border-[#323643] shadow-[0_1px_2px_rgba(23,25,28,0.04)]'
                      : 'text-[#393C44] dark:text-[#C5C1B7] hover:bg-[#E7E0D3]/70 dark:hover:bg-[#1E2027] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <SubjectIcon
                      id={item.id}
                      className={`w-4 h-4 shrink-0 ${active ? 'opacity-100' : 'opacity-75'}`}
                    />
                    <span className="truncate whitespace-nowrap">{item.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Conversations & Search History */}
        <div>
          <div className="px-2.5 mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#686C75] dark:text-[#8E8A80]">
              최근 대화 · 검색 기록
            </span>
            {nonEmptySessions.length > 0 && (
              <span className="text-[11px] font-mono-code text-[#8A8D95]">
                {nonEmptySessions.length}
              </span>
            )}
          </div>

          {nonEmptySessions.length > 0 && (
            <div className="grid grid-cols-3 gap-0.5 p-0.5 mb-2 rounded-lg bg-[#E8E2D6] dark:bg-[#1C1F26]">
              <button
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  historyFilter === 'all'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-2xs'
                    : 'text-[#686C75] dark:text-[#8E8A80]'
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('subject')}
                className={`py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  historyFilter === 'subject'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-2xs'
                    : 'text-[#686C75] dark:text-[#8E8A80]'
                }`}
              >
                질문·노트
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('search')}
                className={`py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  historyFilter === 'search'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-2xs'
                    : 'text-[#686C75] dark:text-[#8E8A80]'
                }`}
              >
                검색
              </button>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-[#8A8D95] dark:text-[#7A776E] leading-relaxed">
              {nonEmptySessions.length === 0
                ? '대화를 시작하면 자동으로 저장되어 언제든 이어서 볼 수 있습니다.'
                : '해당 분류의 기록이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredHistory.map((session) => {
                const isSelected = session.id === activeSessionId;
                const subjectName = WORKSPACE_MAP[session.workspaceId]?.name ?? '노트';
                const messageCount = Math.ceil(session.messages.length / 2);
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#E5DEC9]/90 dark:bg-[#232630] text-[#17191C] dark:text-[#EFECE4] font-medium'
                        : 'text-[#4C5059] dark:text-[#A39F95] hover:bg-[#E7E0D3]/60 dark:hover:bg-[#1D1F26]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(session);
                        onCloseMobile();
                      }}
                      className="flex-1 min-w-0 text-left py-0.5"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {session.pinned && (
                          <Pin className="w-3 h-3 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
                        )}
                        <span className="truncate">{session.title}</span>
                      </div>
                      <div className="text-[11px] text-[#7A7D86] dark:text-[#7D7970] truncate mt-0.5 font-mono-code">
                        {subjectName} · {messageCount}문답 · {formatShortTime(session.updatedAt)}
                      </div>
                    </button>

                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinSession(session.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          session.pinned
                            ? 'text-[#17191C] dark:text-[#EFECE4]'
                            : 'text-[#7A7D86] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                        }`}
                        title={session.pinned ? '고정 해제' : '상단 고정'}
                        aria-label={session.pinned ? '고정 해제' : '상단 고정'}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="p-1 rounded text-[#7A7D86] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="기록 삭제"
                        aria-label="기록 삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unified Minimalist Footer Dock */}
      <div className="border-t border-[#E6DFD1] dark:border-[#272A33] px-3 py-2 space-y-0.5 shrink-0 bg-[#EFEAE0]/60 dark:bg-[#14161A]">
        <button
          type="button"
          onClick={() => {
            onOpenStudyNotesModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors text-left"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <BookMarked className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
            <span className="text-xs font-medium truncate">오답 · 핵심노트</span>
          </span>
          <span className="text-[11px] font-mono-code text-[#787B84] dark:text-[#848077] shrink-0">
            {savedStudyNoteCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenPromptsModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors text-left"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Bookmark className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
            <span className="text-xs font-medium truncate">저장한 프롬프트</span>
          </span>
          <span className="text-[11px] font-mono-code text-[#787B84] dark:text-[#848077] shrink-0">
            {savedPromptCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenCareerModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">
                {currentProfile.careerGoal ? currentProfile.careerGoal : '진로 · 학과 설정'}
              </div>
              <div className="text-[11px] text-[#787B84] dark:text-[#848077] truncate">
                {currentProfile.careerGoal ? '희망 진로 연계 중' : '진로 맞춤 답변 받기'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#8A8D95]" />
        </button>

        <button
          type="button"
          onClick={onOpenProfileModal}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {currentProfile.photoURL ? (
              <img
                src={currentProfile.photoURL}
                alt={currentProfile.name}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover shrink-0 border border-[#D8D0C0] dark:border-[#323643]"
              />
            ) : (
              <User className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{currentProfile.name}</div>
              <div className="text-[11px] text-[#787B84] dark:text-[#848077] truncate">
                {currentProfile.isGuest
                  ? '비로그인 · Google 로그인'
                  : currentProfile.email || 'Google 계정 동기화 중'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#8A8D95]" />
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenDisplaySettings();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4C5059] dark:text-[#C5C1B7] hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors text-left"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Type className="w-4 h-4 shrink-0" />
            <span className="truncate">글씨 크기 · 글씨체</span>
          </span>
          <span className="text-[11px] text-[#787B84] dark:text-[#848077] truncate max-w-[96px]">
            {getFontSizeOption(fontSize).label} · {getAnswerFontOption(answerFont).label}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleDark}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4C5059] dark:text-[#C5C1B7] hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] transition-colors"
        >
          <span className="flex items-center gap-2.5 whitespace-nowrap">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? '웜 아이보리 모드' : '다크 모드'}</span>
          </span>
        </button>

        <button
          type="button"
          disabled={exportingZip}
          onClick={handleExportZip}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4C5059] dark:text-[#C5C1B7] hover:bg-[#E6DFD1]/70 dark:hover:bg-[#20232B] disabled:opacity-60 transition-colors text-left"
          title="GitHub 배포용 전체 프로젝트 파일(.zip) 다운로드"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {exportingZip ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate whitespace-nowrap">프로젝트 파일 다운로드</span>
          </span>
          <span className="text-[11px] font-mono-code text-[#787B84] dark:text-[#848077] shrink-0 whitespace-nowrap">
            {exportingZip ? '압축 중' : exportSuccess ? '완료' : '.zip'}
          </span>
        </button>

        {exportError && (
          <div className="px-2.5 py-1 text-[11px] text-rose-600 dark:text-rose-400 leading-snug">
            {exportError}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[268px] shrink-0 h-full">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-72 max-w-[82vw] h-full">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
};
