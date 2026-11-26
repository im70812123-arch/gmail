import JSZip from 'jszip';
import type { AttachmentPayload } from '../types/study';
import { fileToOptimizedImageAttachment } from './imageOptimize';

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_DOC_AND_MEDIA_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,.pdf,.hwpx,.hwp,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.odt,.odp,.ods,.txt,.md,.csv,.tsv,.json,.py,.js,.ts,.tsx,.jsx,.html,.htm,.xml,.yaml,.yml,.rtf,.tex';

export type AttachmentBadgeKind =
  | 'image'
  | 'pdf'
  | 'hwp'
  | 'ppt'
  | 'docx'
  | 'xlsx'
  | 'text';

export function getAttachmentVisualInfo(
  name: string,
  mimeType: string
): { label: string; kind: AttachmentBadgeKind } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    return { label: 'IMG', kind: 'image' };
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { label: 'PDF', kind: 'pdf' };
  }
  if (ext === 'hwpx' || ext === 'hwp') {
    return { label: ext.toUpperCase(), kind: 'hwp' };
  }
  if (ext === 'pptx' || ext === 'ppt' || ext === 'odp') {
    return { label: ext.toUpperCase(), kind: 'ppt' };
  }
  if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf') {
    return { label: ext.toUpperCase(), kind: 'docx' };
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods' || ext === 'csv' || ext === 'tsv') {
    return { label: ext.toUpperCase(), kind: 'xlsx' };
  }
  return { label: (ext || 'TXT').slice(0, 4).toUpperCase(), kind: 'text' };
}

function getLocalName(node: Node): string {
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  return (el.localName || el.nodeName.split(':').pop() || '').toLowerCase();
}

function getDirectChildrenByLocalName(parent: Element, name: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (getLocalName(child) === name) {
      result.push(child);
    }
  }
  return result;
}

function formatMarkdownTable(rows: string[][]): string {
  const cleanRows = rows
    .map((row) => row.map((cell) => cell.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()))
    .filter((row) => row.some((c) => c.length > 0));
  if (cleanRows.length === 0) return '';

  const colCount = Math.max(...cleanRows.map((r) => r.length));
  const padded = cleanRows.map((row) => {
    const copy = [...row];
    while (copy.length < colCount) copy.push('');
    return copy;
  });

  const header = `| ${padded[0].join(' | ')} |`;
  const divider = `| ${padded[0].map(() => '---').join(' | ')} |`;
  const body = padded.slice(1).map((row) => `| ${row.join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function parseXmlDoc(xmlString: string): Document | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return null;
  }
  return doc;
}

function collectParagraphTextFromSubtree(
  node: Node,
  options: { textTagNames: string[]; breakTagNames: string[]; tabTagNames: string[] }
): string {
  if (node.nodeType === 3) {
    return node.nodeValue || '';
  }
  if (node.nodeType !== 1) return '';
  const local = getLocalName(node);
  if (options.breakTagNames.includes(local)) return '\n';
  if (options.tabTagNames.includes(local)) return '\t';
  if (options.textTagNames.includes(local)) {
    return node.textContent || '';
  }

  let out = '';
  node.childNodes.forEach((child) => {
    out += collectParagraphTextFromSubtree(child, options);
  });
  return out;
}

function extractDrawingMlTable(tblEl: Element): string {
  const rows: string[][] = [];
  const trs = getDirectChildrenByLocalName(tblEl, 'tr');
  for (const tr of trs) {
    const rowCells: string[] = [];
    const tcs = getDirectChildrenByLocalName(tr, 'tc');
    for (const tc of tcs) {
      const pList: string[] = [];
      const ps = tc.getElementsByTagName('*');
      for (let i = 0; i < ps.length; i++) {
        if (getLocalName(ps[i]) === 'p') {
          const text = collectParagraphTextFromSubtree(ps[i], {
            textTagNames: ['t'],
            breakTagNames: ['br'],
            tabTagNames: ['tab'],
          }).trim();
          if (text) pList.push(text);
        }
      }
      rowCells.push(pList.join(' '));
    }
    rows.push(rowCells);
  }
  return formatMarkdownTable(rows);
}

function extractTextFromSlideOrNotesXml(xml: string): string {
  const doc = parseXmlDoc(xml);
  if (!doc || !doc.documentElement) return '';

  const chunks: string[] = [];
  const walk = (el: Element) => {
    const local = getLocalName(el);
    if (local === 'tbl') {
      const mdTable = extractDrawingMlTable(el);
      if (mdTable) chunks.push(mdTable);
      return;
    }
    if (local === 'p') {
      const pText = collectParagraphTextFromSubtree(el, {
        textTagNames: ['t'],
        breakTagNames: ['br'],
        tabTagNames: ['tab'],
      }).trim();
      if (pText) chunks.push(pText);
      return;
    }
    for (let i = 0; i < el.children.length; i++) {
      walk(el.children[i]);
    }
  };

  walk(doc.documentElement);
  return chunks.join('\n').trim();
}

async function extractImagesFromZip(
  zip: JSZip,
  mediaPrefixRegex: RegExp,
  docName: string,
  maxCount = 5
): Promise<AttachmentPayload[]> {
  const mediaEntries = Object.keys(zip.files)
    .filter((p) => !zip.files[p].dir && mediaPrefixRegex.test(p))
    .sort()
    .slice(0, maxCount);

  const imageAtts: AttachmentPayload[] = [];
  for (const entryPath of mediaEntries) {
    const ext = entryPath.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const mime = mimeMap[ext];
    if (!mime) continue;
    try {
      const blob = await zip.files[entryPath].async('blob');
      const imgFile = new File([blob], `${docName}_${entryPath.split('/').pop() || 'slide.png'}`, {
        type: mime,
      });
      const optimized = await fileToOptimizedImageAttachment(imgFile);
      imageAtts.push(optimized);
    } catch {
      // skip corrupt or non-raster media
    }
  }
  return imageAtts;
}

async function extractPptxAttachments(file: File): Promise<AttachmentPayload[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return numA - numB;
    });

  const sections: string[] = [];

  for (const slidePath of slidePaths) {
    const slideNum = Number(slidePath.match(/slide(\d+)\.xml/i)?.[1] || 0);
    const slideXml = await zip.files[slidePath].async('string');
    const slideBody = extractTextFromSlideOrNotesXml(slideXml);

    let notesText = '';
    const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    if (zip.files[relPath]) {
      const relXml = await zip.files[relPath].async('string');
      const notesMatch = relXml.match(/Target=["']\.\.\/notesSlides\/(notesSlide\d+\.xml)["']/i);
      const targetNotes = notesMatch
        ? `ppt/notesSlides/${notesMatch[1]}`
        : `ppt/notesSlides/notesSlide${slideNum}.xml`;
      if (zip.files[targetNotes]) {
        const notesXml = await zip.files[targetNotes].async('string');
        const rawNotes = extractTextFromSlideOrNotesXml(notesXml);
        // Strip standalone slide page number echoed inside notes master
        const cleanedNotes = rawNotes
          .split('\n')
          .filter((line) => line.trim() !== String(slideNum))
          .join('\n')
          .trim();
        if (cleanedNotes) notesText = cleanedNotes;
      }
    }

    const parts = [`=== [슬라이드 ${slideNum}] ===`];
    if (slideBody) parts.push(slideBody);
    if (notesText) parts.push(`[발표자 노트]\n${notesText}`);
    if (slideBody || notesText) {
      sections.push(parts.join('\n'));
    }
  }

  const combinedText = sections.join('\n\n').trim();
  const result: AttachmentPayload[] = [];

  if (combinedText) {
    result.push({
      name: file.name,
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      textContent: `[PPTX 프레젠테이션 · 총 ${slidePaths.length}장]\n\n${combinedText}`,
      sizeBytes: file.size,
    });
  }

  // If presentation contains very little text (e.g. screenshot-only slides), also attach embedded slide images
  if (combinedText.length < 80) {
    const embeddedImages = await extractImagesFromZip(zip, /^ppt\/media\//i, file.name, 5);
    result.push(...embeddedImages);
  }

  return result;
}

function extractWordTable(tblEl: Element): string {
  const rows: string[][] = [];
  const trs = getDirectChildrenByLocalName(tblEl, 'tr');
  for (const tr of trs) {
    const rowCells: string[] = [];
    const tcs = getDirectChildrenByLocalName(tr, 'tc');
    for (const tc of tcs) {
      const cellParagraphs: string[] = [];
      const ps = getDirectChildrenByLocalName(tc, 'p');
      for (const p of ps) {
        const text = collectParagraphTextFromSubtree(p, {
          textTagNames: ['t', 'deltext'],
          breakTagNames: ['br', 'cr'],
          tabTagNames: ['tab'],
        }).trim();
        if (text) cellParagraphs.push(text);
      }
      rowCells.push(cellParagraphs.join(' '));
    }
    rows.push(rowCells);
  }
  return formatMarkdownTable(rows);
}

async function extractDocxAttachments(file: File): Promise<AttachmentPayload[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const blocks: string[] = [];
  if (zip.files['word/document.xml']) {
    const xml = await zip.files['word/document.xml'].async('string');
    const doc = parseXmlDoc(xml);
    if (doc?.documentElement) {
      const body =
        getDirectChildrenByLocalName(doc.documentElement, 'body')[0] ||
        doc.documentElement;
      for (let i = 0; i < body.children.length; i++) {
        const child = body.children[i];
        const local = getLocalName(child);
        if (local === 'tbl') {
          const mdTable = extractWordTable(child);
          if (mdTable) blocks.push(mdTable);
        } else if (local === 'p') {
          const pText = collectParagraphTextFromSubtree(child, {
            textTagNames: ['t'],
            breakTagNames: ['br', 'cr'],
            tabTagNames: ['tab'],
          }).trim();
          if (pText) {
            const pPr = getDirectChildrenByLocalName(child, 'pPr')[0];
            const pStyle = pPr ? getDirectChildrenByLocalName(pPr, 'pStyle')[0] : undefined;
            const styleVal = pStyle?.getAttribute('w:val') || pStyle?.getAttribute('val') || '';
            if (/^Heading1|^1$/i.test(styleVal)) {
              blocks.push(`# ${pText}`);
            } else if (/^Heading2|^2$/i.test(styleVal)) {
              blocks.push(`## ${pText}`);
            } else if (/^Heading3|^3$/i.test(styleVal)) {
              blocks.push(`### ${pText}`);
            } else {
              blocks.push(pText);
            }
          }
        }
      }
    }
  }

  const combinedText = blocks.join('\n\n').trim();
  const result: AttachmentPayload[] = [];
  if (combinedText) {
    result.push({
      name: file.name,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      textContent: combinedText,
      sizeBytes: file.size,
    });
  }

  if (combinedText.length < 80) {
    const embeddedImages = await extractImagesFromZip(zip, /^word\/media\//i, file.name, 5);
    result.push(...embeddedImages);
  }
  return result;
}

function extractHwpxTable(tblEl: Element): string {
  const rows: string[][] = [];
  const trs = getDirectChildrenByLocalName(tblEl, 'tr');
  for (const tr of trs) {
    const rowCells: string[] = [];
    const tcs = getDirectChildrenByLocalName(tr, 'tc');
    for (const tc of tcs) {
      const cellParagraphs: string[] = [];
      const all = tc.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        if (getLocalName(all[i]) === 'p') {
          const text = collectParagraphTextFromSubtree(all[i], {
            textTagNames: ['t'],
            breakTagNames: ['linebreak'],
            tabTagNames: ['tab'],
          }).trim();
          if (text) cellParagraphs.push(text);
        }
      }
      rowCells.push(cellParagraphs.join(' '));
    }
    rows.push(rowCells);
  }
  return formatMarkdownTable(rows);
}

async function extractHwpxAttachments(file: File): Promise<AttachmentPayload[]> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const sectionPaths = Object.keys(zip.files)
    .filter((p) => /^Contents\/section\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = Number(a.match(/section(\d+)\.xml/i)?.[1] || 0);
      const numB = Number(b.match(/section(\d+)\.xml/i)?.[1] || 0);
      return numA - numB;
    });

  const blocks: string[] = [];

  for (const secPath of sectionPaths) {
    const xml = await zip.files[secPath].async('string');
    const doc = parseXmlDoc(xml);
    if (!doc?.documentElement) continue;

    const walk = (el: Element) => {
      const local = getLocalName(el);
      if (local === 'tbl') {
        const mdTable = extractHwpxTable(el);
        if (mdTable) blocks.push(mdTable);
        return;
      }
      if (local === 'p') {
        // Check if paragraph contains a nested table
        let hasTable = false;
        for (let i = 0; i < el.children.length; i++) {
          if (el.children[i].getElementsByTagName('*').length > 0) {
            const subAll = el.children[i].getElementsByTagName('*');
            for (let j = 0; j < subAll.length; j++) {
              if (getLocalName(subAll[j]) === 'tbl') {
                hasTable = true;
                break;
              }
            }
          }
          if (getLocalName(el.children[i]) === 'tbl') hasTable = true;
          if (hasTable) break;
        }
        if (hasTable) {
          for (let i = 0; i < el.children.length; i++) {
            walk(el.children[i]);
          }
          return;
        }

        const pText = collectParagraphTextFromSubtree(el, {
          textTagNames: ['t'],
          breakTagNames: ['linebreak'],
          tabTagNames: ['tab'],
        }).trim();
        if (pText) blocks.push(pText);
        return;
      }
      for (let i = 0; i < el.children.length; i++) {
        walk(el.children[i]);
      }
    };

    walk(doc.documentElement);
  }

  let combinedText = blocks.join('\n').trim();
  if (!combinedText && zip.files['Preview/PrvText.txt']) {
    combinedText = (await zip.files['Preview/PrvText.txt'].async('string')).trim();
  }

  const result: AttachmentPayload[] = [];
  if (combinedText) {
    result.push({
      name: file.name,
      mimeType: 'application/hwpx+zip',
      textContent: combinedText,
      sizeBytes: file.size,
    });
  }

  if (combinedText.length < 80) {
    const embeddedImages = await extractImagesFromZip(zip, /^BinData\//i, file.name, 5);
    result.push(...embeddedImages);
  }

  return result;
}

function colRefToIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '').toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return Math.max(0, col - 1);
}

async function extractXlsxAttachment(file: File): Promise<AttachmentPayload | null> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const sharedStrings: string[] = [];
  if (zip.files['xl/sharedStrings.xml']) {
    const ssXml = await zip.files['xl/sharedStrings.xml'].async('string');
    const doc = parseXmlDoc(ssXml);
    if (doc?.documentElement) {
      const sis = getDirectChildrenByLocalName(doc.documentElement, 'si');
      for (const si of sis) {
        sharedStrings.push(si.textContent?.trim() || '');
      }
    }
  }

  const sheetNames: string[] = [];
  if (zip.files['xl/workbook.xml']) {
    const wbXml = await zip.files['xl/workbook.xml'].async('string');
    const doc = parseXmlDoc(wbXml);
    if (doc?.documentElement) {
      const sheetsEls = doc.getElementsByTagName('*');
      for (let i = 0; i < sheetsEls.length; i++) {
        if (getLocalName(sheetsEls[i]) === 'sheet') {
          sheetNames.push(sheetsEls[i].getAttribute('name') || `Sheet ${sheetNames.length + 1}`);
        }
      }
    }
  }

  const sheetPaths = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = Number(a.match(/sheet(\d+)\.xml/i)?.[1] || 0);
      const numB = Number(b.match(/sheet(\d+)\.xml/i)?.[1] || 0);
      return numA - numB;
    });

  const sections: string[] = [];
  for (let sIdx = 0; sIdx < sheetPaths.length; sIdx++) {
    const xml = await zip.files[sheetPaths[sIdx]].async('string');
    const doc = parseXmlDoc(xml);
    if (!doc?.documentElement) continue;
    const sheetTitle = sheetNames[sIdx] || `시트 ${sIdx + 1}`;
    const rows: string[][] = [];

    const rowEls = doc.getElementsByTagName('*');
    for (let i = 0; i < rowEls.length; i++) {
      if (getLocalName(rowEls[i]) !== 'row') continue;
      if (rows.length >= 250) break;
      const cells: string[] = [];
      const cellEls = getDirectChildrenByLocalName(rowEls[i], 'c');
      for (const cellEl of cellEls) {
        const ref = cellEl.getAttribute('r') || '';
        const colIdx = ref ? colRefToIndex(ref) : cells.length;
        const type = cellEl.getAttribute('t') || '';
        const vEl = getDirectChildrenByLocalName(cellEl, 'v')[0];
        const isEl = getDirectChildrenByLocalName(cellEl, 'is')[0];
        let val = '';
        if (type === 's' && vEl?.textContent) {
          val = sharedStrings[Number(vEl.textContent)] ?? '';
        } else if (type === 'inlineStr' && isEl) {
          val = isEl.textContent?.trim() || '';
        } else if (vEl?.textContent) {
          val = vEl.textContent.trim();
        }
        while (cells.length < colIdx && cells.length < 30) {
          cells.push('');
        }
        if (colIdx < 30) {
          cells[colIdx] = val;
        }
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }

    const mdTable = formatMarkdownTable(rows);
    if (mdTable) {
      sections.push(`## ${sheetTitle}\n\n${mdTable}`);
    }
  }

  const combined = sections.join('\n\n').trim();
  if (!combined) return null;
  return {
    name: file.name,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    textContent: combined,
    sizeBytes: file.size,
  };
}

async function extractOdfAttachment(file: File): Promise<AttachmentPayload | null> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  if (!zip.files['content.xml']) return null;
  const xml = await zip.files['content.xml'].async('string');
  const doc = parseXmlDoc(xml);
  if (!doc?.documentElement) return null;

  const blocks: string[] = [];
  const walk = (el: Element) => {
    const local = getLocalName(el);
    if (local === 'page') {
      const pageName = el.getAttribute('draw:name') || el.getAttribute('name') || '';
      if (pageName) blocks.push(`=== [${pageName}] ===`);
    }
    if (local === 'h' || local === 'p') {
      const txt = (el.textContent || '').trim();
      if (txt) blocks.push(local === 'h' ? `## ${txt}` : txt);
      return;
    }
    if (local === 'table') {
      const rows: string[][] = [];
      const trs = getDirectChildrenByLocalName(el, 'table-row');
      for (const tr of trs) {
        const tcs = getDirectChildrenByLocalName(tr, 'table-cell');
        rows.push(tcs.map((tc) => (tc.textContent || '').trim()));
      }
      const md = formatMarkdownTable(rows);
      if (md) blocks.push(md);
      return;
    }
    for (let i = 0; i < el.children.length; i++) {
      walk(el.children[i]);
    }
  };
  walk(doc.documentElement);

  const combined = blocks.join('\n\n').trim();
  if (!combined) return null;
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    textContent: combined,
    sizeBytes: file.size,
  };
}

function extractReadableRtfText(raw: string): string {
  // Strip destination groups like {\fonttbl ...}, {\colortbl ...}, {\stylesheet ...}, {\info ...}
  let text = raw
    .replace(/\{\\\*(?:[^{}]|\{[^{}]*\})*\}/g, ' ')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|pict|object)(?:[^{}]|\{[^{}]*\})*\}/g, ' ')
    .replace(/\\par\b|\\line\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\u(-?\d+)\s*\??/g, (_m, code) => {
      const n = Number(code);
      return String.fromCharCode(n < 0 ? n + 65536 : n);
    })
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

async function readTextWithKoreanFallback(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount > 2) {
    try {
      return new TextDecoder('euc-kr').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function extractLegacyOfficeViaServer(
  file: File
): Promise<{ attachment?: AttachmentPayload; error?: string }> {
  try {
    const buf = await file.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(buf);
    const response = await fetch('/api/files/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        dataBase64,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };
    if (!response.ok || !data.text?.trim()) {
      return {
        error:
          data.error ||
          `"${file.name}" 파일의 텍스트를 읽지 못했습니다. .hwpx, .pptx, .docx 또는 PDF로 저장해 올려 주세요.`,
      };
    }
    return {
      attachment: {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        textContent: data.text.trim(),
        sizeBytes: file.size,
      },
    };
  } catch {
    return {
      error: `"${file.name}" 파일 분석 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.`,
    };
  }
}

export async function extractAttachmentsFromFile(file: File): Promise<{
  attachments: AttachmentPayload[];
  error?: string;
}> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      attachments: [],
      error: `"${file.name}" 파일이 20MB를 초과해 첨부할 수 없습니다.`,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage =
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);

  if (isImage) {
    try {
      const optimized = await fileToOptimizedImageAttachment(file);
      return { attachments: [optimized] };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" 이미지를 불러오지 못했습니다.`,
      };
    }
  }

  const isPdf = file.type === 'application/pdf' || ext === 'pdf';
  if (isPdf) {
    try {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      return {
        attachments: [
          {
            name: file.name,
            mimeType: 'application/pdf',
            dataBase64: base64,
            sizeBytes: file.size,
          },
        ],
      };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" PDF 파일을 읽는 중 오류가 발생했습니다.`,
      };
    }
  }

  if (ext === 'pptx') {
    try {
      const atts = await extractPptxAttachments(file);
      if (atts.length === 0) {
        return {
          attachments: [],
          error: `"${file.name}" PPT 파일에 읽을 수 있는 텍스트나 이미지가 없습니다.`,
        };
      }
      return { attachments: atts };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" PPTX 파일을 해석하지 못했습니다. 손상되었거나 암호가 걸린 파일인지 확인해 주세요.`,
      };
    }
  }

  if (ext === 'hwpx') {
    try {
      const atts = await extractHwpxAttachments(file);
      if (atts.length === 0) {
        return {
          attachments: [],
          error: `"${file.name}" 한글(.hwpx) 문서에서 본문 텍스트를 찾지 못했습니다.`,
        };
      }
      return { attachments: atts };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" 한글(.hwpx) 문서를 해석하지 못했습니다. 암호가 걸려 있거나 손상된 파일인지 확인해 주세요.`,
      };
    }
  }

  if (ext === 'docx') {
    try {
      const atts = await extractDocxAttachments(file);
      if (atts.length === 0) {
        return {
          attachments: [],
          error: `"${file.name}" 워드(.docx) 문서에서 본문 텍스트를 찾지 못했습니다.`,
        };
      }
      return { attachments: atts };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" 워드(.docx) 문서를 해석하지 못했습니다. 암호가 걸려 있거나 손상된 파일인지 확인해 주세요.`,
      };
    }
  }

  if (ext === 'xlsx') {
    try {
      const att = await extractXlsxAttachment(file);
      if (!att) {
        return {
          attachments: [],
          error: `"${file.name}" 엑셀(.xlsx) 파일에 비어 있지 않은 시트 데이터를 찾지 못했습니다.`,
        };
      }
      return { attachments: [att] };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" 엑셀(.xlsx) 파일을 해석하지 못했습니다.`,
      };
    }
  }

  if (ext === 'odt' || ext === 'odp' || ext === 'ods') {
    try {
      const att = await extractOdfAttachment(file);
      if (!att) {
        return {
          attachments: [],
          error: `"${file.name}" 문서에서 읽을 수 있는 내용을 찾지 못했습니다.`,
        };
      }
      return { attachments: [att] };
    } catch {
      return {
        attachments: [],
        error: `"${file.name}" 문서를 읽는 중 오류가 발생했습니다.`,
      };
    }
  }

  if (ext === 'hwp' || ext === 'ppt' || ext === 'doc' || ext === 'xls') {
    const res = await extractLegacyOfficeViaServer(file);
    if (res.attachment) {
      return { attachments: [res.attachment] };
    }
    return { attachments: [], error: res.error };
  }

  if (ext === 'rtf') {
    const raw = await readTextWithKoreanFallback(file);
    const cleaned = extractReadableRtfText(raw);
    if (!cleaned) {
      return {
        attachments: [],
        error: `"${file.name}" RTF 문서에서 텍스트를 추출하지 못했습니다.`,
      };
    }
    return {
      attachments: [
        {
          name: file.name,
          mimeType: 'application/rtf',
          textContent: cleaned,
          sizeBytes: file.size,
        },
      ],
    };
  }

  const isTextLike =
    file.type.startsWith('text/') ||
    [
      'txt',
      'md',
      'csv',
      'tsv',
      'json',
      'py',
      'js',
      'ts',
      'tsx',
      'jsx',
      'html',
      'htm',
      'xml',
      'yaml',
      'yml',
      'c',
      'cpp',
      'h',
      'java',
      'sql',
      'log',
      'tex',
      'ini',
      'env',
    ].includes(ext);

  if (isTextLike) {
    const text = await readTextWithKoreanFallback(file);
    if (!text.trim()) {
      return {
        attachments: [],
        error: `"${file.name}" 파일이 비어 있습니다.`,
      };
    }
    return {
      attachments: [
        {
          name: file.name,
          mimeType: file.type || 'text/plain',
          textContent: text,
          sizeBytes: file.size,
        },
      ],
    };
  }

  return {
    attachments: [],
    error: `"${file.name}" 형식(.${ext || 'unknown'})은 지원하지 않습니다. 한글(.hwpx/.hwp), PPT(.pptx/.ppt), 워드(.docx/.doc), 엑셀(.xlsx), PDF, 텍스트, 이미지 파일을 첨부해 주세요.`,
  };
}
