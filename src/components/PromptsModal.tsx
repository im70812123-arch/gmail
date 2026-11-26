import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WORKSPACE_MAP, WORKSPACES } from '../data/subjects';
import type { SavedPrompt, WorkspaceId } from '../types/study';

interface PromptsModalProps {
  isOpen: boolean;
  activeWorkspaceId: WorkspaceId;
  prompts: SavedPrompt[];
  onClose: () => void;
  onUsePrompt: (prompt: SavedPrompt) => void;
  onAddPrompt: (title: string, content: string, workspaceId: WorkspaceId | 'all') => void;
  onDeletePrompt: (id: string) => void;
}

export const PromptsModal: React.FC<PromptsModalProps> = ({
  isOpen,
  activeWorkspaceId,
  prompts,
  onClose,
  onUsePrompt,
  onAddPrompt,
  onDeletePrompt,
}) => {
  const [filterScope, setFilterScope] = useState<'all' | 'current'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newScope, setNewScope] = useState<WorkspaceId | 'all'>('all');

  const filteredPrompts = prompts.filter((p) => {
    if (filterScope === 'current') {
      return p.workspaceId === activeWorkspaceId || p.workspaceId === 'all';
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const derivedTitle =
      newTitle.trim() ||
      newContent.trim().slice(0, 26) + (newContent.trim().length > 26 ? '...' : '');
    onAddPrompt(derivedTitle, newContent.trim(), newScope);
    setNewTitle('');
    setNewContent('');
    setNewScope('all');
    setShowCreateForm(false);
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
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6DFD1] dark:border-[#272A33]">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 text-[#5A5E66] dark:text-[#9D998E]" />
                <div>
                  <h2 className="text-base font-semibold text-[#17191C] dark:text-[#EFECE4]">
                    저장된 프롬프트 보관함
                  </h2>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80] mt-0.5">
                    자주 쓰는 질문 형식이나 공부 요청 문장을 저장해 두고 바로 불러옵니다
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

            <div className="px-6 py-3 border-b border-[#EFEAE0] dark:border-[#242730] bg-[#FAF7F0] dark:bg-[#14161A] flex items-center justify-between gap-3">
              <div className="flex items-center p-0.5 rounded-lg bg-[#EFEAE0] dark:bg-[#1E2027] border border-[#E6DFD1] dark:border-[#272A33]">
                <button
                  type="button"
                  onClick={() => setFilterScope('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterScope === 'all'
                      ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-xs'
                      : 'text-[#686C75] dark:text-[#8E8A80]'
                  }`}
                >
                  전체 ({prompts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterScope('current')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterScope === 'current'
                      ? 'bg-[#FFFEFA] dark:bg-[#2A2E38] text-[#17191C] dark:text-[#EFECE4] shadow-xs'
                      : 'text-[#686C75] dark:text-[#8E8A80]'
                  }`}
                >
                  {WORKSPACE_MAP[activeWorkspaceId].name} · 공통
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showCreateForm ? '작성 닫기' : '새 프롬프트 저장'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {showCreateForm && (
                <form
                  onSubmit={handleCreate}
                  className="p-4 rounded-xl bg-[#FAF7F0] dark:bg-[#14161A] border border-[#E6DFD1] dark:border-[#272A33] space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="프롬프트 이름 (예: 3줄 핵심 요약)"
                      maxLength={40}
                      className="sm:col-span-2 px-3 py-2 text-xs rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none focus:border-[#17191C] dark:focus:border-[#8E8A80]"
                    />
                    <select
                      value={newScope}
                      onChange={(e) => setNewScope(e.target.value as WorkspaceId | 'all')}
                      className="px-3 py-2 text-xs rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4]"
                    >
                      <option value="all">모든 과목 공통</option>
                      {WORKSPACES.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={3}
                    placeholder="저장할 질문이나 요청 템플릿을 입력하세요..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E6DFD1] dark:border-[#272A33] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] placeholder:text-[#8E8B82] focus:outline-none focus:border-[#17191C] dark:focus:border-[#8E8A80] resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newContent.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      보관함에 저장
                    </button>
                  </div>
                </form>
              )}

              {filteredPrompts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Bookmark className="w-7 h-7 mx-auto text-[#8A8D95] opacity-60" />
                  <p className="text-sm font-medium text-[#17191C] dark:text-[#EFECE4]">
                    저장된 프롬프트가 아직 없습니다
                  </p>
                  <p className="text-xs text-[#686C75] dark:text-[#8E8A80]">
                    입력창의 북마크 버튼이나 위 &lsquo;새 프롬프트 저장&rsquo;으로 자주 쓰는 질문을 저장해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredPrompts.map((item) => {
                    const scopeLabel =
                      item.workspaceId === 'all'
                        ? '전체 공통'
                        : WORKSPACE_MAP[item.workspaceId]?.name ?? '기타';
                    return (
                      <div
                        key={item.id}
                        className="group rounded-xl border border-[#E6DFD1] dark:border-[#272A33] bg-[#FAF7F0]/70 dark:bg-[#14161A] p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-[#686C75] dark:text-[#8E8A80]">
                              <span>{scopeLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-code">
                                {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-[#17191C] dark:text-[#EFECE4] mt-0.5 truncate">
                              {item.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onUsePrompt(item);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 transition-opacity whitespace-nowrap"
                            >
                              입력창에 불러오기
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePrompt(item.id)}
                              className="p-1.5 rounded-lg text-[#787B84] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              title="프롬프트 삭제"
                              aria-label="프롬프트 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#4C5059] dark:text-[#B8B4AA] leading-relaxed whitespace-pre-wrap line-clamp-3">
                          {item.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
