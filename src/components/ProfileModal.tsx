import React, { useState } from 'react';
import { CheckCircle2, Loader2, LogOut, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { GradeLevel, StudentProfile } from '../types/study';

interface ProfileModalProps {
  isOpen: boolean;
  currentProfile: StudentProfile;
  guestNotebookCount: number;
  authLoading: boolean;
  authError: string | null;
  onClose: () => void;
  onGoogleSignIn: (importGuestNotes: boolean) => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onChangeGradeLevel: (grade: GradeLevel) => void;
}

const GoogleLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.02 21.17 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.02 14.03c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.17H1.01C.37 7.45 0 8.88 0 10.37s.37 2.92 1.01 4.2l4.01-3.14v2.6Z"
      transform="translate(0 1.3)"
    />
    <path
      fill="#EA4335"
      d="M12 4.83c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.02 2.83 1.01 7.03l4.01 3.14C6 7.02 8.75 4.83 12 4.83Z"
    />
  </svg>
);

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  currentProfile,
  guestNotebookCount,
  authLoading,
  authError,
  onClose,
  onGoogleSignIn,
  onGoogleSignOut,
  onChangeGradeLevel,
}) => {
  const [importGuest, setImportGuest] = useState(true);

  const handleSignInClick = async () => {
    await onGoogleSignIn(importGuest && guestNotebookCount > 0 && currentProfile.isGuest);
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
            className="w-full max-w-md rounded-2xl bg-[#FFFDF8] dark:bg-[#1B1D22] border border-[#E5DFD2] dark:border-[#2B2F38] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD2] dark:border-[#2B2F38]">
              <div>
                <h2 className="text-base font-semibold text-[#1E2024] dark:text-[#EAE7DF]">
                  {currentProfile.isGuest ? 'Google 로그인' : '내 Google 학습 계정'}
                </h2>
                <p className="text-xs text-[#5D616B] dark:text-[#9D998E] mt-0.5">
                  {currentProfile.isGuest
                    ? 'Google 계정으로 로그인해 노트를 안전하게 저장·동기화하세요'
                    : '학습 노트, 오답노트, 진로 설정이 계정에 저장됩니다'}
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

            <div className="p-6 space-y-5">
              {currentProfile.isGuest ? (
                <>
                  <div className="rounded-xl bg-[#FAF8F3] dark:bg-[#141518] border border-[#E5DFD2] dark:border-[#2B2F38] p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1E2024] dark:text-[#EAE7DF]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Google 로그인 시 제공되는 기능</span>
                    </div>
                    <ul className="text-xs text-[#5D616B] dark:text-[#9D998E] space-y-1.5 pl-6 list-disc">
                      <li>과목별 AI 질문·수행평가 대화 기록 클라우드 저장</li>
                      <li>오답·핵심노트, 저장한 프롬프트, 희망 진로 유지</li>
                      <li>다른 기기나 브라우저에서도 동일한 학습 노트 이어보기</li>
                    </ul>
                  </div>

                  {guestNotebookCount > 0 && (
                    <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FAF8F3] dark:bg-[#141518] border border-[#E5DFD2] dark:border-[#2B2F38] text-xs text-[#2C2F36] dark:text-[#D5D1C8] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importGuest}
                        onChange={(e) => setImportGuest(e.target.checked)}
                        className="rounded border-[#E5DFD2] dark:border-[#2B2F38]"
                      />
                      <span>
                        현재 게스트 노트 {guestNotebookCount}개를 내 Google 계정으로 가져오기
                      </span>
                    </label>
                  )}

                  {authError && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      {authError}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={handleSignInClick}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#FFFFFF] dark:bg-[#F5F2EA] text-[#17191C] border border-[#D8D0C0] dark:border-transparent text-sm font-semibold shadow-sm hover:bg-[#F7F4EC] dark:hover:bg-[#EAE5D8] disabled:opacity-60 transition-colors"
                    >
                      {authLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#17191C]" />
                      ) : (
                        <GoogleLogo className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {authLoading ? 'Google 로그인 진행 중...' : 'Google 계정으로 로그인'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={onClose}
                      className="w-full py-2 text-xs font-medium text-[#5D616B] dark:text-[#9D998E] hover:text-[#1E2024] dark:hover:text-[#EAE7DF] transition-colors"
                    >
                      로그인 없이 게스트로 계속 사용하기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#FAF8F3] dark:bg-[#141518] border border-[#E5DFD2] dark:border-[#2B2F38]">
                    {currentProfile.photoURL ? (
                      <img
                        src={currentProfile.photoURL}
                        alt={currentProfile.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-[#E5DFD2] dark:border-[#2B2F38] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] flex items-center justify-center font-bold text-base shrink-0">
                        {currentProfile.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#1E2024] dark:text-[#EAE7DF] truncate">
                          {currentProfile.name}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      </div>
                      {currentProfile.email && (
                        <div className="text-xs text-[#5D616B] dark:text-[#9D998E] truncate mt-0.5">
                          {currentProfile.email}
                        </div>
                      )}
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                        Google 계정 동기화 중
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#5D616B] dark:text-[#9D998E]">
                      내 학교급 설정
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onChangeGradeLevel('middle')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          currentProfile.gradeLevel === 'middle'
                            ? 'bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] border-transparent'
                            : 'bg-[#FAF8F3] dark:bg-[#141518] border-[#E5DFD2] dark:border-[#2B2F38] text-[#1E2024] dark:text-[#EAE7DF] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C]'
                        }`}
                      >
                        중학교 과정
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeGradeLevel('high')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          currentProfile.gradeLevel === 'high'
                            ? 'bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] border-transparent'
                            : 'bg-[#FAF8F3] dark:bg-[#141518] border-[#E5DFD2] dark:border-[#2B2F38] text-[#1E2024] dark:text-[#EAE7DF] hover:bg-[#F3EFE6] dark:hover:bg-[#22252C]'
                        }`}
                      >
                        고등학교 과정
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      {authError}
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#E5DFD2] dark:border-[#2B2F38] flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={onGoogleSignOut}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5D616B] dark:text-[#9D998E] hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Google 로그아웃</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1E2024] dark:bg-[#EAE7DF] text-[#FAF8F3] dark:text-[#141518] hover:opacity-90 transition-opacity"
                    >
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
