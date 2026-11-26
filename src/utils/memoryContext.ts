import { WORKSPACE_MAP } from '../data/subjects';
import type { NotebookSession, SavedStudyNote, WorkspaceId } from '../types/study';

function cleanSnippet(raw: string, maxLen: number): string {
  const cleaned = raw
    .replace(/\[\[SWITCH:[a-z-]+\]\]/g, '')
    .replace(/\[\[DOC_READY:[^\]\n]+\]\]/gi, '')
    .replace(/```[\s\S]*?```/g, ' [코드] ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trimEnd()}…`;
}

function formatTimeLabel(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatSessionBlock(session: NotebookSession): string {
  const wsName = WORKSPACE_MAP[session.workspaceId]?.name ?? session.workspaceId;
  const validMsgs = session.messages.filter((m) => !m.error && m.content.trim());
  if (validMsgs.length === 0) return '';

  const recentTurns = validMsgs.slice(-4);
  const lines = recentTurns.map((m) => {
    const speaker = m.role === 'user' ? '학생' : 'AI';
    const attNames = m.attachments?.map((a) => a.name).filter(Boolean) || [];
    const attTag = attNames.length > 0 ? ` [첨부: ${attNames.join(', ')}]` : '';
    const snippet = cleanSnippet(m.content, m.role === 'user' ? 200 : 260);
    return `  ${speaker}${attTag}: ${snippet}`;
  });

  return `- [${wsName} | "${cleanSnippet(session.title, 40)}" | ${formatTimeLabel(session.updatedAt)}]\n${lines.join('\n')}`;
}

export function buildCrossSessionMemoryContext(params: {
  activeSessionId: string;
  activeWorkspaceId: WorkspaceId;
  sessions: NotebookSession[];
  savedStudyNotes: SavedStudyNote[];
}): string {
  const { activeSessionId, activeWorkspaceId, sessions, savedStudyNotes } = params;

  const otherSessions = sessions
    .filter(
      (s) =>
        s.id !== activeSessionId &&
        s.messages.some((m) => !m.error && m.content.trim().length > 0)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const sameSubjectSessions = otherSessions
    .filter((s) => s.workspaceId === activeWorkspaceId)
    .slice(0, 4);

  const otherSubjectSessions = otherSessions
    .filter((s) => s.workspaceId !== activeWorkspaceId)
    .slice(0, 4);

  const sections: string[] = [];

  if (sameSubjectSessions.length > 0) {
    const currentWsName = WORKSPACE_MAP[activeWorkspaceId]?.name ?? '현재 과목';
    const blocks = sameSubjectSessions.map(formatSessionBlock).filter(Boolean);
    if (blocks.length > 0) {
      sections.push(`[같은 AI(${currentWsName}) 이전 대화 기록]\n${blocks.join('\n')}`);
    }
  }

  if (otherSubjectSessions.length > 0) {
    const blocks = otherSubjectSessions.map(formatSessionBlock).filter(Boolean);
    if (blocks.length > 0) {
      sections.push(`[다른 AI(자유 대화·타 과목·검색 등) 최근 대화 기록]\n${blocks.join('\n')}`);
    }
  }

  if (savedStudyNotes.length > 0) {
    const prioritizedNotes = [
      ...savedStudyNotes.filter((n) => n.workspaceId === activeWorkspaceId),
      ...savedStudyNotes.filter((n) => n.workspaceId !== activeWorkspaceId),
    ].slice(0, 3);

    const noteLines = prioritizedNotes.map((n) => {
      const wsName = WORKSPACE_MAP[n.workspaceId]?.name ?? n.workspaceId;
      return `- [${wsName}${n.mastered ? '·복습완료' : '·오답노트'}] ${cleanSnippet(n.title, 40)}: ${cleanSnippet(n.content, 160)}`;
    });

    if (noteLines.length > 0) {
      sections.push(`[학생이 저장한 오답·핵심노트]\n${noteLines.join('\n')}`);
    }
  }

  const combined = sections.join('\n\n');
  if (combined.length <= 4800) return combined;
  return `${combined.slice(0, 4780).trimEnd()}\n…`;
}
