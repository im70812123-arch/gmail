import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  FileOutput,
  FileText,
  Image as ImageIcon,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AttachmentPayload, ExportFormat, StudyMode, WorkspaceId } from '../types/study';
import {
  extractAttachmentsFromFile,
  getAttachmentVisualInfo,
  SUPPORTED_DOC_AND_MEDIA_ACCEPT,
} from '../utils/fileExtractor';

interface StudioSplitPaneProps {
  mode: Extract<WorkspaceId, 'doc-summary' | 'photo-analysis'>;
  studyMode?: StudyMode;
  attachments: AttachmentPayload[];
  isLoading: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSetAttachments: React.Dispatch<React.SetStateAction<AttachmentPayload[]>>;
  onQuickAnalyze: (prompt: string, overrideAttachments?: AttachmentPayload[]) => void;
  onConvertAttachments?: (format: ExportFormat) => void;
}

export const StudioSplitPane: React.FC<StudioSplitPaneProps> = ({
  mode,
  studyMode = 'fast',
  attachments,
  isLoading,
  isCollapsed,
  onToggleCollapse,
  onSetAttachments,
  onQuickAnalyze,
  onConvertAttachments,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedDocText, setPastedDocText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const isDocMode = mode === 'doc-summary';

  const handleFiles = async (fileList: FileList | File[]) => {
    setLocalError(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessingFiles(true);
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
        onSetAttachments((prev) => [...prev, ...added]);
      }
      if (errors.length > 0) {
        setLocalError(errors[0]);
      }
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const handleApplyPastedDoc = () => {
    if (!pastedDocText.trim()) return;
    const att: AttachmentPayload = {
      name: `직접_붙여넣은_자료_${attachments.length + 1}.txt`,
      mimeType: 'text/plain',
      textContent: pastedDocText.trim(),
      sizeBytes: new Blob([pastedDocText.trim()]).size,
    };
    const nextList = [...attachments, att];
    onSetAttachments(nextList);
    setPastedDocText('');
    onQuickAnalyze(
      studyMode === 'solve-only'
        ? '첨부한 자료 내용을 바탕으로 개념 노트 정리 없이 문제와 단계별 풀이 과정, 정답만 바로 만들어 줘.'
        : studyMode === 'performance'
          ? '첨부한 수행평가 자료/안내문의 채점 기준과 조건을 체크리스트로 분석하고, 만점 전략·개요·개선 포인트를 정리해 줘.'
          : '첨부한 자료의 핵심 내용을 구조화된 학습 노트로 요약하고 시험 출제 포인트를 정리해 줘.',
      nextList
    );
  };

  const removeAttachmentAt = (index: number) => {
    onSetAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isCollapsed) {
    return (
      <div className="h-full flex lg:flex-col items-center justify-between gap-2 rounded-xl lg:rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] px-3.5 py-2.5 lg:py-3.5 lg:px-2 shadow-[0_1px_2px_rgba(23,25,28,0.03)]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex lg:flex-col items-center gap-2 min-w-0 text-left lg:text-center group"
          title={isDocMode ? '원본 문서 창 펼치기' : '원본 사진 창 펼치기'}
        >
          <span className="p-1.5 rounded-lg bg-[#F2EDE3] dark:bg-[#22252E] text-[#17191C] dark:text-[#EFECE4] group-hover:bg-[#E7E0D3] dark:group-hover:bg-[#2C303B] transition-colors shrink-0">
            <span className="lg:hidden">
              <ChevronDown className="w-4 h-4" />
            </span>
            <span className="hidden lg:inline">
              <PanelLeftOpen className="w-4 h-4" />
            </span>
          </span>
          <span className="text-xs font-medium text-[#17191C] dark:text-[#EFECE4] truncate lg:[writing-mode:vertical-rl] lg:py-2">
            {attachments.length > 0
              ? `${attachments.length}개 파일 첨부됨`
              : isDocMode
                ? '문서 업로드 창 펼치기'
                : '사진 업로드 창 펼치기'}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="lg:hidden px-2.5 py-1 rounded-lg text-xs font-medium bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] whitespace-nowrap shrink-0"
        >
          펼치기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] shadow-[0_1px_2px_rgba(23,25,28,0.03),0_10px_28px_-14px_rgba(23,25,28,0.08)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EFEAE0] dark:border-[#242730] bg-[#FAF7F0]/70 dark:bg-[#16181D]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#17191C] dark:text-[#EFECE4] min-w-0">
          {isDocMode ? (
            <FileText className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
          ) : (
            <ImageIcon className="w-4 h-4 shrink-0 text-[#5A5E66] dark:text-[#9D998E]" />
          )}
          <span className="truncate">
            {isDocMode ? '원본 문서 · 학습 자료' : '원본 문제 · 필기 사진'}
            {attachments.length > 0 ? ` (${attachments.length})` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {attachments.length > 0 && (
            <button
              type="button"
              onClick={() => onSetAttachments([])}
              className="inline-flex items-center gap-1 text-xs text-[#686C75] dark:text-[#8E8A80] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>비우기</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FFFEFA] dark:bg-[#20232B] text-[#4C5059] dark:text-[#D5D1C8] hover:bg-[#F2EDE3] dark:hover:bg-[#292D36] transition-colors whitespace-nowrap"
            title="자료 올리는 창 접기"
          >
            <span className="lg:hidden inline-flex items-center gap-1">
              <ChevronUp className="w-3.5 h-3.5" />
              <span>접기</span>
            </span>
            <span className="hidden lg:inline-flex items-center gap-1">
              <PanelLeftClose className="w-3.5 h-3.5" />
              <span>창 접기</span>
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_DOC_AND_MEDIA_ACCEPT}
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {attachments.length === 0 ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border border-dashed p-6 text-center transition-all duration-150 ${
                isDragging
                  ? 'border-[#17191C] dark:border-[#EFECE4] bg-[#F2EDE3] dark:bg-[#22252E]'
                  : 'border-[#D7CFC0] dark:border-[#323643] bg-[#FAF7F0]/60 dark:bg-[#14161A] hover:bg-[#F4EFE4] dark:hover:bg-[#1D2027]'
              }`}
            >
              <div className="w-9 h-9 mx-auto mb-2.5 rounded-xl bg-[#FFFEFA] dark:bg-[#20232B] border border-[#E6DFD1] dark:border-[#2E323D] flex items-center justify-center shadow-xs">
                {isProcessingFiles ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#5A5E66] dark:text-[#9D998E]" />
                ) : (
                  <Upload className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                )}
              </div>
              <p className="text-sm font-medium text-[#17191C] dark:text-[#EFECE4]">
                {isDocMode
                  ? '한글(.hwpx/.hwp), PPT, 워드, PDF, 엑셀 등 다양한 자료를 올릴 수 있습니다'
                  : '문제·필기 사진이나 PDF·PPT·문서를 여러 개 올리거나 Ctrl+V로 붙여넣으세요'}
              </p>
              <p className="text-xs text-[#787B84] dark:text-[#848077] mt-1">
                {isDocMode
                  ? 'HWPX · HWP · PPTX · DOCX · XLSX · PDF · TXT · 이미지 지원 · 파일당 최대 20MB'
                  : 'PNG · JPG · WEBP 및 PDF · PPTX · HWPX · DOCX 다중 업로드 지원'}
              </p>
            </div>

            {isDocMode && (
              <div className="space-y-2.5 pt-3 border-t border-[#EFEAE0] dark:border-[#242730]">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#5A5E66] dark:text-[#9D998E]">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>또는 교과서 본문·필기를 직접 붙여넣어 요약</span>
                </div>
                <textarea
                  value={pastedDocText}
                  onChange={(e) => setPastedDocText(e.target.value)}
                  rows={6}
                  placeholder="요약할 지문, 강의 노트, 정리할 개념 글을 여기에 붙여넣으세요..."
                  className="w-full rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#14161A] p-3.5 text-sm text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none focus:border-[#17191C] dark:focus:border-[#8E8B82] resize-y"
                />
                <button
                  type="button"
                  disabled={!pastedDocText.trim() || isLoading}
                  onClick={handleApplyPastedDoc}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {studyMode === 'solve-only' ? '이 자료로 문제 · 풀이만 생성' : '이 글 바로 요약하기'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className="space-y-4"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#F4EFE4] dark:bg-[#20232B] border border-[#E6DFD1] dark:border-[#2E323D]">
              <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                총 {attachments.length}개 {isDocMode ? '문서' : '사진'} 준비됨
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#323643] hover:bg-[#FAF7F0] dark:hover:bg-[#262A34] shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isDocMode ? '문서 추가' : '사진 더 추가'}</span>
              </button>
            </div>

            {!isDocMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {attachments.map((item, idx) => {
                  const badge = getAttachmentVisualInfo(item.name, item.mimeType);
                  return (
                    <div
                      key={`${item.name}-${idx}`}
                      className="relative group rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#111215] p-2 space-y-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => removeAttachmentAt(idx)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-full bg-black/65 text-white hover:bg-rose-600 transition-colors z-10"
                        aria-label="자료 삭제"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-contain rounded-lg bg-white dark:bg-[#0D0E11]"
                        />
                      ) : (
                        <div className="w-full h-28 rounded-lg bg-[#FFFEFA] dark:bg-[#16181D] border border-[#E6DFD1] dark:border-[#272A33] p-2.5 flex flex-col justify-between overflow-hidden">
                          <span className="inline-flex self-start px-1.5 py-0.5 rounded font-mono-code text-[10px] font-semibold bg-[#EFEAE0] dark:bg-[#232630] text-[#17191C] dark:text-[#EFECE4]">
                            {badge.label}
                          </span>
                          <p className="text-[11px] text-[#5A5E66] dark:text-[#9D998E] line-clamp-3 leading-relaxed">
                            {item.textContent?.slice(0, 140) || '문서 자료 준비됨'}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[#686C75] dark:text-[#8E8A80]">
                        <span className="truncate font-medium text-[#17191C] dark:text-[#EFECE4]">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="font-mono-code shrink-0">{formatBytes(item.sizeBytes)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                {attachments.map((item, idx) => {
                  const badge = getAttachmentVisualInfo(item.name, item.mimeType);
                  return (
                    <div
                      key={`${item.name}-${idx}`}
                      className="rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#111215] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded font-mono-code text-[10px] font-semibold bg-[#EFEAE0] dark:bg-[#232630] text-[#17191C] dark:text-[#EFECE4] shrink-0">
                            {badge.label}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4] truncate">
                              {idx + 1}. {item.name}
                            </div>
                            <div className="text-[11px] text-[#686C75] dark:text-[#8E8A80] font-mono-code mt-0.5">
                              {formatBytes(item.sizeBytes)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachmentAt(idx)}
                          className="p-1 text-[#787B84] hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                          aria-label="문서 제거"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {item.previewUrl && (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full max-h-36 object-contain rounded-lg bg-white dark:bg-[#0D0E11]"
                        />
                      )}
                      {item.textContent && (
                        <div className="rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#16181D] p-3 max-h-36 overflow-y-auto text-xs leading-relaxed text-[#393C44] dark:text-[#D5D1C8] whitespace-pre-wrap">
                          {item.textContent.slice(0, 1200)}
                          {item.textContent.length > 1200 && '...'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {isDocMode ? (
                <>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      onQuickAnalyze(
                        studyMode === 'solve-only'
                          ? `첨부한 문서 ${attachments.length}개에서 문제만 추출하거나 핵심 유형 문제 3개를 만들고, 노트 정리 없이 문제·풀이과정·정답만 출력해 줘.`
                          : studyMode === 'performance'
                            ? `첨부한 문서 ${attachments.length}개(수행평가 안내문·자료·초안)의 핵심 요구사항과 채점 기준을 분석하고, 만점 받을 수 있는 개요와 보완점을 정리해 줘.`
                            : `첨부한 문서 ${attachments.length}개의 핵심 내용과 주요 개념을 구조화된 학습 노트로 통합 요약해 줘.`
                      )
                    }
                    className="px-3 py-2.5 rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {studyMode === 'solve-only'
                      ? '문제 · 풀이만 바로 생성'
                      : studyMode === 'performance'
                        ? '수행평가 기준·개요 분석'
                        : attachments.length > 1
                          ? `문서 ${attachments.length}개 통합 요약`
                          : '핵심 노트 요약 실행'}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      onQuickAnalyze(
                        studyMode === 'solve-only'
                          ? '첨부한 문서 기반 서술형·응용 문제 2개와 단계별 모범 풀이 과정만 출력해 줘.'
                          : studyMode === 'performance'
                            ? '첨부한 수행평가 초안·자료에서 논리 비약, 조건 누락, 감점 요인을 짚어주고 더 탄탄한 수정 방향을 제안해 줘.'
                            : '첨부한 문서에서 시험에 나오기 쉬운 키워드 표와 예상 포인트를 뽑아 줘.'
                      )
                    }
                    className="px-3 py-2.5 rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] text-xs font-medium disabled:opacity-40 hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors"
                  >
                    {studyMode === 'solve-only'
                      ? '서술형 문제 · 풀이만'
                      : studyMode === 'performance'
                        ? '수행평가 초안 · 감점 첨삭'
                        : '시험 포인트 · 암기표'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      onQuickAnalyze(
                        studyMode === 'solve-only'
                          ? `첨부한 사진 ${attachments.length}장에 있는 문제의 단계별 풀이 과정과 최종 정답만 간결하게 출력해 줘. 개념 노트 정리는 생략해 줘.`
                          : studyMode === 'performance'
                            ? `첨부한 수행평가 안내문·루브릭·자료 사진 ${attachments.length}장을 모두 읽고 필수 조건 체크리스트, 주제·구성 전략, 만점 작성 가이드를 정리해 줘.`
                            : `첨부한 사진 ${attachments.length}장 속 문제/자료를 모두 인식하고 과목과 핵심 개념부터 차례대로 풀이해 줘.`
                      )
                    }
                    className="px-3 py-2.5 rounded-xl bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {studyMode === 'solve-only'
                      ? `문제 · 풀이만 (${attachments.length}장)`
                      : studyMode === 'performance'
                        ? `수행평가 안내문 분석 (${attachments.length}장)`
                        : attachments.length > 1
                          ? `사진 ${attachments.length}장 모두 분석`
                          : '사진 문제 분석 시작'}
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      onQuickAnalyze(
                        studyMode === 'performance'
                          ? '사진 속 내 수행평가 초안·탐구 필기에서 채점 기준 대비 부족한 점과 보완할 문장·근거를 짚어줘.'
                          : '사진에 적힌 내 풀이나 필기에서 잘못된 부분이나 보완할 점을 찾아줘.'
                      )
                    }
                    className="px-3 py-2.5 rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] text-xs font-medium disabled:opacity-40 hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors"
                  >
                    {studyMode === 'performance' ? '수행평가 초안 피드백' : '내 풀이 오답 체크'}
                  </button>
                </>
              )}
            </div>

            {onConvertAttachments && (
              <div className="pt-3 border-t border-[#EFEAE0] dark:border-[#242730] space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                  <FileOutput className="w-3.5 h-3.5" />
                  <span>첨부 자료를 다른 파일 형식으로 AI 전환</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'pdf', label: 'PDF로 전환' },
                      { id: 'hwpx', label: '한글(.hwpx)' },
                      { id: 'docx', label: '워드(.docx)' },
                      { id: 'pptx', label: 'PPT(.pptx)' },
                    ] as Array<{ id: ExportFormat; label: string }>
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => onConvertAttachments(fmt.id)}
                      className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-[#E6DFD1] dark:border-[#2E323D] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] text-[11px] font-medium disabled:opacity-40 hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors whitespace-nowrap"
                    >
                      {fmt.id === 'pptx' ? (
                        <Presentation className="w-3 h-3 shrink-0" />
                      ) : (
                        <FileOutput className="w-3 h-3 shrink-0" />
                      )}
                      <span>{fmt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {localError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200">
            {localError}
          </div>
        )}
      </div>
    </div>
  );
};
