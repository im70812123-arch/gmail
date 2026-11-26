import React from 'react';
import { Check, RotateCcw, Type, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { AnswerFontPreset, FontSizePreset } from '../types/study';
import { ANSWER_FONT_OPTIONS, FONT_SIZE_OPTIONS } from '../utils/typography';
import { MarkdownRenderer } from './MarkdownRenderer';

interface DisplaySettingsModalProps {
  isOpen: boolean;
  fontSize: FontSizePreset;
  answerFont: AnswerFontPreset;
  onClose: () => void;
  onChangeFontSize: (size: FontSizePreset) => void;
  onChangeAnswerFont: (font: AnswerFontPreset) => void;
  onResetDefaults: () => void;
}

const SAMPLE_PREVIEW_MARKDOWN = `### 핵심 원리 미리보기
이차방정식 $ax^2 + bx + c = 0$ ($a \\neq 0$)의 근의 공식은 다음과 같습니다.

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

- **판별식 $D = b^2 - 4ac$**: 실근의 개수를 먼저 확인하세요.`;

export const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({
  isOpen,
  fontSize,
  answerFont,
  onClose,
  onChangeFontSize,
  onChangeAnswerFont,
  onResetDefaults,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6DFD1] dark:border-[#272A33]">
              <div className="flex items-center gap-2.5">
                <Type className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                <div>
                  <h2 className="text-base font-semibold text-[#17191C] dark:text-[#EFECE4]">
                    글씨 크기 · 답변 글씨체 설정
                  </h2>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                    눈에 가장 편한 글씨 크기와 AI 답변 노트 글씨체를 선택하세요 (자동 저장)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[#5A5E66] dark:text-[#9D998E] hover:bg-[#F2EDE3] dark:hover:bg-[#242832] transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Font Size Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                    글씨 크기 (질문 · 입력창 · AI 답변)
                  </span>
                  <span className="text-[11px] font-mono-code text-[#686C75] dark:text-[#8E8A80]">
                    {FONT_SIZE_OPTIONS.find((o) => o.id === fontSize)?.sizeLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FONT_SIZE_OPTIONS.map((opt) => {
                    const active = fontSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeFontSize(opt.id)}
                        className={`flex flex-col items-start gap-0.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent shadow-xs'
                            : 'bg-[#FAF7F0] dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#272A33] text-[#17191C] dark:text-[#EFECE4] hover:border-[#C5BCAA] dark:hover:border-[#434957]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold">{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <span
                          className={`text-[11px] font-mono-code ${
                            active
                              ? 'text-[#FAF7F0]/75 dark:text-[#111215]/75'
                              : 'text-[#686C75] dark:text-[#8E8A80]'
                          }`}
                        >
                          {opt.sizeLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Answer Font Family Selector */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                  AI 답변 글씨체
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ANSWER_FONT_OPTIONS.map((opt) => {
                    const active = answerFont === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeAnswerFont(opt.id)}
                        className={`flex flex-col justify-between gap-2 p-3.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-[#F4EFE4] dark:bg-[#232630] border-[#17191C] dark:border-[#EFECE4] ring-1 ring-[#17191C]/15 dark:ring-[#EFECE4]/20'
                            : 'bg-[#FAF7F0]/70 dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#272A33] hover:border-[#C5BCAA] dark:hover:border-[#434957]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-[#17191C] dark:text-[#EFECE4]">
                              {opt.label}
                            </div>
                            <div className="text-[11px] text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          {active && (
                            <span className="w-5 h-5 rounded-full bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div
                          className={`${opt.previewClass} text-sm text-[#2C2F36] dark:text-[#D5D1C8] pt-1.5 border-t border-[#E6DFD1]/80 dark:border-[#272A33] truncate`}
                        >
                          {opt.sample}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#686C75] dark:text-[#8E8A80]">
                  실시간 노트 미리보기
                </div>
                <div className="rounded-2xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#14161A] p-5">
                  <MarkdownRenderer content={SAMPLE_PREVIEW_MARKDOWN} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0]/70 dark:bg-[#14161A]">
              <button
                type="button"
                onClick={onResetDefaults}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A5E66] dark:text-[#9D998E] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>기본값으로 초기화</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity"
              >
                적용 완료
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
