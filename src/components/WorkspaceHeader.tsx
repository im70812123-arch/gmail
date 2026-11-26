import React from 'react';
import {
  Brain,
  Compass,
  FileOutput,
  HelpCircle,
  Home,
  Layers,
  Menu,
  Moon,
  Plus,
  Presentation,
  Sun,
  Type,
} from 'lucide-react';
import type { GradeLevel, StudyMode, ThinkingDepth, WorkspaceConfig } from '../types/study';
import { SubjectIcon } from './SubjectIcon';

interface WorkspaceHeaderProps {
  workspace: WorkspaceConfig;
  activeSubTrackId?: string;
  gradeLevel: GradeLevel;
  studyMode: StudyMode;
  thinkingDepth: ThinkingDepth;
  careerGoal?: string;
  connectCareer: boolean;
  isDark: boolean;
  canGenerateQuiz: boolean;
  onOpenMobileMenu: () => void;
  onGoLobby: () => void;
  onSelectSubTrack: (subTrackId: string) => void;
  onChangeGradeLevel: (grade: GradeLevel) => void;
  onChangeStudyMode: (mode: StudyMode) => void;
  onToggleThinkingDepth: () => void;
  onToggleConnectCareer: () => void;
  onOpenCareerModal: () => void;
  onOpenQuiz: () => void;
  onOpenFlashcards: () => void;
  onConvertConversationToArtifact: (format: 'hwpx' | 'pptx') => void;
  onNewNote: () => void;
  onOpenDisplaySettings: () => void;
  onToggleDark: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  workspace,
  activeSubTrackId,
  gradeLevel,
  studyMode,
  thinkingDepth,
  careerGoal,
  connectCareer,
  isDark,
  canGenerateQuiz,
  onOpenMobileMenu,
  onGoLobby,
  onSelectSubTrack,
  onChangeGradeLevel,
  onChangeStudyMode,
  onToggleThinkingDepth,
  onToggleConnectCareer,
  onOpenCareerModal,
  onOpenQuiz,
  onOpenFlashcards,
  onConvertConversationToArtifact,
  onNewNote,
  onOpenDisplaySettings,
  onToggleDark,
}) => {
  const isSearchStudio = workspace.id === 'resource-search';
  const isFreeChat = workspace.id === 'free-chat';
  const isMakerWorkspace = workspace.id === 'doc-maker' || workspace.id === 'ppt-maker';

  const visibleSubTracks = workspace.subTracks?.filter((t) => {
    if (!t.gradeHint) return true;
    return t.gradeHint === gradeLevel || t.id === activeSubTrackId;
  });

  return (
    <header className="shrink-0 border-b border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0]/90 dark:bg-[#111215]/90 backdrop-blur-md px-4 lg:px-8">
      <div className="h-14 flex items-center justify-between gap-3">
        {/* Subject Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-1.5 rounded-lg text-[#17191C] dark:text-[#EFECE4] hover:bg-[#EAE4D7] dark:hover:bg-[#1E2027]"
            aria-label="과목 메뉴 열기"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onGoLobby}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#4C5059] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap shrink-0"
            title="학습 로비로 돌아가기"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">로비</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${workspace.accentLight} ${workspace.accentDark} ${workspace.accentTextLight} ${workspace.accentTextDark}`}
            >
              <SubjectIcon id={workspace.id} className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-display text-[15px] font-bold tracking-[-0.015em] text-[#17191C] dark:text-[#EFECE4] truncate">
                {workspace.name}
              </h1>
              <span className="hidden 2xl:inline text-xs text-[#686C75] dark:text-[#8E8A80] truncate">
                · {workspace.shortDesc}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCareerModal}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#2C2F36] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors max-w-[125px]"
            title="희망 진로·학과 설정 및 수정"
          >
            <Compass className="w-3.5 h-3.5 shrink-0 text-[#686C75] dark:text-[#8E8A80]" />
            <span className="truncate">{careerGoal ? careerGoal : '진로 설정'}</span>
          </button>

          {careerGoal && !isSearchStudio && (
            <button
              type="button"
              onClick={onToggleConnectCareer}
              className={`hidden 2xl:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                connectCareer
                  ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                  : 'bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#686C75] dark:text-[#8E8A80] border-[#E6DFD1] dark:border-[#272A33]'
              }`}
              title="답변에 내 진로·학과 연계 포인트를 함께 표시할지 선택합니다"
            >
              {connectCareer ? '진로 연계' : '진로 끔'}
            </button>
          )}

          {/* Deep Reasoning Toggle */}
          {!isSearchStudio && (
            <button
              type="button"
              onClick={onToggleThinkingDepth}
              className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                thinkingDepth === 'deep'
                  ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                  : 'bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#5A5E66] dark:text-[#9D998E] border-[#E6DFD1] dark:border-[#272A33] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
              }`}
              title="심화 추론 모드: 복잡한 수식 증명, 오답 함정, 원리 유도를 최고 추론 단계로 검증합니다"
            >
              <Brain className="w-3.5 h-3.5 shrink-0" />
              <span>{thinkingDepth === 'deep' ? '심화 추론 켜짐' : '심화 추론'}</span>
            </button>
          )}

          {/* Grade Level Segmented Control */}
          <div
            className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1B1D24] border border-[#E6DFD1] dark:border-[#272A33]"
            role="group"
            aria-label="학교급 선택"
          >
            <button
              type="button"
              onClick={() => onChangeGradeLevel('middle')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
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
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                gradeLevel === 'high'
                  ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
              }`}
            >
              고등
            </button>
          </div>

          {/* Study Mode Segmented Control */}
          {!isSearchStudio && !isFreeChat && !isMakerWorkspace && (
            <div
              className="hidden lg:flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1B1D24] border border-[#E6DFD1] dark:border-[#272A33]"
              role="group"
              aria-label="학습 모드 선택"
            >
              <button
                type="button"
                onClick={() => onChangeStudyMode('tutor')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                  studyMode === 'tutor'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                튜터
              </button>
              <button
                type="button"
                onClick={() => onChangeStudyMode('fast')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                  studyMode === 'fast'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
              >
                빠른 해설
              </button>
              <button
                type="button"
                onClick={() => onChangeStudyMode('solve-only')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                  studyMode === 'solve-only'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
                title="개념 노트 정리 없이 문제와 단계별 풀이 과정만 제공합니다"
              >
                문제·풀이만
              </button>
              <button
                type="button"
                onClick={() => onChangeStudyMode('performance')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                  studyMode === 'performance'
                    ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                }`}
                title="수행평가 안내문 분석, 주제 추천, 개요·초안 첨삭, 발표 준비를 돕습니다"
              >
                수행평가
              </button>
            </div>
          )}

          {canGenerateQuiz && !isMakerWorkspace && (
            <>
              <button
                type="button"
                onClick={() => onConvertConversationToArtifact('hwpx')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap shrink-0"
                title="지금까지 나눈 대화를 AI가 한글·PDF·워드 문서로 바로 제작합니다"
              >
                <FileOutput className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">문서화</span>
              </button>
              <button
                type="button"
                onClick={() => onConvertConversationToArtifact('pptx')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap shrink-0"
                title="지금까지 나눈 대화를 AI가 PPT 발표자료로 바로 제작합니다"
              >
                <Presentation className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">PPT화</span>
              </button>
            </>
          )}

          {!isSearchStudio && !isMakerWorkspace && (
            <button
              type="button"
              onClick={onOpenFlashcards}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors whitespace-nowrap shrink-0"
              title="대화 내용 또는 현재 과목의 암기 플래시카드 생성"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">암기 카드</span>
            </button>
          )}

          {canGenerateQuiz && !isSearchStudio && !isMakerWorkspace && (
            <button
              type="button"
              onClick={onOpenQuiz}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              title="대화 내용으로 확인 퀴즈 풀기"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">확인 퀴즈</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewNote}
            className="sm:hidden p-2 rounded-lg border border-[#E6DFD1] dark:border-[#272A33] text-[#17191C] dark:text-[#EFECE4]"
            aria-label="새 노트"
          >
            <Plus className="w-4 h-4" />
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

      {/* Sub-track strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
        {visibleSubTracks && visibleSubTracks.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {visibleSubTracks.map((track) => {
              const isSelected = activeSubTrackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectSubTrack(track.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215]'
                      : 'bg-transparent text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#EAE4D7] dark:hover:bg-[#1E2027] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                  }`}
                >
                  {track.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="hidden sm:block text-xs text-[#787B84] dark:text-[#848077]">
            {thinkingDepth === 'deep'
              ? '심화 추론 모드 · 최고 추론 깊이로 원리·반례·오답 함정까지 검증합니다'
              : studyMode === 'performance'
                ? '수행평가 코치 · 안내문 분석, 주제 추천, 보고서 개요·첨삭, 발표 준비를 돕습니다'
                : studyMode === 'solve-only'
                  ? '문제·풀이 전용 · 노트 정리 없이 문제와 단계별 풀이 과정, 정답만 간결하게 보여줍니다'
                  : studyMode === 'tutor'
                    ? '튜터 모드 · 정답 대신 단계별 힌트와 유도 질문을 먼저 제시합니다'
                    : '빠른 해설 모드 · 핵심 개념 요약과 풀이를 바로 정리합니다'}
          </div>
        )}

        {/* Mobile & Tablet quick toggles for controls hidden from top bar */}
        <div className="flex xl:hidden items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={onOpenCareerModal}
            className="px-2.5 py-1 rounded-md text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] whitespace-nowrap"
          >
            {careerGoal ? `진로: ${careerGoal}` : '진로 설정'}
          </button>
          <button
            type="button"
            onClick={() => onChangeGradeLevel(gradeLevel === 'middle' ? 'high' : 'middle')}
            className="sm:hidden px-2.5 py-1 rounded-md text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] whitespace-nowrap"
          >
            {gradeLevel === 'middle' ? '중등' : '고등'}
          </button>
          {!isSearchStudio && !isMakerWorkspace && (
            <>
              {!isFreeChat && (
                <button
                  type="button"
                  onClick={() =>
                    onChangeStudyMode(
                      studyMode === 'fast'
                        ? 'performance'
                        : studyMode === 'performance'
                          ? 'solve-only'
                          : studyMode === 'solve-only'
                            ? 'tutor'
                            : 'fast'
                    )
                  }
                  className={`lg:hidden px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${
                    studyMode === 'solve-only' || studyMode === 'performance'
                      ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                      : 'border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22]'
                  }`}
                >
                  {studyMode === 'performance'
                    ? '수행평가'
                    : studyMode === 'solve-only'
                      ? '문제·풀이만'
                      : studyMode === 'tutor'
                        ? '튜터 모드'
                        : '빠른 해설'}
                </button>
              )}
              <button
                type="button"
                onClick={onToggleThinkingDepth}
                className={`md:hidden px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${
                  thinkingDepth === 'deep'
                    ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                    : 'border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22]'
                }`}
              >
                {thinkingDepth === 'deep' ? '심화 추론' : '표준 추론'}
              </button>
              <button
                type="button"
                onClick={onOpenFlashcards}
                className="sm:hidden px-2.5 py-1 rounded-md text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] whitespace-nowrap"
              >
                암기 카드
              </button>
            </>
          )}
          {canGenerateQuiz && !isMakerWorkspace && (
            <>
              <button
                type="button"
                onClick={() => onConvertConversationToArtifact('hwpx')}
                className="sm:hidden px-2.5 py-1 rounded-md text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] whitespace-nowrap"
              >
                문서화
              </button>
              <button
                type="button"
                onClick={() => onConvertConversationToArtifact('pptx')}
                className="sm:hidden px-2.5 py-1 rounded-md text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] whitespace-nowrap"
              >
                PPT화
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
