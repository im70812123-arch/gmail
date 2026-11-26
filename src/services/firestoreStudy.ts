import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ChatMessage,
  GradeLevel,
  NotebookSession,
  SavedPrompt,
  SavedStudyNote,
  SearchHistoryEntry,
  WorkspaceId,
} from '../types/study';

export interface CloudUserPrefs {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  gradeLevel: GradeLevel;
  careerGoal?: string;
  careerPromptDismissed?: boolean;
  connectCareer?: boolean;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

const knownSessionIds = new Set<string>();
const knownPromptIds = new Set<string>();
const knownStudyNoteIds = new Set<string>();
const knownSearchIds = new Set<string>();

export function clearKnownCloudIds() {
  knownSessionIds.clear();
  knownPromptIds.clear();
  knownStudyNoteIds.clear();
  knownSearchIds.clear();
}

function sanitizeDocId(rawId: string, prefix: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampString(val: string | undefined, maxLen: number): string {
  if (!val) return '';
  return val.slice(0, maxLen);
}

const ALLOWED_WORKSPACES = new Set<string>([
  'korean',
  'math',
  'english',
  'science',
  'social',
  'history',
  'foreign',
  'informatics',
  'free-chat',
  'doc-summary',
  'photo-analysis',
  'resource-search',
  'doc-maker',
  'ppt-maker',
]);

function sanitizeWorkspaceId(val: unknown): WorkspaceId {
  return typeof val === 'string' && ALLOWED_WORKSPACES.has(val)
    ? (val as WorkspaceId)
    : 'free-chat';
}

function sanitizeGradeLevel(val: unknown): GradeLevel {
  return val === 'middle' ? 'middle' : 'high';
}

function sanitizeStudyMode(val: unknown): NotebookSession['studyMode'] {
  return val === 'tutor' || val === 'fast' || val === 'solve-only' || val === 'performance'
    ? val
    : 'fast';
}

const ALLOWED_SLIDE_LAYOUTS = new Set<string>([
  'title',
  'agenda',
  'bullets',
  'two-column',
  'cards',
  'timeline',
  'stats',
  'table',
  'quote',
  'summary',
]);

const ALLOWED_PPT_THEMES = new Set<string>([
  'ivory',
  'navy',
  'sage',
  'terracotta',
  'cobalt',
  'editorial',
  'lavender',
]);

const ALLOWED_COVER_STYLES = new Set<string>(['split', 'modern', 'framed', 'minimal']);

function sanitizeGeneratedDocumentForCloud(
  docPayload: ChatMessage['generatedDocument']
): Record<string, unknown> | undefined {
  if (!docPayload || typeof docPayload !== 'object') return undefined;
  if (docPayload.kind === 'presentation') {
    return {
      kind: 'presentation',
      title: clampString(docPayload.title || '발표 자료', 200),
      subtitle: clampString(docPayload.subtitle || '', 300),
      subjectLabel: clampString(docPayload.subjectLabel || '', 80),
      authorLine: clampString(docPayload.authorLine || '', 180),
      ...(typeof docPayload.themeId === 'string' && ALLOWED_PPT_THEMES.has(docPayload.themeId)
        ? { themeId: docPayload.themeId }
        : {}),
      ...(docPayload.density === 'concise' ||
      docPayload.density === 'balanced' ||
      docPayload.density === 'rich'
        ? { density: docPayload.density }
        : {}),
      ...(docPayload.designStyle === 'auto' ||
      docPayload.designStyle === 'infographic' ||
      docPayload.designStyle === 'analytical' ||
      docPayload.designStyle === 'editorial'
        ? { designStyle: docPayload.designStyle }
        : {}),
      ...(typeof docPayload.coverStyle === 'string' &&
      ALLOWED_COVER_STYLES.has(docPayload.coverStyle)
        ? { coverStyle: docPayload.coverStyle }
        : {}),
      slides: (Array.isArray(docPayload.slides) ? docPayload.slides : [])
        .slice(0, 18)
        .map((s) => ({
          layout:
            typeof s?.layout === 'string' && ALLOWED_SLIDE_LAYOUTS.has(s.layout)
              ? s.layout
              : 'bullets',
          title: clampString(s?.title || '', 180),
          ...(s?.subtitle ? { subtitle: clampString(s.subtitle, 220) } : {}),
          ...(s?.kicker ? { kicker: clampString(s.kicker, 80) } : {}),
          bullets: (Array.isArray(s?.bullets) ? s.bullets : [])
            .slice(0, 12)
            .map((b) => clampString(typeof b === 'string' ? b : String(b ?? ''), 400)),
          ...(s?.leftTitle ? { leftTitle: clampString(s.leftTitle, 140) } : {}),
          ...(s?.rightTitle ? { rightTitle: clampString(s.rightTitle, 140) } : {}),
          ...(Array.isArray(s?.rightBullets)
            ? {
                rightBullets: s.rightBullets
                  .slice(0, 12)
                  .map((b) => clampString(typeof b === 'string' ? b : String(b ?? ''), 400)),
              }
            : {}),
          ...(Array.isArray(s?.cards)
            ? {
                cards: s.cards
                  .filter((c) => c && typeof c === 'object')
                  .slice(0, 6)
                  .map((c) => ({
                    title: clampString(typeof c.title === 'string' ? c.title : '', 120),
                    body: clampString(typeof c.body === 'string' ? c.body : '', 360),
                    ...(typeof c.tag === 'string' && c.tag
                      ? { tag: clampString(c.tag, 60) }
                      : {}),
                  })),
              }
            : {}),
          ...(Array.isArray(s?.steps)
            ? {
                steps: s.steps
                  .filter((st) => st && typeof st === 'object')
                  .slice(0, 6)
                  .map((st) => ({
                    step: clampString(typeof st.step === 'string' ? st.step : '', 40),
                    title: clampString(typeof st.title === 'string' ? st.title : '', 120),
                    detail: clampString(typeof st.detail === 'string' ? st.detail : '', 320),
                  })),
              }
            : {}),
          ...(Array.isArray(s?.stats)
            ? {
                stats: s.stats
                  .filter((st) => st && typeof st === 'object')
                  .slice(0, 4)
                  .map((st) => ({
                    value: clampString(typeof st.value === 'string' ? st.value : '', 60),
                    label: clampString(typeof st.label === 'string' ? st.label : '', 100),
                    ...(typeof st.note === 'string' && st.note
                      ? { note: clampString(st.note, 200) }
                      : {}),
                  })),
              }
            : {}),
          ...(s?.quoteText ? { quoteText: clampString(s.quoteText, 500) } : {}),
          ...(s?.quoteAuthor ? { quoteAuthor: clampString(s.quoteAuthor, 120) } : {}),
          ...(s?.callout ? { callout: clampString(s.callout, 360) } : {}),
          ...(Array.isArray(s?.tableHeaders)
            ? {
                tableHeaders: s.tableHeaders
                  .slice(0, 8)
                  .map((h) => clampString(typeof h === 'string' ? h : String(h ?? ''), 120)),
              }
            : {}),
          ...(Array.isArray(s?.tableRows)
            ? {
                tableRows: s.tableRows.slice(0, 12).map((row) =>
                  (Array.isArray(row) ? row : [])
                    .slice(0, 8)
                    .map((c) => clampString(typeof c === 'string' ? c : String(c ?? ''), 220))
                ),
              }
            : {}),
          ...(s?.speakerNotes ? { speakerNotes: clampString(s.speakerNotes, 1000) } : {}),
        })),
    };
  }
  return {
    kind: 'document',
    title: clampString(docPayload.title || '학습 문서', 200),
    subtitle: clampString(docPayload.subtitle || '', 300),
    subjectLabel: clampString(docPayload.subjectLabel || '', 80),
    authorLine: clampString(docPayload.authorLine || '', 180),
    overview: clampString(docPayload.overview || '', 1500),
    sections: (Array.isArray(docPayload.sections) ? docPayload.sections : [])
      .slice(0, 12)
      .map((sec) => ({
        heading: clampString(sec?.heading || '', 180),
        ...(sec?.summary ? { summary: clampString(sec.summary, 300) } : {}),
        paragraphs: (Array.isArray(sec?.paragraphs) ? sec.paragraphs : [])
          .slice(0, 8)
          .map((p) => clampString(typeof p === 'string' ? p : String(p ?? ''), 2000)),
        ...(Array.isArray(sec?.bullets)
          ? {
              bullets: sec.bullets
                .slice(0, 12)
                .map((b) => clampString(typeof b === 'string' ? b : String(b ?? ''), 400)),
            }
          : {}),
        ...(sec?.callout ? { callout: clampString(sec.callout, 500) } : {}),
        ...(Array.isArray(sec?.tableHeaders)
          ? {
              tableHeaders: sec.tableHeaders
                .slice(0, 8)
                .map((h) => clampString(typeof h === 'string' ? h : String(h ?? ''), 120)),
            }
          : {}),
        ...(Array.isArray(sec?.tableRows)
          ? {
              tableRows: sec.tableRows.slice(0, 14).map((row) =>
                (Array.isArray(row) ? row : [])
                  .slice(0, 8)
                  .map((c) => clampString(typeof c === 'string' ? c : String(c ?? ''), 250))
              ),
            }
          : {}),
      })),
    ...(docPayload.conclusion ? { conclusion: clampString(docPayload.conclusion, 1500) } : {}),
  };
}

function stripHeavyAttachmentFields(msg: ChatMessage, index: number): Record<string, unknown> {
  const safeId =
    typeof msg.id === 'string' && msg.id.trim()
      ? msg.id.slice(0, 120)
      : `msg_${Date.now()}_${index}`;
  const safeContent = typeof msg.content === 'string' ? msg.content.slice(0, 40000) : '';
  const base: Record<string, unknown> = {
    id: safeId,
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: safeContent,
    createdAt: typeof msg.createdAt === 'number' && Number.isFinite(msg.createdAt) ? msg.createdAt : Date.now(),
  };
  if (typeof msg.error === 'boolean') {
    base.error = msg.error;
  }
  if (
    msg.requestedFormat &&
    ['pdf', 'hwpx', 'docx', 'pptx'].includes(msg.requestedFormat)
  ) {
    base.requestedFormat = msg.requestedFormat;
  }
  const safeArtifact = sanitizeGeneratedDocumentForCloud(msg.generatedDocument);
  if (safeArtifact) {
    base.generatedDocument = safeArtifact;
  }
  if (Array.isArray(msg.sources) && msg.sources.length > 0) {
    base.sources = msg.sources
      .filter((s) => s && typeof s.uri === 'string' && s.uri.trim())
      .slice(0, 20)
      .map((s) => ({
        title: clampString(typeof s.title === 'string' ? s.title : '', 200),
        uri: clampString(s.uri, 500),
      }));
  }
  if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    base.attachments = msg.attachments
      .filter((att) => att && typeof att.name === 'string')
      .slice(0, 20)
      .map((att) => ({
        name: clampString(att.name, 160),
        mimeType: clampString(typeof att.mimeType === 'string' ? att.mimeType : 'application/octet-stream', 100),
        ...(typeof att.textSnippet === 'string' && att.textSnippet
          ? { textSnippet: clampString(att.textSnippet, 160) }
          : {}),
      }));
  }
  return base;
}

export async function ensureUserProfileDoc(
  user: User,
  fallbackGradeLevel: GradeLevel
): Promise<CloudUserPrefs> {
  const uid = user.uid;
  const userRef = doc(db, 'users', uid);
  const path = `users/${uid}`;

  const displayName = clampString(
    user.displayName?.trim() || user.email?.split('@')[0] || 'Google 학습자',
    80
  );
  const email = clampString(user.email || '', 160);
  const photoURL = user.photoURL ? clampString(user.photoURL, 500) : undefined;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        email,
        gradeLevel: fallbackGradeLevel,
        connectCareer: true,
        careerPromptDismissed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        payload.photoURL = photoURL;
      }
      await setDoc(userRef, payload);
      return {
        uid,
        displayName,
        email,
        photoURL,
        gradeLevel: fallbackGradeLevel,
        connectCareer: true,
        careerPromptDismissed: false,
      };
    }

    const data = snap.data() as Record<string, unknown>;
    const needsSync =
      data.displayName !== displayName ||
      data.email !== email ||
      (photoURL && data.photoURL !== photoURL);

    if (needsSync) {
      const syncPatch: Record<string, unknown> = {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        syncPatch.photoURL = photoURL;
      }
      await updateDoc(userRef, syncPatch);
    }

    return {
      uid,
      displayName,
      email,
      photoURL: photoURL || (typeof data.photoURL === 'string' ? data.photoURL : undefined),
      gradeLevel: data.gradeLevel === 'middle' ? 'middle' : 'high',
      careerGoal:
        typeof data.careerGoal === 'string' && data.careerGoal.trim()
          ? data.careerGoal
          : undefined,
      careerPromptDismissed: Boolean(data.careerPromptDismissed),
      connectCareer: typeof data.connectCareer === 'boolean' ? data.connectCareer : true,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserStudyPrefs(
  uid: string,
  patch: {
    gradeLevel?: GradeLevel;
    careerGoal?: string;
    careerPromptDismissed?: boolean;
    connectCareer?: boolean;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.gradeLevel !== undefined) {
    updatePayload.gradeLevel = patch.gradeLevel;
  }
  if (patch.careerGoal !== undefined) {
    updatePayload.careerGoal = clampString(patch.careerGoal, 80);
  }
  if (patch.careerPromptDismissed !== undefined) {
    updatePayload.careerPromptDismissed = patch.careerPromptDismissed;
  }
  if (patch.connectCareer !== undefined) {
    updatePayload.connectCareer = patch.connectCareer;
  }

  try {
    await updateDoc(doc(db, 'users', uid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSessionToCloud(
  uid: string,
  session: NotebookSession
): Promise<void> {
  const docId = sanitizeDocId(session.id || 'note', 'note');
  const path = `users/${uid}/sessions/${docId}`;
  const ref = doc(db, 'users', uid, 'sessions', docId);

  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  const messagesPayload = rawMessages
    .slice(-120)
    .map((msg, idx) => stripHeavyAttachmentFields(msg, idx));

  const safeTitle = clampString(
    (typeof session.title === 'string' ? session.title.trim() : '') || '새 학습 노트',
    160
  );
  const safeSubTrack =
    typeof session.subTrackId === 'string' && session.subTrackId.trim()
      ? clampString(session.subTrackId.trim(), 60)
      : undefined;
  const safeWorkspace = sanitizeWorkspaceId(session.workspaceId);
  const safeGrade = sanitizeGradeLevel(session.gradeLevel);
  const safeStudyMode = sanitizeStudyMode(session.studyMode);
  const safeThinkingDepth = session.thinkingDepth === 'deep' ? 'deep' : 'standard';
  const safeUpdatedAtMs =
    typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt)
      ? session.updatedAt
      : Date.now();

  const createPayload: Record<string, unknown> = {
    id: docId,
    ownerId: uid,
    workspaceId: safeWorkspace,
    gradeLevel: safeGrade,
    studyMode: safeStudyMode,
    thinkingDepth: safeThinkingDepth,
    title: safeTitle,
    messages: messagesPayload,
    pinned: Boolean(session.pinned),
    updatedAtMs: safeUpdatedAtMs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (safeSubTrack) {
    createPayload.subTrackId = safeSubTrack;
  }

  try {
    let exists = knownSessionIds.has(docId);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) knownSessionIds.add(docId);
    }

    if (!exists) {
      await setDoc(ref, createPayload);
      knownSessionIds.add(docId);
    } else {
      const updatePayload: Record<string, unknown> = {
        gradeLevel: safeGrade,
        studyMode: safeStudyMode,
        thinkingDepth: safeThinkingDepth,
        title: safeTitle,
        messages: messagesPayload,
        updatedAtMs: safeUpdatedAtMs,
        updatedAt: serverTimestamp(),
      };
      if (safeSubTrack) {
        updatePayload.subTrackId = safeSubTrack;
      }
      try {
        await updateDoc(ref, updatePayload);
      } catch (updateErr) {
        const code =
          typeof updateErr === 'object' && updateErr !== null && 'code' in updateErr
            ? String((updateErr as { code?: unknown }).code)
            : '';
        if (code === 'not-found') {
          await setDoc(ref, createPayload);
          knownSessionIds.add(docId);
        } else {
          throw updateErr;
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleSessionPinInCloud(
  uid: string,
  sessionId: string,
  pinned: boolean
): Promise<void> {
  const docId = sanitizeDocId(sessionId, 'note');
  const path = `users/${uid}/sessions/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'sessions', docId), {
      pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSessionFromCloud(
  uid: string,
  sessionId: string
): Promise<void> {
  const docId = sanitizeDocId(sessionId, 'note');
  const path = `users/${uid}/sessions/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', docId));
    knownSessionIds.delete(docId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePromptToCloud(
  uid: string,
  prompt: SavedPrompt
): Promise<void> {
  const docId = sanitizeDocId(prompt.id || 'prompt', 'prompt');
  const path = `users/${uid}/prompts/${docId}`;
  const ref = doc(db, 'users', uid, 'prompts', docId);
  try {
    let exists = knownPromptIds.has(docId);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) knownPromptIds.add(docId);
    }
    const safeTitle = clampString(
      (typeof prompt.title === 'string' ? prompt.title.trim() : '') || '저장한 프롬프트',
      120
    );
    const safeContent = clampString(
      (typeof prompt.content === 'string' ? prompt.content.trim() : '') || ' ',
      4000
    );
    const safeWorkspace =
      prompt.workspaceId === 'all' ? 'all' : sanitizeWorkspaceId(prompt.workspaceId);
    const safeCreatedAtMs =
      typeof prompt.createdAt === 'number' && Number.isFinite(prompt.createdAt)
        ? prompt.createdAt
        : Date.now();
    if (!exists) {
      await setDoc(ref, {
        id: docId,
        ownerId: uid,
        title: safeTitle,
        content: safeContent,
        workspaceId: safeWorkspace,
        createdAtMs: safeCreatedAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownPromptIds.add(docId);
    } else {
      await updateDoc(ref, {
        title: safeTitle,
        content: safeContent,
        workspaceId: safeWorkspace,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePromptFromCloud(
  uid: string,
  promptId: string
): Promise<void> {
  const docId = sanitizeDocId(promptId, 'prompt');
  const path = `users/${uid}/prompts/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'prompts', docId));
    knownPromptIds.delete(docId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveStudyNoteToCloud(
  uid: string,
  note: SavedStudyNote
): Promise<void> {
  const docId = sanitizeDocId(note.id || 'studynote', 'studynote');
  const path = `users/${uid}/studyNotes/${docId}`;
  const ref = doc(db, 'users', uid, 'studyNotes', docId);
  try {
    let exists = knownStudyNoteIds.has(docId);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) knownStudyNoteIds.add(docId);
    }
    const safeTitle = clampString(
      (typeof note.title === 'string' ? note.title.trim() : '') || '핵심 노트',
      160
    );
    const safeContent = clampString(
      (typeof note.content === 'string' ? note.content.trim() : '') || ' ',
      30000
    );
    const safeWorkspace = sanitizeWorkspaceId(note.workspaceId);
    const safeGrade = sanitizeGradeLevel(note.gradeLevel);
    const safeCreatedAtMs =
      typeof note.createdAt === 'number' && Number.isFinite(note.createdAt)
        ? note.createdAt
        : Date.now();
    if (!exists) {
      const payload: Record<string, unknown> = {
        id: docId,
        ownerId: uid,
        workspaceId: safeWorkspace,
        gradeLevel: safeGrade,
        title: safeTitle,
        content: safeContent,
        mastered: Boolean(note.mastered),
        createdAtMs: safeCreatedAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (typeof note.subTrackLabel === 'string' && note.subTrackLabel.trim()) {
        payload.subTrackLabel = clampString(note.subTrackLabel.trim(), 80);
      }
      await setDoc(ref, payload);
      knownStudyNoteIds.add(docId);
    } else {
      await updateDoc(ref, {
        title: safeTitle,
        content: safeContent,
        mastered: Boolean(note.mastered),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleStudyNoteMasteredInCloud(
  uid: string,
  noteId: string,
  mastered: boolean
): Promise<void> {
  const docId = sanitizeDocId(noteId, 'studynote');
  const path = `users/${uid}/studyNotes/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'studyNotes', docId), {
      mastered,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudyNoteFromCloud(
  uid: string,
  noteId: string
): Promise<void> {
  const docId = sanitizeDocId(noteId, 'studynote');
  const path = `users/${uid}/studyNotes/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'studyNotes', docId));
    knownStudyNoteIds.delete(docId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSearchHistoryToCloud(
  uid: string,
  entry: SearchHistoryEntry
): Promise<void> {
  const docId = sanitizeDocId(entry.id || 'search', 'search');
  const path = `users/${uid}/searchHistory/${docId}`;
  const ref = doc(db, 'users', uid, 'searchHistory', docId);
  try {
    let exists = knownSearchIds.has(docId);
    if (!exists) {
      const snap = await getDoc(ref);
      exists = snap.exists();
      if (exists) knownSearchIds.add(docId);
    }
    const safeQuery = clampString(
      (typeof entry.query === 'string' ? entry.query.trim() : '') || '검색',
      300
    );
    const safeSessionId = sanitizeDocId(entry.sessionId || 'note', 'note');
    const safeCreatedAtMs =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
        ? entry.createdAt
        : Date.now();
    if (!exists) {
      const payload: Record<string, unknown> = {
        id: docId,
        ownerId: uid,
        query: safeQuery,
        sessionId: safeSessionId,
        createdAtMs: safeCreatedAtMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (typeof entry.subTrackId === 'string' && entry.subTrackId.trim()) {
        payload.subTrackId = clampString(entry.subTrackId.trim(), 60);
      }
      await setDoc(ref, payload);
      knownSearchIds.add(docId);
    } else {
      const updatePayload: Record<string, unknown> = {
        query: safeQuery,
        sessionId: safeSessionId,
        createdAtMs: safeCreatedAtMs,
        updatedAt: serverTimestamp(),
      };
      if (typeof entry.subTrackId === 'string' && entry.subTrackId.trim()) {
        updatePayload.subTrackId = clampString(entry.subTrackId.trim(), 60);
      }
      await updateDoc(ref, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function migrateGuestDataToCloud(
  uid: string,
  guestData: {
    sessions: NotebookSession[];
    prompts: SavedPrompt[];
    studyNotes: SavedStudyNote[];
    searchHistory: SearchHistoryEntry[];
    careerGoal?: string;
    gradeLevel?: GradeLevel;
  }
): Promise<void> {
  if (guestData.careerGoal || guestData.gradeLevel) {
    try {
      await updateUserStudyPrefs(uid, {
        ...(guestData.careerGoal ? { careerGoal: guestData.careerGoal, careerPromptDismissed: true } : {}),
        ...(guestData.gradeLevel ? { gradeLevel: guestData.gradeLevel } : {}),
      });
    } catch (err) {
      console.warn('Guest profile prefs migration skipped:', err);
    }
  }

  for (const session of guestData.sessions.slice(0, 20)) {
    if (Array.isArray(session?.messages) && session.messages.length > 0) {
      try {
        await saveSessionToCloud(uid, session);
      } catch (err) {
        console.warn('Guest session migration skipped:', session?.id, err);
      }
    }
  }
  for (const prompt of guestData.prompts.slice(0, 30)) {
    try {
      await savePromptToCloud(uid, prompt);
    } catch (err) {
      console.warn('Guest prompt migration skipped:', prompt?.id, err);
    }
  }
  for (const note of guestData.studyNotes.slice(0, 40)) {
    try {
      await saveStudyNoteToCloud(uid, note);
    } catch (err) {
      console.warn('Guest studyNote migration skipped:', note?.id, err);
    }
  }
  for (const entry of guestData.searchHistory.slice(0, 20)) {
    try {
      await saveSearchHistoryToCloud(uid, entry);
    } catch (err) {
      console.warn('Guest searchHistory migration skipped:', entry?.id, err);
    }
  }
}

export function subscribeUserStudyData(
  uid: string,
  handlers: {
    onProfilePrefs: (prefs: Partial<CloudUserPrefs>) => void;
    onSessions: (sessions: NotebookSession[]) => void;
    onPrompts: (prompts: SavedPrompt[]) => void;
    onStudyNotes: (notes: SavedStudyNote[]) => void;
    onSearchHistory: (entries: SearchHistoryEntry[]) => void;
  },
  onError?: (err: Error) => void
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const handleErr = (err: unknown) => {
    if (onError && err instanceof Error) {
      onError(err);
    }
  };

  // 1. User profile prefs listener
  const userPath = `users/${uid}`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        handlers.onProfilePrefs({
          displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
          email: typeof data.email === 'string' ? data.email : undefined,
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
          gradeLevel: data.gradeLevel === 'middle' ? 'middle' : 'high',
          careerGoal:
            typeof data.careerGoal === 'string' && data.careerGoal.trim()
              ? data.careerGoal
              : undefined,
          careerPromptDismissed: Boolean(data.careerPromptDismissed),
          connectCareer: typeof data.connectCareer === 'boolean' ? data.connectCareer : true,
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch (e) {
          handleErr(e);
        }
      }
    )
  );

  // 2. Sessions listener
  const sessionsPath = `users/${uid}/sessions`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'sessions'), where('ownerId', '==', uid)),
      (snap) => {
        const list: NotebookSession[] = snap.docs.map((d) => {
          knownSessionIds.add(d.id);
          const data = d.data() as Record<string, unknown>;
          const rawMessages = Array.isArray(data.messages) ? data.messages : [];
          const normalizedMessages: ChatMessage[] = rawMessages
            .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
            .map((m, idx) => ({
              ...(m as unknown as ChatMessage),
              id: typeof m.id === 'string' && m.id ? m.id : `msg_${d.id}_${idx}`,
              role: m.role === 'user' ? 'user' : 'assistant',
              content: typeof m.content === 'string' ? m.content : '',
              createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
            }));
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            workspaceId: sanitizeWorkspaceId(data.workspaceId),
            subTrackId: typeof data.subTrackId === 'string' ? data.subTrackId : undefined,
            gradeLevel: sanitizeGradeLevel(data.gradeLevel),
            studyMode: sanitizeStudyMode(data.studyMode),
            thinkingDepth: data.thinkingDepth === 'deep' ? 'deep' : 'standard',
            title: typeof data.title === 'string' ? data.title : '학습 노트',
            messages: normalizedMessages,
            pinned: Boolean(data.pinned),
            updatedAt: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : Date.now(),
          };
        });
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        handlers.onSessions(list.slice(0, 40));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, sessionsPath);
        } catch (e) {
          handleErr(e);
        }
      }
    )
  );

  // 3. Prompts listener
  const promptsPath = `users/${uid}/prompts`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'prompts'), where('ownerId', '==', uid)),
      (snap) => {
        const list: SavedPrompt[] = snap.docs.map((d) => {
          knownPromptIds.add(d.id);
          const data = d.data() as Record<string, unknown>;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            title: typeof data.title === 'string' ? data.title : '',
            content: typeof data.content === 'string' ? data.content : '',
            workspaceId: (data.workspaceId as WorkspaceId | 'all') || 'all',
            createdAt: typeof data.createdAtMs === 'number' ? data.createdAtMs : Date.now(),
          };
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        handlers.onPrompts(list.slice(0, 60));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, promptsPath);
        } catch (e) {
          handleErr(e);
        }
      }
    )
  );

  // 4. Study notes listener
  const notesPath = `users/${uid}/studyNotes`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'studyNotes'), where('ownerId', '==', uid)),
      (snap) => {
        const list: SavedStudyNote[] = snap.docs.map((d) => {
          knownStudyNoteIds.add(d.id);
          const data = d.data() as Record<string, unknown>;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            workspaceId: data.workspaceId as WorkspaceId,
            subTrackLabel:
              typeof data.subTrackLabel === 'string' ? data.subTrackLabel : undefined,
            gradeLevel: data.gradeLevel === 'middle' ? 'middle' : 'high',
            title: typeof data.title === 'string' ? data.title : '',
            content: typeof data.content === 'string' ? data.content : '',
            mastered: Boolean(data.mastered),
            createdAt: typeof data.createdAtMs === 'number' ? data.createdAtMs : Date.now(),
          };
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        handlers.onStudyNotes(list.slice(0, 80));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, notesPath);
        } catch (e) {
          handleErr(e);
        }
      }
    )
  );

  // 5. Search history listener
  const searchPath = `users/${uid}/searchHistory`;
  unsubscribers.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'searchHistory'), where('ownerId', '==', uid)),
      (snap) => {
        const list: SearchHistoryEntry[] = snap.docs.map((d) => {
          knownSearchIds.add(d.id);
          const data = d.data() as Record<string, unknown>;
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            query: typeof data.query === 'string' ? data.query : '',
            subTrackId: typeof data.subTrackId === 'string' ? data.subTrackId : undefined,
            sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
            createdAt: typeof data.createdAtMs === 'number' ? data.createdAtMs : Date.now(),
          };
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        handlers.onSearchHistory(list.slice(0, 20));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, searchPath);
        } catch (e) {
          handleErr(e);
        }
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
