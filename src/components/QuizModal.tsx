import React, { useState } from 'react';
import { CheckCircle2, HelpCircle, RotateCcw, X, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { QuizQuestion } from '../types/study';

interface QuizModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  questions: QuizQuestion[];
  subjectName: string;
  onClose: () => void;
  onRetry: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  isLoading,
  error,
  questions,
  subjectName,
  onClose,
  onRetry,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setShowResults(false);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = questions.reduce((acc, q, idx) => {
    return acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0);
  }, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl bg-[#FFFDF8] dark:bg-[#1B1D22] border border-[#E5DFD2] dark:border-[#2B2F38] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD2] dark:border-[#2B2F38]">
              <div>
                <h2 className="text-base font-semibold text-[#1E2024] dark:text-[#EAE7DF]">
                  {subjectName} 이해도 확인 퀴즈
                </h2>
                <p className="text-xs text-[#5D616B] dark:text-[#9D998E] mt-0.5">
                  방금 학습한 내용을 바탕으로 출제된 3문항 점검
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[#5D616B] dark:text-[#9D998E] hover:bg-[#F3EFE6] dark:hover:bg-[#262932] transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {isLoading && (
                <div className="py-12 text-center space-y-2">
                  <HelpCircle className="w-7 h-7 mx-auto text-[#5D616B] dark:text-[#9D998E] animate-spin" />
                  <p className="text-sm font-medium text-[#1E2024] dark:text-[#EAE7DF]">
                    학습 내용을 분석해 맞춤 문제를 출제하고 있습니다...
                  </p>
                </div>
              )}

              {!isLoading && error && (
                <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-sm text-rose-800 dark:text-rose-200 space-y-3">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-700 text-white hover:bg-rose-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>다시 출제하기</span>
                  </button>
                </div>
              )}

              {!isLoading &&
                !error &&
                questions.map((q, qIdx) => {
                  const chosen = selectedAnswers[qIdx];
                  const isCorrect = chosen === q.correctIndex;
                  return (
                    <div
                      key={qIdx}
                      className="pb-5 border-b last:border-b-0 border-[#E5DFD2] dark:border-[#2B2F38] space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono-code text-xs font-semibold text-[#5D616B] dark:text-[#9D998E] mt-1 shrink-0">
                          0{qIdx + 1}.
                        </span>
                        <p className="text-sm font-medium text-[#1E2024] dark:text-[#EAE7DF] leading-relaxed">
                          {q.question}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pl-6">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = chosen === optIdx;
                          const isAnswerOption = q.correctIndex === optIdx;

                          let btnStyle =
                            'bg-[#FAF8F3] dark:bg-[#141518] border-[#E5DFD2] dark:border-[#2B2F38] text-[#1E2024] dark:text-[#EAE7DF] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C]';

                          if (showResults) {
                            if (isAnswerOption) {
                              btnStyle =
                                'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200';
                            } else if (isSelected && !isAnswerOption) {
                              btnStyle =
                                'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200';
                            }
                          } else if (isSelected) {
                            btnStyle =
                              'bg-[#1E2024] dark:bg-[#EAE7DF] border-[#1E2024] dark:border-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] font-medium';
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelect(qIdx, optIdx)}
                              className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors flex items-center justify-between gap-3 ${btnStyle}`}
                            >
                              <span>
                                <span className="font-mono-code text-xs mr-2 opacity-70">
                                  {optIdx + 1})
                                </span>
                                {opt}
                              </span>
                              {showResults && isAnswerOption && (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              )}
                              {showResults && isSelected && !isAnswerOption && (
                                <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {showResults && (
                        <div className="ml-6 p-3.5 rounded-lg bg-[#F3EFE6] dark:bg-[#22252C] border border-[#E5DFD2] dark:border-[#2F333E] text-xs leading-relaxed text-[#343740] dark:text-[#D5D1C8]">
                          <div className="font-semibold mb-1">
                            {isCorrect ? '정답입니다.' : `오답입니다 · 정답: ${q.correctIndex + 1}번`}
                          </div>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {!isLoading && !error && questions.length > 0 && (
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-[#E5DFD2] dark:border-[#2B2F38] bg-[#FAF8F3] dark:bg-[#17181C]">
                <div className="text-xs text-[#5D616B] dark:text-[#9D998E] font-mono-code">
                  {showResults
                    ? `점수: ${correctCount} / ${questions.length} 정답`
                    : `선택한 문항: ${answeredCount} / ${questions.length}`}
                </div>
                <div className="flex items-center gap-2">
                  {showResults ? (
                    <>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5DFD2] dark:border-[#2B2F38] text-[#1E2024] dark:text-[#EAE7DF] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C] transition-colors whitespace-nowrap"
                      >
                        다시 풀기
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleReset();
                          onRetry();
                        }}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        새 문제 출제
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={answeredCount < questions.length}
                      onClick={() => setShowResults(true)}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                      채점하기
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
