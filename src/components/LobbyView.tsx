import React, { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookMarked,
  Check,
  Compass,
  Download,
  FileOutput,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Loader2,
  Menu,
  MessageCircle,
  MessageSquareText,
  Moon,
  Presentation,
  Search,
  Sparkles,
  Sun,
  Type,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { CAREER_PRESETS, WORKSPACES, WORKSPACE_MAP } from '../data/subjects';
import type {
  GradeLevel,
  NotebookSession,
  StudentProfile,
  WorkspaceId,
} from '../types/study';
import { downloadGithubProjectZip } from '../utils/projectExport';
import { SubjectIcon } from './SubjectIcon';

interface LobbyViewProps {
  currentProfile: StudentProfile;
  gradeLevel: GradeLevel;
  sessions: NotebookSession[];
  savedStudyNoteCount: number;
  savedPromptCount: number;
  connectCareer: boolean;
  isDark: boolean;
  onOpenMobileMenu: () => void;
  onSelectWorkspace: (id: WorkspaceId, studyModeOverride?: 'fast' | 'performance') => void;
  onSelectSession: (session: NotebookSession) => void;
  onChangeGradeLevel: (grade: GradeLevel) => void;
  onSaveCareerGoal: (goal: string) => void;
  onToggleConnectCareer: () => void;
  onOpenCareerModal: () => void;
  onOpenProfileModal: () => void;
  onOpenStudyNotesModal: () => void;
  onOpenPromptsModal: () => void;
  onOpenMakerWorkspace: (id: 'doc-maker' | 'ppt-maker', subTrackId: string) => void;
  onOpenDisplaySettings: () => void;
  onToggleDark: () => void;
}

function getGreetingByHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후예요';
  return '열공하는 저녁이에요';
}

function stripMarkdownPreview(raw: string): string {
  return raw
    .replace(/\[\[SWITCH:[a-z-]+\]\]/g, '')
    .replace(/\[\[DOC_READY:[^\]\n]+\]\]/g, '')
    .replace(/```[\s\S]*?```/g, ' [코드] ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatRelativeTime(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  currentProfile,
  gradeLevel,
  sessions,
  savedStudyNoteCount,
  savedPromptCount,
  connectCareer,
  isDark,
  onOpenMobileMenu,
  onSelectWorkspace,
  onSelectSession,
  onChangeGradeLevel,
  onSaveCareerGoal,
  onToggleConnectCareer,
  onOpenCareerModal,
  onOpenProfileModal,
  onOpenStudyNotesModal,
  onOpenPromptsModal,
  onOpenMakerWorkspace,
  onOpenDisplaySettings,
  onToggleDark,
}) => {
  const [careerDraft, setCareerDraft] = useState('');
  const [subjectEntryMode, setSubjectEntryMode] = useState<'general' | 'performance'>('general');
  const [exportingZip, setExportingZip] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportProjectZip = async () => {
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
        err instanceof Error ? err.message : '프로젝트 파일 압축 다운로드 중 오류가 발생했습니다.'
      );
    } finally {
      setExportingZip(false);
    }
  };

  const subjectWorkspaces = WORKSPACES.filter((w) => w.category === 'subject');
  const studioWorkspaces = WORKSPACES.filter(
    (w) => w.category === 'studio' && w.id !== 'doc-maker' && w.id !== 'ppt-maker'
  );

  const recentAnsweredSessions = sessions
    .filter((s) => s.messages.some((m) => m.role === 'assistant' && !m.error && m.content.trim()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  const sessionCountByWorkspace = sessions.reduce<Record<string, number>>((acc, s) => {
    if (s.messages.length > 0) {
      acc[s.workspaceId] = (acc[s.workspaceId] || 0) + 1;
    }
    return acc;
  }, {});

  const totalSessionsCount = Object.values(sessionCountByWorkspace).reduce((a, b) => a + b, 0);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#FAF7F0] dark:bg-[#111215] notebook-canvas-pattern">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0]/90 dark:bg-[#111215]/90 backdrop-blur-md px-4 lg:px-10">
        <div className="max-w-6xl mx-auto h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 -ml-1.5 rounded-lg text-[#17191C] dark:text-[#EFECE4] hover:bg-[#EAE4D7] dark:hover:bg-[#1E2027]"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-[15px] font-bold tracking-[0.015em] text-[#17191C] dark:text-[#EFECE4] whitespace-nowrap shrink-0">
              STUDY:ON <span className="font-medium text-[#686C75] dark:text-[#8E8A80]">· 학습 로비</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1B1D24] border border-[#E6DFD1] dark:border-[#272A33]"
              role="group"
              aria-label="학교급 선택"
            >
              <button
                type="button"
                onClick={() => onChangeGradeLevel('middle')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                  gradeLevel === 'middle'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                중등
              </button>
              <button
                type="button"
                onClick={() => onChangeGradeLevel('high')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                  gradeLevel === 'high'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                고등
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenProfileModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                currentProfile.isGuest
                  ? 'border-[#17191C] dark:border-[#EFECE4] bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90'
                  : 'border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E]'
              }`}
            >
              {currentProfile.photoURL ? (
                <img
                  src={currentProfile.photoURL}
                  alt={currentProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <User className="w-3.5 h-3.5 shrink-0 opacity-80" />
              )}
              <span className="max-w-[110px] truncate">
                {currentProfile.isGuest ? 'Google 로그인' : currentProfile.name}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDisplaySettings}
              className="p-2 rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#4C5059] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors shrink-0"
              title="글씨 크기 · 답변 글씨체 설정"
              aria-label="글씨 크기 · 답변 글씨체 설정"
            >
              <Type className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleDark}
              className="p-2 rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#4C5059] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors shrink-0"
              title={isDark ? '웜 아이보리 모드로 전환' : '다크 모드로 전환'}
              aria-label={isDark ? '웜 아이보리 모드로 전환' : '다크 모드로 전환'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Lobby Content */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-6xl mx-auto px-4 lg:px-10 py-7 lg:py-9 space-y-9"
      >
        {/* Greeting Hero Row */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {currentProfile.photoURL ? (
              <img
                src={currentProfile.photoURL}
                alt={currentProfile.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-[#E6DFD1] dark:border-[#272A33] shadow-[0_6px_20px_-8px_rgba(23,25,28,0.28)]"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] flex items-center justify-center shrink-0 shadow-[0_6px_20px_-8px_rgba(23,25,28,0.28)]">
                <GraduationCap className="w-7 h-7" />
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#17191C] dark:text-[#F5F2EA] [text-wrap:balance]">
                {getGreetingByHour()}, {currentProfile.name}님
              </h1>
              <p className="text-sm text-[#5A5E66] dark:text-[#A5A197] mt-1">
                {gradeLevel === 'middle' ? '중학교' : '고등학교'} 교육과정 기준 · 원하는 과목 AI를 선택해 바로 학습을 시작하세요
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A5E66] dark:text-[#9D998E] font-mono-code tabular-nums">
              <span>학습 노트 {totalSessionsCount}개</span>
              <span aria-hidden="true">·</span>
              <span>오답노트 {savedStudyNoteCount}개</span>
              <span aria-hidden="true">·</span>
              <span>프롬프트 {savedPromptCount}개</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectWorkspace('free-chat')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity shadow-[0_6px_16px_-8px_rgba(23,25,28,0.35)] whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>AI와 자유 대화하기</span>
            </button>
          </div>
        </section>

        {/* Career Goal + Recent Answers Top Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Career Goal Card */}
          <div className="lg:col-span-5 rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] p-6 flex flex-col justify-between gap-5 shadow-[0_1px_2px_rgba(23,25,28,0.03),0_10px_28px_-14px_rgba(23,25,28,0.07)]">
            {currentProfile.careerGoal ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#F2EDE3] dark:bg-[#22252E] border border-[#E6DFD1] dark:border-[#303542] flex items-center justify-center shrink-0">
                        <Compass className="w-4 h-4 text-[#17191C] dark:text-[#EFECE4]" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[#686C75] dark:text-[#8E8A80]">
                          나의 희망 진로 · 학과
                        </div>
                        <div className="font-display text-lg font-bold text-[#17191C] dark:text-[#F5F2EA] mt-0.5">
                          {currentProfile.careerGoal}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenCareerModal}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap shrink-0"
                    >
                      진로 수정
                    </button>
                  </div>

                  <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] leading-relaxed">
                    각 과목 AI가 개념 설명과 함께 <strong className="text-[#17191C] dark:text-[#EFECE4]">{currentProfile.careerGoal}</strong> 진로·세특 탐구 포인트를 연결해 줍니다.
                  </p>
                </div>

                <div className="pt-3.5 border-t border-[#EFEAE0] dark:border-[#242730] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onToggleConnectCareer}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                      connectCareer
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                        : 'bg-[#FAF7F0] dark:bg-[#14161A] text-[#5A5E66] dark:text-[#9D998E] border-[#E6DFD1] dark:border-[#272A33]'
                    }`}
                  >
                    {connectCareer ? '전 과목 진로 연계 켜짐' : '전 과목 진로 연계 꺼짐'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectWorkspace('resource-search')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#4C5059] dark:text-[#C5C1B7] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors whitespace-nowrap"
                  >
                    <span>진로 탐구 사이트 찾기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F2EDE3] dark:bg-[#22252E] border border-[#E6DFD1] dark:border-[#303542] flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4 text-[#17191C] dark:text-[#EFECE4]" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#17191C] dark:text-[#EFECE4]">
                      희망 진로 · 학과 설정
                    </h2>
                    <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] mt-1 leading-relaxed">
                      진로를 선택하면 전 과목 답변에 진로·세특 탐구 포인트가 함께 정리됩니다.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CAREER_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onSaveCareerGoal(preset)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#2A2E38] bg-[#FAF7F0] dark:bg-[#14161A] text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!careerDraft.trim()) return;
                    onSaveCareerGoal(careerDraft.trim());
                    setCareerDraft('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={careerDraft}
                    onChange={(e) => setCareerDraft(e.target.value)}
                    placeholder="희망 학과/진로 직접 입력..."
                    maxLength={48}
                    className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-[#E6DFD1] dark:border-[#2A2E38] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none focus:border-[#17191C] dark:focus:border-[#8E8B82]"
                  />
                  <button
                    type="submit"
                    disabled={!careerDraft.trim()}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] disabled:opacity-35 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                  >
                    저장
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Recent Answers Card */}
          <div className="lg:col-span-7 rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] p-6 flex flex-col justify-between gap-4 shadow-[0_1px_2px_rgba(23,25,28,0.03),0_10px_28px_-14px_rgba(23,25,28,0.07)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                <h2 className="text-[15px] font-bold text-[#17191C] dark:text-[#EFECE4]">
                  최근 AI 답변 이어보기
                </h2>
              </div>
              {recentAnsweredSessions.length > 0 && (
                <span className="text-xs text-[#787B84] dark:text-[#848077] font-mono-code">
                  최근 {recentAnsweredSessions.length}건
                </span>
              )}
            </div>

            {recentAnsweredSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-2">
                <Sparkles className="w-6 h-6 text-[#8A8D95]" />
                <p className="text-sm font-medium text-[#2C2F36] dark:text-[#D5D1C8]">
                  아직 저장된 최근 답변이 없습니다
                </p>
                <p className="text-xs text-[#787B84] dark:text-[#848077] max-w-sm leading-relaxed">
                  아래에서 과목 AI를 선택해 질문하면, 최근 답변과 대화 기록이 여기에 모여 언제든 이어서 볼 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recentAnsweredSessions.map((session) => {
                  const ws = WORKSPACE_MAP[session.workspaceId];
                  const lastAnswer = [...session.messages]
                    .reverse()
                    .find((m) => m.role === 'assistant' && !m.error && m.content.trim());
                  const preview = lastAnswer ? stripMarkdownPreview(lastAnswer.content) : '';
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(session)}
                      className="group flex flex-col justify-between gap-2 p-3.5 rounded-xl text-left bg-[#FAF7F0]/75 dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] hover:border-[#C5BCAA] dark:hover:border-[#434957] transition-all duration-150"
                    >
                      <div className="space-y-1.5 min-w-0 w-full">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#686C75] dark:text-[#8E8A80]">
                          <span className="inline-flex items-center gap-1.5 font-medium truncate">
                            <SubjectIcon id={session.workspaceId} className="w-3.5 h-3.5 shrink-0" />
                            <span>{ws?.name ?? '노트'}</span>
                          </span>
                          <span className="font-mono-code shrink-0">
                            {formatRelativeTime(session.updatedAt)}
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#17191C] dark:text-[#EFECE4] truncate">
                          {session.title}
                        </div>
                        <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] line-clamp-2 leading-relaxed">
                          {preview || '답변 내용 보기'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Subject AI Shortcuts Grid */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-[-0.015em] text-[#17191C] dark:text-[#F5F2EA]">
                과목별 전용 AI 바로가기
              </h2>
              <p className="text-xs text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                {subjectEntryMode === 'performance'
                  ? '과목을 누르면 바로 수행평가 코칭 모드(안내문 분석·주제 선정·개요·첨삭)로 열립니다'
                  : '각 과목 AI는 교과 질문·풀이·대화·수행평가·자료 검색까지 지원합니다'}
              </p>
            </div>

            <div
              className="flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1B1D24] border border-[#E6DFD1] dark:border-[#272A33] shrink-0"
              role="group"
              aria-label="과목 시작 모드 선택"
            >
              <button
                type="button"
                onClick={() => setSubjectEntryMode('general')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  subjectEntryMode === 'general'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                일반 학습
              </button>
              <button
                type="button"
                onClick={() => setSubjectEntryMode('performance')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  subjectEntryMode === 'performance'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                수행평가 준비
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {subjectWorkspaces.map((item) => {
              const count = sessionCountByWorkspace[item.id] || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onSelectWorkspace(
                      item.id,
                      subjectEntryMode === 'performance' ? 'performance' : undefined
                    )
                  }
                  className="group flex flex-col justify-between gap-4 p-5 rounded-2xl text-left bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] hover:border-[#BDB39E] dark:hover:border-[#464C5B] shadow-[0_1px_2px_rgba(23,25,28,0.02)] hover:shadow-[0_10px_24px_-12px_rgba(23,25,28,0.12)] transition-all duration-150"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.accentLight} ${item.accentDark} ${item.accentTextLight} ${item.accentTextDark}`}
                      >
                        <SubjectIcon id={item.id} className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#8A8D95] group-hover:text-[#17191C] dark:group-hover:text-[#EFECE4] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>

                    <div>
                      <div className="font-display text-[15px] font-bold text-[#17191C] dark:text-[#EFECE4]">
                        {item.name} AI
                      </div>
                      <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] mt-1 leading-relaxed line-clamp-2">
                        {item.shortDesc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#EFEAE0] dark:border-[#242730] flex items-center justify-between text-[11px] text-[#686C75] dark:text-[#8E8A80] font-mono-code tabular-nums">
                    <span>{count > 0 ? `대화 ${count}개` : '새 질문 시작'}</span>
                    <span>
                      {item.subTracks?.filter((t) => !t.gradeHint || t.gradeHint === gradeLevel)
                        .length || 0}
                      개 세부 트랙
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Actions / Multimodal & Search Studios */}
        <section className="rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] p-5 space-y-3.5 shadow-[0_1px_2px_rgba(23,25,28,0.03)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
            <Layers className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
            <span>빠른 실행 · 전 과목 자료 도구</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {studioWorkspaces.map((studio) => {
              const Icon =
                studio.id === 'free-chat'
                  ? MessageCircle
                  : studio.id === 'doc-summary'
                    ? FileText
                    : studio.id === 'photo-analysis'
                      ? ImageIcon
                      : Search;
              return (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => onSelectWorkspace(studio.id)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{studio.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onOpenMakerWorkspace('doc-maker', 'hwpx')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
            >
              <FileOutput className="w-3.5 h-3.5 shrink-0" />
              <span>한글 · 문서 제작 AI</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenMakerWorkspace('ppt-maker', 'class-ppt')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
            >
              <Presentation className="w-3.5 h-3.5 shrink-0" />
              <span>PPT 발표자료 제작 AI</span>
            </button>

            <button
              type="button"
              onClick={onOpenStudyNotesModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap"
            >
              <BookMarked className="w-3.5 h-3.5 shrink-0" />
              <span>오답 · 핵심노트 ({savedStudyNoteCount})</span>
            </button>

            <button
              type="button"
              onClick={onOpenPromptsModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>저장한 프롬프트 ({savedPromptCount})</span>
            </button>

            <button
              type="button"
              disabled={exportingZip}
              onClick={handleExportProjectZip}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] disabled:opacity-60 transition-colors whitespace-nowrap"
              title="GitHub 업로드용 전체 프로젝트 파일(.zip) 내려받기"
            >
              {exportingZip ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              ) : exportSuccess ? (
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {exportingZip
                  ? '프로젝트 압축 중...'
                  : exportSuccess
                    ? '다운로드 완료 (.zip)'
                    : '프로젝트 파일 다운로드 (.zip)'}
              </span>
            </button>
          </div>
          {exportError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{exportError}</p>
          )}
        </section>
      </motion.div>
    </div>
  );
};
