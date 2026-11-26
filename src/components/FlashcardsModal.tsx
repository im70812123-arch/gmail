import React, { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FlashcardItem, WorkspaceId } from '../types/study';

interface FlashcardsModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  cards: FlashcardItem[];
  subjectName: string;
  workspaceId: WorkspaceId;
  subTrackId?: string;
  onClose: () => void;
  onRegenerate: () => void;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({
  isOpen,
  isLoading,
  error,
  cards,
  subjectName,
  workspaceId,
  subTrackId,
  onClose,
  onRegenerate,
}) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [masteredSet, setMasteredSet] = useState<Record<number, boolean>>({});

  const current = cards[index];
  const masteredCount = Object.values(masteredSet).filter(Boolean).length;
  const canSpeak = workspaceId === 'english' || workspaceId === 'foreign';

  const handleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (workspaceId === 'english') {
      utter.lang = 'en-US';
    } else if (subTrackId === 'japanese') {
      utter.lang = 'ja-JP';
    } else if (subTrackId === 'chinese') {
      utter.lang = 'zh-CN';
    } else {
      utter.lang = 'ko-KR';
    }
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  };

  const goTo = (nextIdx: number) => {
    setIndex(nextIdx);
    setFlipped(false);
    setShowHint(false);
  };

  const handleResetAndRetry = () => {
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setMasteredSet({});
    onRegenerate();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6DFD1] dark:border-[#272A33]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                <div>
                  <h2 className="text-base font-semibold text-[#17191C] dark:text-[#EFECE4]">
                    {subjectName} 암기 플래시카드
                  </h2>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                    카드를 클릭해 앞·뒷면을 뒤집으며 핵심 개념을 점검하세요
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

            <div className="p-6">
              {isLoading && (
                <div className="py-16 text-center space-y-2.5">
                  <Layers className="w-7 h-7 mx-auto text-[#686C75] dark:text-[#9D998E] animate-pulse" />
                  <p className="text-sm font-medium text-[#17191C] dark:text-[#EFECE4]">
                    핵심 암기 카드 6장을 만들고 있습니다...
                  </p>
                </div>
              )}

              {!isLoading && error && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-sm text-rose-800 dark:text-rose-200 space-y-3">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={handleResetAndRetry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-700 text-white hover:bg-rose-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>다시 생성하기</span>
                  </button>
                </div>
              )}

              {!isLoading && !error && current && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#686C75] dark:text-[#8E8A80] font-mono-code">
                    <span>
                      카드 {index + 1} / {cards.length}
                    </span>
                    <span>
                      암기 완료: {masteredCount} / {cards.length}
                    </span>
                  </div>

                  {/* Interactive Flashcard */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setFlipped((f) => !f)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setFlipped((f) => !f);
                      }
                    }}
                    className="cursor-pointer min-h-[230px] rounded-2xl border border-[#DFD7C6] dark:border-[#2E3340] bg-[#FAF7F0] dark:bg-[#14161A] p-6 flex flex-col justify-between transition-colors hover:border-[#C5BCAA] dark:hover:border-[#434957]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-[#686C75] dark:text-[#8E8A80]">
                        {flipped ? '뒷면 · 정답 및 해설' : '앞면 · 개념 / 문제'}
                      </span>
                      {canSpeak && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(flipped ? current.example : current.front);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[#FFFEFA] dark:bg-[#20232B] border border-[#E6DFD1] dark:border-[#2E323D] text-[#4C5059] dark:text-[#D5D1C8] hover:text-[#17191C] dark:hover:text-[#EFECE4]"
                          title="발음 듣기"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>발음</span>
                        </button>
                      )}
                    </div>

                    <div className="my-auto py-4 text-center space-y-3">
                      {!flipped ? (
                        <>
                          <p className="text-lg font-semibold text-[#17191C] dark:text-[#EFECE4] leading-relaxed whitespace-pre-wrap">
                            {current.front}
                          </p>
                          {showHint ? (
                            <p className="text-xs text-[#5A5E66] dark:text-[#A5A197]">
                              힌트: {current.hint}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowHint(true);
                              }}
                              className="text-xs text-[#686C75] dark:text-[#8E8A80] underline underline-offset-2 hover:text-[#17191C] dark:hover:text-[#EFECE4]"
                            >
                              힌트 보기
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-base font-semibold text-[#17191C] dark:text-[#EFECE4] leading-relaxed whitespace-pre-wrap">
                            {current.back}
                          </p>
                          <div className="pt-2 border-t border-[#E6DFD1] dark:border-[#272A33] text-xs text-[#5A5E66] dark:text-[#A5A197] leading-relaxed whitespace-pre-wrap">
                            적용 · 예문: {current.example}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-center text-[11px] text-[#8A8D95]">
                      클릭해서 {flipped ? '앞면 보기' : '정답 확인하기'}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => goTo(index - 1)}
                        className="p-2 rounded-lg border border-[#E6DFD1] dark:border-[#272A33] disabled:opacity-35 hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors"
                        aria-label="이전 카드"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === cards.length - 1}
                        onClick={() => goTo(index + 1)}
                        className="p-2 rounded-lg border border-[#E6DFD1] dark:border-[#272A33] disabled:opacity-35 hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] transition-colors"
                        aria-label="다음 카드"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMasteredSet((prev) => ({
                            ...prev,
                            [index]: !prev[index],
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          masteredSet[index]
                            ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                            : 'bg-[#FAF7F0] dark:bg-[#14161A] border-[#E6DFD1] dark:border-[#272A33] text-[#17191C] dark:text-[#EFECE4]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{masteredSet[index] ? '암기 완료됨' : '암기 완료 체크'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetAndRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>새 카드 세트</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
