import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileOutput,
  FileText,
  Loader2,
  Presentation,
  Sparkles,
} from 'lucide-react';
import type {
  ExportFormat,
  GeneratedDocumentPayload,
  PptCoverStyle,
  PptThemeId,
  SlideLayoutType,
  StructuredDocumentData,
  StructuredPresentationData,
} from '../types/study';
import {
  exportElementToPdf,
  exportToDocx,
  exportToHwpx,
  exportToPptx,
} from '../utils/documentExporters';
import { MarkdownRenderer } from './MarkdownRenderer';

interface GeneratedArtifactCardProps {
  artifact: GeneratedDocumentPayload;
  preferredFormat?: ExportFormat;
  defaultExpanded?: boolean;
  isConverting?: boolean;
  onUpdateArtifact: (updated: GeneratedDocumentPayload) => void;
  onQuickRevise?: (instruction: string) => void;
  onConvertFormat?: (format: ExportFormat) => void;
}

interface PptThemePreviewStyle {
  label: string;
  swatchHex: string;
  coverClass: string;
  coverTextClass: string;
  coverMutedClass: string;
  coverAccentBgClass: string;
  slideClass: string;
  cardClass: string;
  mutedTextClass: string;
  accentTextClass: string;
  accentBgClass: string;
  accentBarClass: string;
  accent2BarClass: string;
  calloutClass: string;
  tableHeadClass: string;
  tableRowClass: string;
  tableAltRowClass: string;
  quoteBoxClass: string;
}

const PPT_THEME_PREVIEW_STYLES: Record<PptThemeId, PptThemePreviewStyle> = {
  ivory: {
    label: '웜 아이보리',
    swatchHex: '#2E4A6F',
    coverClass: 'bg-[#17191C]',
    coverTextClass: 'text-[#FAF7F0]',
    coverMutedClass: 'text-[#B8B3A7]',
    coverAccentBgClass: 'bg-[#2E4A6F] text-white',
    slideClass: 'bg-[#FAF7F0] text-[#17191C] border-[#DFD7C6]',
    cardClass: 'bg-[#FFFEFA] border-[#DFD7C6]',
    mutedTextClass: 'text-[#5A5E66]',
    accentTextClass: 'text-[#2E4A6F]',
    accentBgClass: 'bg-[#2E4A6F] text-white',
    accentBarClass: 'bg-[#2E4A6F]',
    accent2BarClass: 'bg-[#C08A3E]',
    calloutClass: 'bg-[#EFEAE0] border-[#DFD7C6] text-[#2E4A6F]',
    tableHeadClass: 'bg-[#2E4A6F] text-white',
    tableRowClass: 'bg-[#FFFEFA]',
    tableAltRowClass: 'bg-[#EFEAE0]/70',
    quoteBoxClass: 'bg-[#EFEAE0] border-[#DFD7C6]',
  },
  navy: {
    label: '아카데믹 네이비',
    swatchHex: '#1E3A8A',
    coverClass: 'bg-[#0F172A]',
    coverTextClass: 'text-[#F8FAFC]',
    coverMutedClass: 'text-[#CBD5E1]',
    coverAccentBgClass: 'bg-[#1E3A8A] text-white',
    slideClass: 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1]',
    cardClass: 'bg-white border-[#CBD5E1]',
    mutedTextClass: 'text-[#475569]',
    accentTextClass: 'text-[#1E3A8A]',
    accentBgClass: 'bg-[#1E3A8A] text-white',
    accentBarClass: 'bg-[#1E3A8A]',
    accent2BarClass: 'bg-[#0284C7]',
    calloutClass: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]',
    tableHeadClass: 'bg-[#1E3A8A] text-white',
    tableRowClass: 'bg-white',
    tableAltRowClass: 'bg-[#EFF6FF]',
    quoteBoxClass: 'bg-[#EFF6FF] border-[#BFDBFE]',
  },
  sage: {
    label: '세이지 노트',
    swatchHex: '#1E5B46',
    coverClass: 'bg-[#14332B]',
    coverTextClass: 'text-[#F4F7F4]',
    coverMutedClass: 'text-[#B7CBC3]',
    coverAccentBgClass: 'bg-[#1E5B46] text-white',
    slideClass: 'bg-[#F3F6F3] text-[#142822] border-[#CBD6CE]',
    cardClass: 'bg-white border-[#CBD6CE]',
    mutedTextClass: 'text-[#4B6059]',
    accentTextClass: 'text-[#1E5B46]',
    accentBgClass: 'bg-[#1E5B46] text-white',
    accentBarClass: 'bg-[#1E5B46]',
    accent2BarClass: 'bg-[#4D8B6F]',
    calloutClass: 'bg-[#E6EEE9] border-[#CBD6CE] text-[#1E5B46]',
    tableHeadClass: 'bg-[#1E5B46] text-white',
    tableRowClass: 'bg-white',
    tableAltRowClass: 'bg-[#E6EEE9]/75',
    quoteBoxClass: 'bg-[#E6EEE9] border-[#CBD6CE]',
  },
  terracotta: {
    label: '테라코타 인문',
    swatchHex: '#B44C2E',
    coverClass: 'bg-[#3B1D16]',
    coverTextClass: 'text-[#FDF7F4]',
    coverMutedClass: 'text-[#E6C9BE]',
    coverAccentBgClass: 'bg-[#B44C2E] text-white',
    slideClass: 'bg-[#FDF8F5] text-[#2B1814] border-[#E7D4CA]',
    cardClass: 'bg-white border-[#E7D4CA]',
    mutedTextClass: 'text-[#6E524B]',
    accentTextClass: 'text-[#B44C2E]',
    accentBgClass: 'bg-[#B44C2E] text-white',
    accentBarClass: 'bg-[#B44C2E]',
    accent2BarClass: 'bg-[#D97757]',
    calloutClass: 'bg-[#FAECE6] border-[#E7D4CA] text-[#9A3B20]',
    tableHeadClass: 'bg-[#B44C2E] text-white',
    tableRowClass: 'bg-white',
    tableAltRowClass: 'bg-[#FAECE6]/75',
    quoteBoxClass: 'bg-[#FAECE6] border-[#E7D4CA]',
  },
  cobalt: {
    label: '코발트 테크',
    swatchHex: '#1D4ED8',
    coverClass: 'bg-[#0B162C]',
    coverTextClass: 'text-[#F4F8FF]',
    coverMutedClass: 'text-[#B8CBE8]',
    coverAccentBgClass: 'bg-[#1D4ED8] text-white',
    slideClass: 'bg-[#F4F7FC] text-[#0E172A] border-[#CEDAF0]',
    cardClass: 'bg-white border-[#CEDAF0]',
    mutedTextClass: 'text-[#4B5C7A]',
    accentTextClass: 'text-[#1D4ED8]',
    accentBgClass: 'bg-[#1D4ED8] text-white',
    accentBarClass: 'bg-[#1D4ED8]',
    accent2BarClass: 'bg-[#0891B2]',
    calloutClass: 'bg-[#E8F0FE] border-[#C5D8FA] text-[#1E40AF]',
    tableHeadClass: 'bg-[#1D4ED8] text-white',
    tableRowClass: 'bg-white',
    tableAltRowClass: 'bg-[#E8F0FE]/80',
    quoteBoxClass: 'bg-[#E8F0FE] border-[#C5D8FA]',
  },
  editorial: {
    label: '다크 에디토리얼',
    swatchHex: '#D4A359',
    coverClass: 'bg-[#0D0F14]',
    coverTextClass: 'text-[#F6F2E9]',
    coverMutedClass: 'text-[#B5B0A6]',
    coverAccentBgClass: 'bg-[#D4A359] text-[#14171F]',
    slideClass: 'bg-[#14171F] text-[#F3EFE6] border-[#313746]',
    cardClass: 'bg-[#1D212B] border-[#313746]',
    mutedTextClass: 'text-[#A6A39B]',
    accentTextClass: 'text-[#D4A359]',
    accentBgClass: 'bg-[#D4A359] text-[#14171F]',
    accentBarClass: 'bg-[#D4A359]',
    accent2BarClass: 'bg-[#6EA8FE]',
    calloutClass: 'bg-[#252A36] border-[#394154] text-[#E6BF7E]',
    tableHeadClass: 'bg-[#D4A359] text-[#14171F]',
    tableRowClass: 'bg-[#1D212B] text-[#F3EFE6]',
    tableAltRowClass: 'bg-[#252A36] text-[#F3EFE6]',
    quoteBoxClass: 'bg-[#252A36] border-[#394154]',
  },
  lavender: {
    label: '라벤더 스튜디오',
    swatchHex: '#5B3CC4',
    coverClass: 'bg-[#231B38]',
    coverTextClass: 'text-[#FAF8FF]',
    coverMutedClass: 'text-[#D0C7E6]',
    coverAccentBgClass: 'bg-[#5B3CC4] text-white',
    slideClass: 'bg-[#F8F6FC] text-[#1E1830] border-[#DDD6EB]',
    cardClass: 'bg-white border-[#DDD6EB]',
    mutedTextClass: 'text-[#5E5673]',
    accentTextClass: 'text-[#5B3CC4]',
    accentBgClass: 'bg-[#5B3CC4] text-white',
    accentBarClass: 'bg-[#5B3CC4]',
    accent2BarClass: 'bg-[#8B5CF6]',
    calloutClass: 'bg-[#EFEAFC] border-[#DDD6EB] text-[#4C2FA8]',
    tableHeadClass: 'bg-[#5B3CC4] text-white',
    tableRowClass: 'bg-white',
    tableAltRowClass: 'bg-[#EFEAFC]/75',
    quoteBoxClass: 'bg-[#EFEAFC] border-[#DDD6EB]',
  },
};

const PPT_COVER_STYLE_OPTIONS: Array<{ id: PptCoverStyle; label: string }> = [
  { id: 'split', label: '분할형' },
  { id: 'modern', label: '모던 도형' },
  { id: 'framed', label: '프레임' },
  { id: 'minimal', label: '미니멀' },
];

const SLIDE_LAYOUT_LABELS: Record<SlideLayoutType, string> = {
  title: '표지',
  agenda: '목차',
  bullets: '핵심 정리',
  'two-column': '2단 비교',
  cards: '카드 그리드',
  timeline: '흐름 · 단계',
  stats: '핵심 지표',
  table: '비교표',
  quote: '핵심 인용',
  summary: '결론 · 요약',
};

export const GeneratedArtifactCard: React.FC<GeneratedArtifactCardProps> = ({
  artifact,
  preferredFormat,
  defaultExpanded = true,
  isConverting = false,
  onUpdateArtifact,
  onQuickRevise,
  onConvertFormat,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const initialTheme: PptThemeId =
    artifact.kind === 'presentation' && artifact.themeId && PPT_THEME_PREVIEW_STYLES[artifact.themeId]
      ? artifact.themeId
      : 'ivory';
  const initialCover: PptCoverStyle =
    artifact.kind === 'presentation' && artifact.coverStyle ? artifact.coverStyle : 'split';

  const [pptTheme, setPptTheme] = useState<PptThemeId>(initialTheme);
  const [coverStyle, setCoverStyle] = useState<PptCoverStyle>(initialCover);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const pdfSheetRef = useRef<HTMLDivElement | null>(null);

  const isPresentation = artifact.kind === 'presentation';
  const deckPayload: StructuredPresentationData | null = isPresentation ? artifact : null;
  const docPayload: StructuredDocumentData | null = !isPresentation ? artifact : null;

  useEffect(() => {
    if (deckPayload?.themeId && PPT_THEME_PREVIEW_STYLES[deckPayload.themeId]) {
      setPptTheme(deckPayload.themeId);
    }
    if (deckPayload?.coverStyle) {
      setCoverStyle(deckPayload.coverStyle);
    }
  }, [deckPayload?.themeId, deckPayload?.coverStyle]);

  const safeSlideIdx =
    deckPayload && deckPayload.slides.length > 0
      ? Math.min(activeSlideIdx, deckPayload.slides.length - 1)
      : 0;
  const currentSlide = deckPayload?.slides[safeSlideIdx];
  const pptThemeStyle = PPT_THEME_PREVIEW_STYLES[pptTheme] ?? PPT_THEME_PREVIEW_STYLES.ivory;

  const primaryDocFormat: 'hwpx' | 'pdf' | 'docx' =
    preferredFormat === 'hwpx' || preferredFormat === 'pdf' || preferredFormat === 'docx'
      ? preferredFormat
      : 'hwpx';

  const handleSelectTheme = (tid: PptThemeId) => {
    setPptTheme(tid);
    if (deckPayload) {
      onUpdateArtifact({ ...deckPayload, themeId: tid });
    }
  };

  const handleSelectCoverStyle = (cs: PptCoverStyle) => {
    setCoverStyle(cs);
    if (deckPayload) {
      onUpdateArtifact({ ...deckPayload, coverStyle: cs });
    }
  };

  const handleDownload = async (fmt: ExportFormat) => {
    setExportingFormat(fmt);
    setExportError(null);
    setDownloadedNotice(null);

    try {
      if (fmt === 'pptx' && deckPayload) {
        await exportToPptx(deckPayload, pptTheme, coverStyle);
        setDownloadedNotice('PPT 발표자료(.pptx) 파일이 다운로드되었습니다.');
      } else if (fmt === 'hwpx' && docPayload) {
        await exportToHwpx(docPayload);
        setDownloadedNotice('한컴 한글(.hwpx) 문서가 다운로드되었습니다.');
      } else if (fmt === 'docx' && docPayload) {
        await exportToDocx(docPayload);
        setDownloadedNotice('MS Word(.docx) 문서가 다운로드되었습니다.');
      } else if (fmt === 'pdf' && docPayload) {
        if (!expanded) {
          setExpanded(true);
          await new Promise((r) => setTimeout(r, 80));
        }
        if (!pdfSheetRef.current) {
          throw new Error('PDF 미리보기 영역을 준비하는 중입니다. 다시 한 번 눌러 주세요.');
        }
        await exportElementToPdf(pdfSheetRef.current, docPayload.title);
        setDownloadedNotice('PDF(.pdf) 문서가 다운로드되었습니다.');
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : '파일 생성 및 다운로드 중 오류가 발생했습니다.'
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleUpdateSlideField = (
    idx: number,
    patch: Partial<{ title: string; speakerNotes: string }>
  ) => {
    if (!deckPayload) return;
    const nextSlides = deckPayload.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdateArtifact({ ...deckPayload, slides: nextSlides });
  };

  const reviseChips = isPresentation
    ? [
        '모든 슬라이드에 예시와 상세 설명을 추가해 내용을 훨씬 풍부하게 해 줘',
        '카드·타임라인·지표·비교표 레이아웃을 다채롭게 섞어 디자인을 업그레이드해 줘',
        '슬라이드 수를 10장 이상 심화 발표용으로 늘려 줘',
        '발표 대본을 실제 말하듯 더 자연스럽고 풍성하게 다듬어 줘',
      ]
    : [
        '핵심 내용을 비교표와 구체적 예시까지 추가해서 더 풍부하게 써 줘',
        '학교 수행평가 제출용 보고서(탐구 동기·분석·성찰) 형식으로 다듬어 줘',
        '시험 직전에 한눈에 암기할 수 있게 더 간결하고 핵심 위주로 요약해 줘',
      ];

  const renderSlideBody = () => {
    if (!currentSlide) return null;

    if (
      currentSlide.layout === 'table' &&
      currentSlide.tableHeaders?.length &&
      currentSlide.tableRows?.length
    ) {
      return (
        <div className="overflow-x-auto rounded-xl border border-current/15">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {currentSlide.tableHeaders.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2 text-left font-semibold ${pptThemeStyle.tableHeadClass}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSlide.tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-t border-current/10 ${
                    rIdx % 2 === 0 ? pptThemeStyle.tableRowClass : pptThemeStyle.tableAltRowClass
                  }`}
                >
                  {currentSlide.tableHeaders!.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 leading-relaxed">
                      {row[cIdx] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (currentSlide.layout === 'cards' && currentSlide.cards?.length) {
      const cards = currentSlide.cards.slice(0, 6);
      const gridClass =
        cards.length === 2 || cards.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
      return (
        <div className={`grid grid-cols-1 ${gridClass} gap-2.5 h-full`}>
          {cards.map((card, cIdx) => (
            <div
              key={cIdx}
              className={`rounded-xl border overflow-hidden flex flex-col ${pptThemeStyle.cardClass}`}
            >
              <div
                className={`h-1 w-full shrink-0 ${
                  cIdx % 2 === 0 ? pptThemeStyle.accentBarClass : pptThemeStyle.accent2BarClass
                }`}
              />
              <div className="p-3 flex-1 flex flex-col justify-start space-y-1">
                {card.tag && (
                  <div className={`text-[10px] font-bold ${pptThemeStyle.accentTextClass}`}>
                    {card.tag}
                  </div>
                )}
                <div className="text-xs sm:text-[13px] font-bold leading-snug">{card.title}</div>
                <p className={`text-[11px] sm:text-xs leading-relaxed ${pptThemeStyle.mutedTextClass}`}>
                  {card.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (currentSlide.layout === 'timeline' && currentSlide.steps?.length) {
      const steps = currentSlide.steps.slice(0, 5);
      return (
        <div
          className={`grid grid-cols-1 gap-2.5 h-full ${
            steps.length >= 5
              ? 'sm:grid-cols-5'
              : steps.length === 4
                ? 'sm:grid-cols-4'
                : 'sm:grid-cols-3'
          }`}
        >
          {steps.map((st, sIdx) => (
            <div
              key={sIdx}
              className={`rounded-xl border p-3 flex flex-col space-y-2 ${pptThemeStyle.cardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono-code tabular-nums ${pptThemeStyle.accentBgClass}`}
                >
                  {st.step || `0${sIdx + 1}`}
                </span>
                {sIdx < steps.length - 1 && (
                  <span className={`hidden sm:inline text-xs font-bold ${pptThemeStyle.accentTextClass}`}>
                    →
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-[13px] font-bold leading-snug">{st.title}</div>
              <p className={`text-[11px] leading-relaxed ${pptThemeStyle.mutedTextClass}`}>
                {st.detail}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (currentSlide.layout === 'stats' && currentSlide.stats?.length) {
      const stats = currentSlide.stats.slice(0, 4);
      const colsClass =
        stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
      return (
        <div className="space-y-2.5 h-full flex flex-col justify-between">
          <div className={`grid grid-cols-1 ${colsClass} gap-2.5`}>
            {stats.map((st, idxStat) => (
              <div
                key={idxStat}
                className={`rounded-xl border overflow-hidden ${pptThemeStyle.cardClass}`}
              >
                <div className={`h-1 w-full ${pptThemeStyle.accentBarClass}`} />
                <div className="p-3 space-y-1">
                  <div
                    className={`font-display text-lg sm:text-xl font-bold leading-tight tabular-nums ${pptThemeStyle.accentTextClass}`}
                  >
                    {st.value}
                  </div>
                  <div className="text-xs font-bold leading-snug">{st.label}</div>
                  {st.note && (
                    <div className={`text-[11px] leading-relaxed ${pptThemeStyle.mutedTextClass}`}>
                      {st.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {currentSlide.bullets?.length > 0 && (
            <div className={`rounded-xl border p-3 ${pptThemeStyle.cardClass}`}>
              <ul className="space-y-1 text-xs list-disc pl-4 leading-relaxed">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (currentSlide.layout === 'quote' && currentSlide.quoteText) {
      return (
        <div className="space-y-2.5 h-full flex flex-col justify-between">
          <div
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between ${pptThemeStyle.quoteBoxClass}`}
          >
            <div className={`text-2xl font-serif leading-none ${pptThemeStyle.accentTextClass}`}>
              “
            </div>
            <blockquote className="font-display text-sm sm:text-base font-bold leading-relaxed my-1.5">
              {currentSlide.quoteText}
            </blockquote>
            {currentSlide.quoteAuthor && (
              <div className={`text-xs font-semibold text-right ${pptThemeStyle.accentTextClass}`}>
                — {currentSlide.quoteAuthor}
              </div>
            )}
          </div>
          {currentSlide.bullets?.length > 0 && (
            <div className={`rounded-xl border p-3 ${pptThemeStyle.cardClass}`}>
              <ul className="space-y-1 text-xs list-disc pl-4 leading-relaxed">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (currentSlide.layout === 'two-column' && currentSlide.rightBullets?.length) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-full">
          <div className={`rounded-xl border overflow-hidden flex flex-col ${pptThemeStyle.cardClass}`}>
            <div className={`h-1 w-full shrink-0 ${pptThemeStyle.accentBarClass}`} />
            <div className="p-3.5 flex-1">
              {currentSlide.leftTitle && (
                <div className={`text-xs font-bold mb-1.5 ${pptThemeStyle.accentTextClass}`}>
                  {currentSlide.leftTitle}
                </div>
              )}
              <ul className="space-y-1.5 text-xs sm:text-[13px] list-disc pl-4 leading-relaxed">
                {currentSlide.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={`rounded-xl border overflow-hidden flex flex-col ${pptThemeStyle.cardClass}`}>
            <div className={`h-1 w-full shrink-0 ${pptThemeStyle.accent2BarClass}`} />
            <div className="p-3.5 flex-1">
              {currentSlide.rightTitle && (
                <div className={`text-xs font-bold mb-1.5 ${pptThemeStyle.accentTextClass}`}>
                  {currentSlide.rightTitle}
                </div>
              )}
              <ul className="space-y-1.5 text-xs sm:text-[13px] list-disc pl-4 leading-relaxed">
                {currentSlide.rightBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    if (currentSlide.layout === 'agenda') {
      return (
        <div className="space-y-2 h-full flex flex-col justify-center">
          {currentSlide.bullets.map((b, i) => (
            <div
              key={i}
              className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-3 ${pptThemeStyle.cardClass}`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-6 rounded-md text-[11px] font-bold font-mono-code tabular-nums shrink-0 ${pptThemeStyle.accentBgClass}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-xs sm:text-[13px] font-semibold leading-snug">{b}</span>
            </div>
          ))}
        </div>
      );
    }

    // Standard bullets / summary — 2-column split when dense/6+ items
    const items = currentSlide.bullets || [];
    const totalChars = items.reduce((sum, s) => sum + s.length, 0);
    if (items.length >= 6 || (items.length >= 4 && totalChars > 340)) {
      const mid = Math.ceil(items.length / 2);
      const leftItems = items.slice(0, mid);
      const rightItems = items.slice(mid);
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-full">
          {[leftItems, rightItems].map((colList, colIdx) => (
            <div key={colIdx} className={`rounded-xl border p-3.5 ${pptThemeStyle.cardClass}`}>
              <ul className="space-y-1.5 text-xs list-disc pl-4 leading-relaxed">
                {colList.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={`rounded-xl border p-4 h-full ${pptThemeStyle.cardClass}`}>
        <ul className="space-y-2 text-xs sm:text-[13.5px] list-disc pl-4 leading-relaxed">
          {items.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderCoverStage = () => {
    if (!deckPayload || !currentSlide) return null;
    const coverTitle = safeSlideIdx === 0 ? deckPayload.title : currentSlide.title;
    const coverSub =
      safeSlideIdx === 0
        ? deckPayload.subtitle
        : currentSlide.subtitle || currentSlide.bullets[0] || '';
    const pageLabel = `${String(safeSlideIdx + 1).padStart(2, '0')} / ${String(
      deckPayload.slides.length
    ).padStart(2, '0')}`;

    if (coverStyle === 'split') {
      return (
        <div
          className={`aspect-[16/9] w-full rounded-2xl border overflow-hidden grid grid-cols-12 shadow-md ${pptThemeStyle.slideClass}`}
        >
          <div
            className={`col-span-4 p-5 sm:p-6 flex flex-col justify-between relative ${pptThemeStyle.coverClass} ${pptThemeStyle.coverTextClass}`}
          >
            <div>
              <span
                className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${pptThemeStyle.coverAccentBgClass}`}
              >
                {deckPayload.subjectLabel}
              </span>
            </div>
            <div className="space-y-1">
              <div className={`text-[10px] font-semibold tracking-wider ${pptThemeStyle.coverMutedClass}`}>
                PRESENTATION
              </div>
              <div className="text-[11px] leading-relaxed opacity-90">{deckPayload.authorLine}</div>
            </div>
          </div>
          <div className="col-span-8 p-6 sm:p-9 flex flex-col justify-between relative">
            <div />
            <div className="space-y-2.5">
              <h3 className="font-display text-lg sm:text-2xl lg:text-3xl font-bold leading-snug [text-wrap:balance]">
                {coverTitle}
              </h3>
              {coverSub && (
                <p className={`text-xs sm:text-sm leading-relaxed ${pptThemeStyle.mutedTextClass}`}>
                  {coverSub}
                </p>
              )}
            </div>
            <div className={`text-right text-[11px] font-mono-code tabular-nums ${pptThemeStyle.mutedTextClass}`}>
              {pageLabel}
            </div>
          </div>
        </div>
      );
    }

    if (coverStyle === 'modern') {
      return (
        <div
          className={`aspect-[16/9] w-full rounded-2xl p-6 sm:p-9 flex flex-col justify-between relative overflow-hidden shadow-md ${pptThemeStyle.coverClass} ${pptThemeStyle.coverTextClass}`}
        >
          <div
            className={`hidden sm:block absolute top-0 right-0 w-1/4 h-full opacity-25 ${pptThemeStyle.accentBarClass}`}
          />
          <div
            className={`hidden sm:block absolute top-8 right-10 w-32 h-32 rounded-2xl opacity-35 ${pptThemeStyle.accent2BarClass}`}
          />
          <div className="relative z-10">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${pptThemeStyle.coverAccentBgClass}`}
            >
              {deckPayload.subjectLabel}
            </span>
          </div>
          <div className="relative z-10 space-y-2.5 max-w-[78%]">
            <h3 className="font-display text-xl sm:text-3xl font-bold leading-snug [text-wrap:balance]">
              {coverTitle}
            </h3>
            {coverSub && (
              <p className={`text-xs sm:text-base leading-relaxed ${pptThemeStyle.coverMutedClass}`}>
                {coverSub}
              </p>
            )}
          </div>
          <div
            className={`relative z-10 flex items-center justify-between text-[11px] sm:text-xs ${pptThemeStyle.coverMutedClass}`}
          >
            <span className="truncate">{deckPayload.authorLine}</span>
            <span className="font-mono-code tabular-nums shrink-0">{pageLabel}</span>
          </div>
        </div>
      );
    }

    if (coverStyle === 'framed') {
      return (
        <div className={`aspect-[16/9] w-full rounded-2xl p-4 sm:p-5 shadow-md ${pptThemeStyle.coverClass}`}>
          <div
            className={`w-full h-full rounded-xl border-2 overflow-hidden flex flex-col justify-between ${pptThemeStyle.slideClass}`}
          >
            <div className={`h-1.5 w-full shrink-0 ${pptThemeStyle.accentBarClass}`} />
            <div className="px-5 sm:px-8 py-4 sm:py-6 flex-1 flex flex-col justify-between">
              <div className={`text-xs font-bold ${pptThemeStyle.accentTextClass}`}>
                {deckPayload.subjectLabel}
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-xl sm:text-3xl font-bold leading-snug [text-wrap:balance]">
                  {coverTitle}
                </h3>
                {coverSub && (
                  <p className={`text-xs sm:text-base leading-relaxed ${pptThemeStyle.mutedTextClass}`}>
                    {coverSub}
                  </p>
                )}
              </div>
              <div
                className={`pt-2.5 border-t border-current/15 flex items-center justify-between text-[11px] sm:text-xs ${pptThemeStyle.mutedTextClass}`}
              >
                <span className="truncate">{deckPayload.authorLine}</span>
                <span className="font-mono-code tabular-nums shrink-0">{pageLabel}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // minimal
    return (
      <div
        className={`aspect-[16/9] w-full rounded-2xl p-6 sm:p-9 flex flex-col justify-between shadow-md ${pptThemeStyle.coverClass} ${pptThemeStyle.coverTextClass}`}
      >
        <div className={`text-xs font-semibold ${pptThemeStyle.coverMutedClass}`}>
          {deckPayload.subjectLabel}
        </div>
        <div className="space-y-2.5">
          <h3 className="font-display text-xl sm:text-3xl font-bold leading-snug [text-wrap:balance]">
            {coverTitle}
          </h3>
          {coverSub && (
            <p className={`text-xs sm:text-base leading-relaxed ${pptThemeStyle.coverMutedClass}`}>
              {coverSub}
            </p>
          )}
        </div>
        <div
          className={`pt-3 border-t border-white/20 flex items-center justify-between text-[11px] sm:text-xs ${pptThemeStyle.coverMutedClass}`}
        >
          <span className="truncate">{deckPayload.authorLine}</span>
          <span className="font-mono-code tabular-nums shrink-0">{pageLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-[#DFD7C6] dark:border-[#2E3340] bg-[#FAF7F0] dark:bg-[#14161A] overflow-hidden shadow-[0_2px_10px_-4px_rgba(23,25,28,0.06)]">
      {/* Artifact Header Bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#E6DFD1] dark:border-[#272A33] bg-[#F5F0E6] dark:bg-[#191B22] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-[#FFFEFA] dark:bg-[#232630] border border-[#DFD7C6] dark:border-[#323746] flex items-center justify-center shrink-0">
            {isPresentation ? (
              <Presentation className="w-4 h-4 text-[#17191C] dark:text-[#EFECE4]" />
            ) : (
              <FileOutput className="w-4 h-4 text-[#17191C] dark:text-[#EFECE4]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
              <span>
                {isPresentation
                  ? `AI 완성 PPT 발표자료 · ${deckPayload?.slides.length || 0}슬라이드`
                  : `AI 완성 문서 · ${docPayload?.sections.length || 0}개 섹션`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{artifact.subjectLabel}</span>
            </div>
            <input
              type="text"
              value={artifact.title}
              onChange={(e) => onUpdateArtifact({ ...artifact, title: e.target.value })}
              aria-label="생성된 파일 제목"
              className="w-full mt-0.5 bg-transparent font-display text-sm sm:text-[15px] font-bold text-[#17191C] dark:text-[#EFECE4] focus:outline-none border-b border-transparent focus:border-[#17191C]/40 dark:focus:border-[#EFECE4]/40 truncate"
            />
          </div>
        </div>

        {/* Direct 1-Click Download Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {isPresentation ? (
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => handleDownload('pptx')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
            >
              {exportingFormat === 'pptx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>PPT 다운로드 (.pptx)</span>
            </button>
          ) : (
            <>
              {(
                [
                  { id: 'hwpx', label: '한글 (.hwpx)' },
                  { id: 'pdf', label: 'PDF (.pdf)' },
                  { id: 'docx', label: '워드 (.docx)' },
                ] as Array<{ id: 'hwpx' | 'pdf' | 'docx'; label: string }>
              ).map((fmt) => {
                const isPrimary = fmt.id === primaryDocFormat;
                const isBusy = exportingFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    disabled={exportingFormat !== null}
                    onClick={() => handleDownload(fmt.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-50 ${
                      isPrimary
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] hover:opacity-90'
                        : 'border border-[#DFD7C6] dark:border-[#323746] bg-[#FFFEFA] dark:bg-[#22252E] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#EFEAE0] dark:hover:bg-[#2B2F3B]'
                    }`}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{fmt.label}</span>
                  </button>
                );
              })}
            </>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-[#DFD7C6] dark:border-[#323746] bg-[#FFFEFA] dark:bg-[#22252E] text-[#4C5059] dark:text-[#C5C1B7] hover:text-[#17191C] dark:hover:text-[#EFECE4] transition-colors whitespace-nowrap"
            aria-label={expanded ? '미리보기 접기' : '미리보기 펼치기'}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">접기</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">미리보기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Download / Export Notice */}
      {(downloadedNotice || exportError) && (
        <div
          className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${
            exportError
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-200'
              : 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {!exportError && <Check className="w-3.5 h-3.5 shrink-0" />}
          <span>{exportError || downloadedNotice}</span>
        </div>
      )}

      {/* Expandable Live Preview */}
      {expanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {deckPayload && currentSlide ? (
            <div className="space-y-3.5">
              {/* Theme, Cover Design & Slide Pagination Controls */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {(Object.keys(PPT_THEME_PREVIEW_STYLES) as PptThemeId[]).map((tid) => {
                      const active = pptTheme === tid;
                      const styleItem = PPT_THEME_PREVIEW_STYLES[tid];
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => handleSelectTheme(tid)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                              : 'bg-[#FFFEFA] dark:bg-[#1B1D24] border-[#DFD7C6] dark:border-[#2E323D] text-[#5A5E66] dark:text-[#9D998E] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: styleItem.swatchHex }}
                          />
                          <span>{styleItem.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={safeSlideIdx === 0}
                      onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                      className="p-1.5 rounded-lg border border-[#DFD7C6] dark:border-[#2E323D] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] disabled:opacity-35"
                      aria-label="이전 슬라이드"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-xs font-mono-code tabular-nums text-[#5A5E66] dark:text-[#9D998E]">
                      {String(safeSlideIdx + 1).padStart(2, '0')} /{' '}
                      {String(deckPayload.slides.length).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      disabled={safeSlideIdx >= deckPayload.slides.length - 1}
                      onClick={() =>
                        setActiveSlideIdx((i) => Math.min(deckPayload.slides.length - 1, i + 1))
                      }
                      className="p-1.5 rounded-lg border border-[#DFD7C6] dark:border-[#2E323D] bg-[#FFFEFA] dark:bg-[#1A1C22] text-[#17191C] dark:text-[#EFECE4] disabled:opacity-35"
                      aria-label="다음 슬라이드"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cover design switcher & current slide layout metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-semibold text-[#686C75] dark:text-[#8E8A80] mr-1">
                      표지 디자인:
                    </span>
                    {PPT_COVER_STYLE_OPTIONS.map((opt) => {
                      const active = coverStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectCoverStyle(opt.id)}
                          className={`px-2 py-0.5 rounded-md font-medium border transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#EFEAE0] dark:bg-[#272B36] border-[#B9AF9C] dark:border-[#495063] text-[#17191C] dark:text-[#EFECE4]'
                              : 'border-transparent text-[#686C75] dark:text-[#8E8A80] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[#686C75] dark:text-[#8E8A80] whitespace-nowrap">
                    <span>레이아웃: {SLIDE_LAYOUT_LABELS[currentSlide.layout] || currentSlide.layout}</span>
                    {deckPayload.density && (
                      <>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>
                          {deckPayload.density === 'rich'
                            ? '풍부 심화형'
                            : deckPayload.density === 'concise'
                              ? '간결 핵심형'
                              : '표준 균형형'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 16:9 Slide Stage */}
              {safeSlideIdx === 0 || currentSlide.layout === 'title' ? (
                renderCoverStage()
              ) : (
                <div
                  className={`aspect-[16/9] w-full rounded-2xl border overflow-hidden flex flex-col justify-between shadow-sm ${pptThemeStyle.slideClass}`}
                >
                  <div className={`h-1.5 w-full shrink-0 ${pptThemeStyle.accentBarClass}`} />
                  <div className="flex-1 min-h-0 p-5 sm:p-7 flex flex-col justify-between">
                    <div className="pb-2.5 border-b border-current/15">
                      <div className={`text-[11px] font-bold ${pptThemeStyle.accentTextClass}`}>
                        {currentSlide.kicker || deckPayload.subjectLabel}
                      </div>
                      <input
                        type="text"
                        value={currentSlide.title}
                        onChange={(e) =>
                          handleUpdateSlideField(safeSlideIdx, { title: e.target.value })
                        }
                        aria-label={`슬라이드 ${safeSlideIdx + 1} 제목`}
                        className="w-full mt-0.5 bg-transparent font-display text-base sm:text-xl font-bold focus:outline-none"
                      />
                      {currentSlide.subtitle && (
                        <div className={`text-xs mt-0.5 ${pptThemeStyle.mutedTextClass}`}>
                          {currentSlide.subtitle}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 py-2.5 overflow-y-auto">
                      {renderSlideBody()}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {currentSlide.callout && (
                        <div
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${pptThemeStyle.calloutClass}`}
                        >
                          핵심 포인트 · {currentSlide.callout}
                        </div>
                      )}
                      <div className={`flex items-center justify-between text-[11px] ${pptThemeStyle.mutedTextClass}`}>
                        <span className="truncate">{deckPayload.title}</span>
                        <span className="font-mono-code tabular-nums shrink-0">
                          {String(safeSlideIdx + 1).padStart(2, '0')} /{' '}
                          {String(deckPayload.slides.length).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide Thumbnail Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {deckPayload.slides.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      idx === safeSlideIdx
                        ? 'bg-[#17191C] dark:bg-[#EFECE4] text-[#FAF7F0] dark:text-[#111215] border-transparent'
                        : 'bg-[#FFFEFA] dark:bg-[#1A1C22] border-[#DFD7C6] dark:border-[#2E323D] text-[#5A5E66] dark:text-[#9D998E] hover:text-[#17191C] dark:hover:text-[#EFECE4]'
                    }`}
                  >
                    <span className="tabular-nums">{idx + 1}.</span>{' '}
                    <span className="opacity-70">{SLIDE_LAYOUT_LABELS[s.layout] || ''} · </span>
                    {s.title.slice(0, 13)}
                    {s.title.length > 13 ? '...' : ''}
                  </button>
                ))}
              </div>

              {/* Editable Speaker Notes */}
              <div className="rounded-xl p-3.5 bg-[#FFFEFA] dark:bg-[#1A1C22] border border-[#E6DFD1] dark:border-[#272A33] space-y-1">
                <div className="text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E]">
                  슬라이드 {safeSlideIdx + 1} 발표 대본 (PowerPoint 발표자 노트에 자동 포함)
                </div>
                <textarea
                  rows={2}
                  value={currentSlide.speakerNotes || ''}
                  onChange={(e) =>
                    handleUpdateSlideField(safeSlideIdx, { speakerNotes: e.target.value })
                  }
                  className="w-full bg-transparent text-xs text-[#17191C] dark:text-[#EFECE4] leading-relaxed focus:outline-none resize-none"
                />
              </div>
            </div>
          ) : docPayload ? (
            /* A4 Document Preview Sheet */
            <div
              ref={pdfSheetRef}
              className="pdf-export-sheet rounded-xl border border-[#DFD7C6] px-6 sm:px-9 py-7 sm:py-8 shadow-xs space-y-5"
            >
              <div className="pb-4 border-b border-[#E6DFD1] space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5E66]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{docPayload.subjectLabel}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17191C] leading-snug">
                  {docPayload.title}
                </h2>
                {docPayload.subtitle && (
                  <p className="text-sm text-[#4C5059] leading-relaxed">{docPayload.subtitle}</p>
                )}
                <div className="text-[11px] text-[#787B84] pt-0.5 font-mono-code">
                  {docPayload.authorLine}
                </div>
              </div>

              {docPayload.overview && (
                <div className="rounded-xl bg-[#F5F1E8] border border-[#E2DACB] px-4 py-3.5 text-[13.5px] leading-relaxed text-[#2C2F36]">
                  <div className="font-bold text-[#17191C] mb-1">핵심 요약</div>
                  <MarkdownRenderer content={docPayload.overview} />
                </div>
              )}

              <div className="space-y-5">
                {docPayload.sections.map((sec, sIdx) => (
                  <section key={sIdx} className="space-y-2">
                    <h3 className="text-base font-bold text-[#17191C]">{sec.heading}</h3>
                    {sec.summary && (
                      <p className="text-xs italic text-[#5A5E66]">{sec.summary}</p>
                    )}

                    {sec.paragraphs?.map((para, pIdx) => (
                      <div key={pIdx} className="text-[13.5px] leading-relaxed text-[#1E2024]">
                        <MarkdownRenderer content={para} />
                      </div>
                    ))}

                    {sec.bullets && sec.bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-1 text-[13.5px] text-[#1E2024] leading-relaxed">
                        {sec.bullets.map((b, bIdx) => (
                          <li key={bIdx}>
                            <MarkdownRenderer content={b} />
                          </li>
                        ))}
                      </ul>
                    )}

                    {sec.tableHeaders &&
                      sec.tableHeaders.length > 0 &&
                      sec.tableRows &&
                      sec.tableRows.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-[#DFD7C6] my-2">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-[#EFEAE0]">
                                {sec.tableHeaders.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className="px-3 py-2 text-left font-semibold text-[#17191C] border-b border-[#DFD7C6]"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sec.tableRows.map((row, rIdx) => (
                                <tr key={rIdx} className="border-t border-[#EAE3D5]">
                                  {sec.tableHeaders!.map((_, cIdx) => (
                                    <td key={cIdx} className="px-3 py-2 text-[#2C2F36]">
                                      {row[cIdx] ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    {sec.callout && (
                      <div className="rounded-lg bg-[#F8F5EE] border border-[#E2DACB] px-3.5 py-2.5 text-xs text-[#2C2F36]">
                        <span className="font-bold text-[#17191C]">핵심 포인트 · </span>
                        <MarkdownRenderer content={sec.callout} />
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {docPayload.conclusion && (
                <div className="pt-4 border-t border-[#E6DFD1] space-y-1.5">
                  <h3 className="text-base font-bold text-[#17191C]">정리 및 결론</h3>
                  <div className="text-[13.5px] leading-relaxed text-[#1E2024]">
                    <MarkdownRenderer content={docPayload.conclusion} />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#EFEAE0] text-right text-[11px] text-[#8A8D95] font-mono-code">
                STUDY:ON AI 학습 문서
              </div>
            </div>
          ) : null}

          {/* Cross-Format AI Conversion Actions */}
          {onConvertFormat && (
            <div className="pt-2 border-t border-[#E6DFD1] dark:border-[#272A33] flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5A5E66] dark:text-[#9D998E] mr-1">
                {isPresentation ? (
                  <FileOutput className="w-3 h-3" />
                ) : (
                  <Presentation className="w-3 h-3" />
                )}
                <span>다른 형식으로 AI 전환:</span>
              </span>
              {(isPresentation
                ? ([
                    { id: 'hwpx', label: '한글(.hwpx)로 전환' },
                    { id: 'pdf', label: 'PDF로 전환' },
                    { id: 'docx', label: '워드(.docx)로 전환' },
                  ] as Array<{ id: ExportFormat; label: string }>)
                : ([
                    { id: 'pptx', label: 'PPT(.pptx)로 전환' },
                  ] as Array<{ id: ExportFormat; label: string }>)
              ).map((target) => (
                <button
                  key={target.id}
                  type="button"
                  disabled={isConverting}
                  onClick={() => onConvertFormat(target.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[#D8CEBB] dark:border-[#343946] bg-[#EFEAE0]/70 dark:bg-[#20232C] text-[#17191C] dark:text-[#EFECE4] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] disabled:opacity-45 transition-colors"
                >
                  {target.id === 'pptx' ? (
                    <Presentation className="w-3 h-3" />
                  ) : (
                    <FileOutput className="w-3 h-3" />
                  )}
                  <span>{target.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Conversational Follow-up AI Revision Chips */}
          {onQuickRevise && (
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#686C75] dark:text-[#8E8A80] mr-1">
                <Sparkles className="w-3 h-3" />
                <span>AI 수정 요청:</span>
              </span>
              {reviseChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onQuickRevise(chip)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[#DFD7C6] dark:border-[#2E323D] bg-[#FFFEFA] dark:bg-[#1B1D24] text-[#4C5059] dark:text-[#C5C1B7] hover:bg-[#17191C] hover:text-[#FAF7F0] hover:border-transparent dark:hover:bg-[#EFECE4] dark:hover:text-[#111215] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
