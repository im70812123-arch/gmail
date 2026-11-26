import React from 'react';
import { AlertTriangle, LogOut, RotateCcw } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  recovering: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', recovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error?.message || '알 수 없는 오류가 발생했습니다.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, info);
  }

  handleResetToGuest = async () => {
    this.setState({ recovering: true });
    try {
      await signOut(auth);
    } catch {
      // ignore signOut failure
    }
    try {
      localStorage.removeItem('studynote_active_session_guest');
    } catch {
      // ignore storage failure
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.message.includes('Quota exceeded');
      const hasSignedInUser = Boolean(auth.currentUser);
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#FAF7F0] dark:bg-[#111215] text-[#17191C] dark:text-[#EFECE4]">
          <div className="max-w-md w-full rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-base font-bold">일시적인 오류가 발생했습니다</h1>
            </div>
            <p className="text-xs text-[#5A5E66] dark:text-[#9D998E] leading-relaxed">
              {isQuotaError
                ? '무료 데이터베이스 일일 사용 한도를 초과했습니다. 내일 한도가 초기화되거나 요금제를 확인해 주세요.'
                : '화면을 불러오는 중 문제가 발생했습니다. 새로고침하여 다시 시도해 주세요.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={this.state.recovering}
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>페이지 새로고침</span>
              </button>
              {hasSignedInUser && (
                <button
                  type="button"
                  disabled={this.state.recovering}
                  onClick={this.handleResetToGuest}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0] dark:bg-[#14161A] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#F2EDE3] dark:hover:bg-[#22252E] disabled:opacity-60 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃 후 게스트로 복구</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
