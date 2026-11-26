import React, { useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CAREER_PRESETS } from '../data/subjects';

interface CareerModalProps {
  isOpen: boolean;
  currentCareerGoal?: string;
  onClose: () => void;
  onSaveCareerGoal: (goal: string) => void;
}

export const CareerModal: React.FC<CareerModalProps> = ({
  isOpen,
  currentCareerGoal,
  onClose,
  onSaveCareerGoal,
}) => {
  const [careerInput, setCareerInput] = useState(currentCareerGoal || '');

  useEffect(() => {
    if (isOpen) {
      setCareerInput(currentCareerGoal || '');
    }
  }, [isOpen, currentCareerGoal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCareerGoal(careerInput.trim());
    onClose();
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
            className="w-full max-w-lg rounded-xl bg-[#FFFDF8] dark:bg-[#1B1D22] border border-[#E5DFD2] dark:border-[#2B2F38] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD2] dark:border-[#2B2F38]">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#5D616B] dark:text-[#9D998E]" />
                <div>
                  <h2 className="text-base font-semibold text-[#1E2024] dark:text-[#EAE7DF]">
                    희망 진로 · 학과 설정
                  </h2>
                  <p className="text-xs text-[#5D616B] dark:text-[#9D998E] mt-0.5">
                    설정한 진로·학과에 맞춰 모든 과목 AI가 연계 포인트를 함께 설명합니다
                  </p>
                </div>
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#5D616B] dark:text-[#9D998E]">
                  관심 진로나 희망 학과 직접 입력
                </label>
                <input
                  type="text"
                  value={careerInput}
                  onChange={(e) => setCareerInput(e.target.value)}
                  placeholder="예: 컴퓨터공학, 의예과, 수의학, 교사, 경제학과, 게임 개발자..."
                  maxLength={48}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#E5DFD2] dark:border-[#2B2F38] bg-[#FAF8F3] dark:bg-[#141518] text-[#1E2024] dark:text-[#EAE7DF] placeholder:text-[#8E8B82] focus:outline-none focus:ring-2 focus:ring-[#1E2024]/20 dark:focus:ring-[#EAE7DF]/25"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[#5D616B] dark:text-[#9D998E]">
                  대표 진로·학과 빠른 선택
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CAREER_PRESETS.map((preset) => {
                    const selected = careerInput.trim() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCareerInput(preset)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] border-transparent'
                            : 'bg-[#FAF8F3] dark:bg-[#141518] border-[#E5DFD2] dark:border-[#2B2F38] text-[#343740] dark:text-[#D5D1C8] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C]'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#E5DFD2] dark:border-[#2B2F38]">
                <button
                  type="button"
                  onClick={() => {
                    onSaveCareerGoal('');
                    onClose();
                  }}
                  className="px-3 py-2 text-xs font-medium text-[#5D616B] dark:text-[#9D998E] hover:text-[#1E2024] dark:hover:text-[#EAE7DF] transition-colors"
                >
                  설정 해제 (연계 끄기)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5DFD2] dark:border-[#2B2F38] text-[#1E2024] dark:text-[#EAE7DF] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C] transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] hover:opacity-90 transition-opacity"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
