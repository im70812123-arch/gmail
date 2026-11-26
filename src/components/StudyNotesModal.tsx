import React, { useState } from 'react';
import { BookMarked, Check, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WORKSPACE_MAP } from '../data/subjects';
import type { SavedStudyNote, WorkspaceId } from '../types/study';
import { MarkdownRenderer } from './MarkdownRenderer';

interface StudyNotesModalProps {
  isOpen: boolean;
  notes: SavedStudyNote[];
  onClose: () => void;
  onToggleMastered: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

export const StudyNotesModal: React.FC<StudyNotesModalProps> = ({
  isOpen,
  notes,
  onClose,
  onToggleMastered,
  onDeleteNote,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'review' | 'done'>('all');
  const [selectedSubject, setSelectedSubject] = useState<WorkspaceId | 'all'>('all');

  const filtered = notes.filter((n) => {
    if (filterStatus === 'review' && n.mastered) return false;
    if (filterStatus === 'done' && !n.mastered) return false;
    if (selectedSubject !== 'all' && n.workspaceId !== selectedSubject) return false;
    return true;
  });

  const reviewCount = notes.filter((n) => !n.mastered).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6DFD1] dark:border-[#272A33]">
              <div className="flex items-center gap-2.5">
                <BookMarked className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                <div>
                  <h2 className="text-base font-semibold text-[#17191C] dark:text-[#EFECE4]">
                    오답 · 핵심노트 보관함
                  </h2>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                    저장해 둔 중요 풀이와 핵심 요약을 과목별로 다시 복습하세요 (복습 필요 {reviewCount}건)
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

            <div className="px-6 py-3 border-b border-[#EFEAE0] dark:border-[#242730] bg-[#FAF7F0] dark:bg-[#14161A] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1E2027] border border-[#E6DFD1] dark:border-[#272A33]">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterStatus === 'all'
                      ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-xs'
                      : 'text-[#686C75] dark:text-[#8E8A80]'
                  }`}
                >
                  전체 ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('review')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterStatus === 'review'
                      ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-xs'
                      : 'text-[#686C75] dark:text-[#8E8A80]'
                  }`}
                >
                  복습 필요 ({reviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('done')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterStatus === 'done'
                      ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-xs'
                      : 'text-[#686C75] dark:text-[#8E8A80]'
                  }`}
                >
                  복습 완료 ({notes.length - reviewCount})
                </button>
              </div>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as WorkspaceId | 'all')}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4]"
              >
                <option value="all">모든 과목</option>
                {Array.from(new Set(notes.map((n) => n.workspaceId))).map((wid) => (
                  <option key={wid} value={wid}>
                    {WORKSPACE_MAP[wid]?.name ?? wid}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {filtered.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <BookMarked className="w-7 h-7 mx-auto text-[#8A8D95] opacity-60" />
                  <p className="text-sm font-medium text-[#17191C] dark:text-[#EFECE4]">
                    저장된 오답 · 핵심노트가 없습니다
                  </p>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80]">
                    AI 답변 카드 상단의 &lsquo;오답노트 저장&rsquo; 버튼을 누르면 이곳에 차곡차곡 모입니다.
                  </p>
                </div>
              ) : (
                filtered.map((note) => {
                  const subjName = WORKSPACE_MAP[note.workspaceId]?.name ?? '노트';
                  return (
                    <div
                      key={note.id}
                      className="rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0]/70 dark:bg-[#14161A] p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[#E6DFD1] dark:border-[#272A33]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#686C75] dark:text-[#8E8A80]">
                            <span>{subjName}</span>
                            {note.subTrackLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{note.subTrackLabel}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{note.gradeLevel === 'middle' ? '중등' : '고등'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-code">
                              {new Date(note.createdAt).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-[#17191C] dark:text-[#EFECE4] mt-1 truncate">
                            {note.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onToggleMastered(note.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                              note.mastered
                                ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                                : 'bg-[#FFFEFA] dark:bg-[#1A1C22] border-[#E6DFD1] dark:border-[#272A33] text-[#4C5059] dark:text-[#D5D1C8]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{note.mastered ? '복습 완료' : '복습 필요'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1.5 rounded-lg text-[#787B84] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            aria-label="노트 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto pr-1">
                        <MarkdownRenderer content={note.content} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
