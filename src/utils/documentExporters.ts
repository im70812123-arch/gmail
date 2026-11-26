import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type {
  PptCoverStyle,
  PptThemeId,
  StructuredDocumentData,
  StructuredPresentationData,
} from '../types/study';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function sanitizeFilename(raw: string, ext: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 72);
  const base = cleaned || 'STUDY_ON_자료';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function cleanPlainMathText(raw: string): string {
  return raw
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+?)\$/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\cdot/g, '·')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ============================================================================
 * 1. Word (.docx) Exporter
 * ========================================================================== */
export async function exportToDocx(docData: StructuredDocumentData): Promise<void> {
  const fontSpec = {
    ascii: 'Malgun Gothic',
    hAnsi: 'Malgun Gothic',
    eastAsia: '맑은 고딕',
    cs: 'Malgun Gothic',
  };

  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: cleanPlainMathText(docData.subjectLabel || 'STUDY:ON 학습 노트'),
          font: fontSpec,
          size: 20,
          bold: true,
          color: '5A5E66',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: cleanPlainMathText(docData.title),
          font: fontSpec,
          size: 40,
          bold: true,
          color: '17191C',
        }),
      ],
    })
  );

  if (docData.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: cleanPlainMathText(docData.subtitle),
            font: fontSpec,
            size: 24,
            color: '4C5059',
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 260 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'DED7C8',
          space: 8,
        },
      },
      children: [
        new TextRun({
          text: cleanPlainMathText(docData.authorLine),
          font: fontSpec,
          size: 18,
          color: '787B84',
        }),
      ],
    })
  );

  if (docData.overview?.trim()) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 220 },
        shading: { type: ShadingType.CLEAR, fill: 'F5F1E8' },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'E2DACB', space: 8 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2DACB', space: 8 },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'E2DACB', space: 10 },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'E2DACB', space: 10 },
        },
        children: [
          new TextRun({
            text: '핵심 요약: ',
            font: fontSpec,
            size: 21,
            bold: true,
            color: '17191C',
          }),
          new TextRun({
            text: cleanPlainMathText(docData.overview),
            font: fontSpec,
            size: 21,
            color: '2C2F36',
          }),
        ],
      })
    );
  }

  for (const sec of docData.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: cleanPlainMathText(sec.heading),
            font: fontSpec,
            size: 28,
            bold: true,
            color: '17191C',
          }),
        ],
      })
    );

    if (sec.summary?.trim()) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: cleanPlainMathText(sec.summary),
              font: fontSpec,
              size: 20,
              italics: true,
              color: '5A5E66',
            }),
          ],
        })
      );
    }

    for (const para of sec.paragraphs || []) {
      if (!para.trim()) continue;
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 340 },
          children: [
            new TextRun({
              text: cleanPlainMathText(para),
              font: fontSpec,
              size: 21,
              color: '1E2024',
            }),
          ],
        })
      );
    }

    if (sec.bullets && sec.bullets.length > 0) {
      for (const bullet of sec.bullets) {
        if (!bullet.trim()) continue;
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 70, line: 320 },
            children: [
              new TextRun({
                text: cleanPlainMathText(bullet),
                font: fontSpec,
                size: 20,
                color: '1E2024',
              }),
            ],
          })
        );
      }
    }

    if (sec.tableHeaders && sec.tableHeaders.length > 0 && sec.tableRows && sec.tableRows.length > 0) {
      const colCount = sec.tableHeaders.length;
      const headerRow = new TableRow({
        tableHeader: true,
        children: sec.tableHeaders.map(
          (h) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'EFEAE0' },
              margins: { top: 90, bottom: 90, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cleanPlainMathText(h),
                      font: fontSpec,
                      size: 19,
                      bold: true,
                      color: '17191C',
                    }),
                  ],
                }),
              ],
            })
        ),
      });

      const bodyRows = sec.tableRows.map(
        (row) =>
          new TableRow({
            children: Array.from({ length: colCount }, (_, idx) => {
              const cellText = row[idx] ?? '';
              return new TableCell({
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cleanPlainMathText(cellText),
                        font: fontSpec,
                        size: 19,
                        color: '2C2F36',
                      }),
                    ],
                  }),
                ],
              });
            }),
          })
      );

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...bodyRows],
        })
      );
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }

    if (sec.callout?.trim()) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 160 },
          shading: { type: ShadingType.CLEAR, fill: 'F8F5EE' },
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'DDD4C2', space: 6 },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDD4C2', space: 6 },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'DDD4C2', space: 8 },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'DDD4C2', space: 8 },
          },
          children: [
            new TextRun({
              text: '핵심 포인트: ',
              font: fontSpec,
              size: 20,
              bold: true,
              color: '17191C',
            }),
            new TextRun({
              text: cleanPlainMathText(sec.callout),
              font: fontSpec,
              size: 20,
              color: '2C2F36',
            }),
          ],
        })
      );
    }
  }

  if (docData.conclusion?.trim()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 90 },
        children: [
          new TextRun({
            text: '정리 및 결론',
            font: fontSpec,
            size: 26,
            bold: true,
            color: '17191C',
          }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 180, line: 340 },
        children: [
          new TextRun({
            text: cleanPlainMathText(docData.conclusion),
            font: fontSpec,
            size: 21,
            color: '1E2024',
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: 'STUDY:ON 디지털 학습 노트',
          font: fontSpec,
          size: 16,
          color: '8A8D95',
        }),
      ],
    })
  );

  const wordDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1134,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  triggerDownload(blob, sanitizeFilename(docData.title, 'docx'));
}

/* ============================================================================
 * 2. Hancom Hangul (.hwpx — OWPML Standard) Exporter
 * ========================================================================== */
function buildHwpxHeaderXml(): string {
  const makeFontFace = (lang: string) => `
    <hh:fontface lang="${lang}" fontCnt="2">
      <hh:font id="0" face="함초롬돋움" type="TTF" isEmbedded="0">
        <hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>
      </hh:font>
      <hh:font id="1" face="함초롬바탕" type="TTF" isEmbedded="0">
        <hh:typeInfo familyType="FCAT_MYUNGJO" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>
      </hh:font>
    </hh:fontface>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" version="1.4" secCnt="1">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces itemCnt="7">
      ${makeFontFace('HANGUL')}
      ${makeFontFace('LATIN')}
      ${makeFontFace('HANJA')}
      ${makeFontFace('JAPANESE')}
      ${makeFontFace('OTHER')}
      ${makeFontFace('SYMBOL')}
      ${makeFontFace('USER')}
    </hh:fontfaces>
    <hh:borderFills itemCnt="3">
      <hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        <hh:slash type="NONE" Crooked="0" isCounter="0"/>
        <hh:backSlash type="NONE" Crooked="0" isCounter="0"/>
        <hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/>
        <hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/>
        <hh:topBorder type="NONE" width="0.1 mm" color="#000000"/>
        <hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/>
        <hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>
      </hh:borderFill>
      <hh:borderFill id="2" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        <hh:slash type="NONE" Crooked="0" isCounter="0"/>
        <hh:backSlash type="NONE" Crooked="0" isCounter="0"/>
        <hh:leftBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:rightBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:topBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:bottomBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>
      </hh:borderFill>
      <hh:borderFill id="3" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
        <hh:slash type="NONE" Crooked="0" isCounter="0"/>
        <hh:backSlash type="NONE" Crooked="0" isCounter="0"/>
        <hh:leftBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:rightBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:topBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:bottomBorder type="SOLID" width="0.12 mm" color="#B8B2A6"/>
        <hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>
        <hc:fillBrush>
          <hc:winBrush faceColor="#EFEAE0" hatchColor="#999999" alpha="0"/>
        </hc:fillBrush>
      </hh:borderFill>
    </hh:borderFills>
    <hh:charProperties itemCnt="6">
      <hh:charPr id="0" height="1050" textColor="#1E2024" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="1" height="2000" textColor="#17191C" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:bold/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="2" height="1400" textColor="#17191C" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:bold/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="3" height="1050" textColor="#17191C" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:bold/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="4" height="950" textColor="#5A5E66" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
      <hh:charPr id="5" height="1150" textColor="#4C5059" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:underline type="NONE" shape="SOLID" color="#000000"/>
        <hh:strikeout shape="NONE" color="#000000"/>
        <hh:outline type="NONE"/>
        <hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:tabProperties itemCnt="1">
      <hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/>
    </hh:tabProperties>
    <hh:numberings itemCnt="1">
      <hh:numbering id="1" start="0">
        <hh:paraHead start="1" level="1" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="DIGIT" charPrIDRef="4294967295" checkable="0">^1.</hh:paraHead>
      </hh:numbering>
    </hh:numberings>
    <hh:paraProperties itemCnt="4">
      <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        <hh:margin>
          <hc:intent value="0" unit="HWPUNIT"/>
          <hc:left value="0" unit="HWPUNIT"/>
          <hc:right value="0" unit="HWPUNIT"/>
          <hc:prev value="0" unit="HWPUNIT"/>
          <hc:next value="450" unit="HWPUNIT"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="165" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      <hh:paraPr id="1" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="LEFT" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="1" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        <hh:margin>
          <hc:intent value="0" unit="HWPUNIT"/>
          <hc:left value="0" unit="HWPUNIT"/>
          <hc:right value="0" unit="HWPUNIT"/>
          <hc:prev value="900" unit="HWPUNIT"/>
          <hc:next value="450" unit="HWPUNIT"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="150" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      <hh:paraPr id="2" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="LEFT" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        <hh:margin>
          <hc:intent value="-600" unit="HWPUNIT"/>
          <hc:left value="1000" unit="HWPUNIT"/>
          <hc:right value="0" unit="HWPUNIT"/>
          <hc:prev value="0" unit="HWPUNIT"/>
          <hc:next value="350" unit="HWPUNIT"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
      <hh:paraPr id="3" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="CENTER" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:autoSpacing eAsianEng="0" eAsianNum="0"/>
        <hh:margin>
          <hc:intent value="0" unit="HWPUNIT"/>
          <hc:left value="0" unit="HWPUNIT"/>
          <hc:right value="0" unit="HWPUNIT"/>
          <hc:prev value="0" unit="HWPUNIT"/>
          <hc:next value="400" unit="HWPUNIT"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="150" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
    </hh:paraProperties>
    <hh:styles itemCnt="1">
      <hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/>
    </hh:styles>
  </hh:refList>
  <hh:compatibleDocument targetProgram="HWP201X">
    <hh:layoutCompatibility/>
  </hh:compatibleDocument>
  <hh:docOption>
    <hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/>
  </hh:docOption>
  <hh:trackchageConfig flags="56"/>
</hh:head>`;
}

export async function exportToHwpx(docData: StructuredDocumentData): Promise<void> {
  const zip = new JSZip();

  let paraIdCounter = 1000;
  let tblIdCounter = 50000;
  const previewLines: string[] = [];

  const nextParaId = () => {
    paraIdCounter += 1;
    return String(paraIdCounter);
  };

  const makeSimplePara = (
    text: string,
    charPrIDRef: number,
    paraPrIDRef: number,
    isFirst = false
  ): string => {
    const clean = cleanPlainMathText(text);
    if (clean) previewLines.push(clean);
    const secPrBlock = isFirst
      ? `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">
          <hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>
          <hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
          <hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>
          <hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>
          <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
            <hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>
          </hp:pagePr>
          <hp:footNotePr>
            <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
            <hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>
            <hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>
            <hp:numbering type="CONTINUOUS" newNum="1"/>
            <hp:placement place="EACH_COLUMN" beneathText="0"/>
          </hp:footNotePr>
          <hp:endNotePr>
            <hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>
            <hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>
            <hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>
            <hp:numbering type="CONTINUOUS" newNum="1"/>
            <hp:placement place="END_OF_DOCUMENT" beneathText="0"/>
          </hp:endNotePr>
          <hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER">
            <hp:offset left="1417" right="1417" top="1417" bottom="1417"/>
          </hp:pageBorderFill>
        </hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`
      : '';

    return `<hp:p id="${nextParaId()}" paraPrIDRef="${paraPrIDRef}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="${charPrIDRef}">${secPrBlock}<hp:t>${xmlEscape(clean)}</hp:t></hp:run>
    </hp:p>`;
  };

  const makeTablePara = (headers: string[], rows: string[][]): string => {
    tblIdCounter += 1;
    const tblId = String(tblIdCounter);
    const colCnt = Math.max(1, headers.length);
    const allRows = [headers, ...rows];
    const rowCnt = allRows.length;
    // Usable A4 width in HWPUNIT: 59528 - 8504*2 = 42520
    const usableWidth = 42520;
    const colWidth = Math.floor(usableWidth / colCnt);

    const rowXml = allRows
      .map((row, rIdx) => {
        const isHeader = rIdx === 0;
        const cellsXml = Array.from({ length: colCnt }, (_, cIdx) => {
          const cellText = cleanPlainMathText(row[cIdx] ?? '');
          const cellParaId = nextParaId();
          return `<hp:tc name="" header="${isHeader ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${isHeader ? 3 : 2}">
            <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
              <hp:p id="${cellParaId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
                <hp:run charPrIDRef="${isHeader ? 3 : 0}"><hp:t>${xmlEscape(cellText)}</hp:t></hp:run>
              </hp:p>
            </hp:subList>
            <hp:cellAddr colAddr="${cIdx}" rowAddr="${rIdx}"/>
            <hp:cellSpan colSpan="1" rowSpan="1"/>
            <hp:cellSz width="${colWidth}" height="1200"/>
            <hp:cellMargin left="283" right="283" top="141" bottom="141"/>
          </hp:tc>`;
        }).join('');
        return `<hp:tr>${cellsXml}</hp:tr>`;
      })
      .join('');

    return `<hp:p id="${nextParaId()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0">
        <hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rowCnt}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="2" noAdjust="0">
          <hp:sz width="${colWidth * colCnt}" widthRelTo="ABSOLUTE" height="${rowCnt * 1200}" heightRelTo="ABSOLUTE" protect="0"/>
          <hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
          <hp:outMargin left="0" right="0" top="283" bottom="283"/>
          <hp:inMargin left="283" right="283" top="141" bottom="141"/>
          ${rowXml}
        </hp:tbl>
      </hp:run>
    </hp:p>`;
  };

  const sectionParas: string[] = [];

  // First paragraph carries secPr
  sectionParas.push(makeSimplePara(docData.subjectLabel || 'STUDY:ON 학습 노트', 4, 0, true));
  sectionParas.push(makeSimplePara(docData.title, 1, 0));
  if (docData.subtitle) {
    sectionParas.push(makeSimplePara(docData.subtitle, 5, 0));
  }
  sectionParas.push(makeSimplePara(docData.authorLine, 4, 0));

  if (docData.overview?.trim()) {
    sectionParas.push(makeSimplePara(`[핵심 요약] ${docData.overview}`, 3, 0));
  }

  for (const sec of docData.sections) {
    sectionParas.push(makeSimplePara(sec.heading, 2, 1));
    if (sec.summary?.trim()) {
      sectionParas.push(makeSimplePara(sec.summary, 4, 0));
    }
    for (const para of sec.paragraphs || []) {
      if (!para.trim()) continue;
      sectionParas.push(makeSimplePara(para, 0, 0));
    }
    for (const bullet of sec.bullets || []) {
      if (!bullet.trim()) continue;
      sectionParas.push(makeSimplePara(`• ${bullet}`, 0, 2));
    }
    if (sec.tableHeaders?.length && sec.tableRows?.length) {
      sectionParas.push(makeTablePara(sec.tableHeaders, sec.tableRows));
    }
    if (sec.callout?.trim()) {
      sectionParas.push(makeSimplePara(`[핵심 포인트] ${sec.callout}`, 3, 0));
    }
  }

  if (docData.conclusion?.trim()) {
    sectionParas.push(makeSimplePara('정리 및 결론', 2, 1));
    sectionParas.push(makeSimplePara(docData.conclusion, 0, 0));
  }

  sectionParas.push(makeSimplePara('STUDY:ON AI 학습 노트에서 작성됨', 4, 3));

  const section0Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/">
  ${sectionParas.join('\n  ')}
</hs:sec>`;

  const versionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="11, 0, 0, 0"/>`;

  const manifestXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <odf:file-entry odf:media-type="application/hwp+zip" odf:full-path="/"/>
  <odf:file-entry odf:media-type="application/xml" odf:full-path="Contents/header.xml"/>
  <odf:file-entry odf:media-type="application/xml" odf:full-path="Contents/section0.xml"/>
  <odf:file-entry odf:media-type="application/hwpml-package+xml" odf:full-path="Contents/content.hpf"/>
</odf:manifest>`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">
  <ocf:rootfiles>
    <ocf:rootfile odf:full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </ocf:rootfiles>
</ocf:container>`;

  const nowIso = new Date().toISOString();
  const contentHpf = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<opf:package xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">
  <opf:metadata>
    <opf:title>${xmlEscape(docData.title)}</opf:title>
    <opf:language>ko</opf:language>
    <opf:meta name="creator" content="text">STUDY:ON</opf:meta>
    <opf:meta name="CreatedDate" content="text">${nowIso}</opf:meta>
    <opf:meta name="ModifiedDate" content="text">${nowIso}</opf:meta>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
    <opf:item id="settings" href="settings.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="header" linear="yes"/>
    <opf:itemref idref="section0" linear="yes"/>
  </opf:spine>
</opf:package>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">
  <ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>
</ha:HWPApplicationSetting>`;

  // OWPML requires mimetype to be uncompressed (STORE)
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  zip.file('version.xml', versionXml);
  zip.file('settings.xml', settingsXml);
  zip.file('META-INF/manifest.xml', manifestXml);
  zip.file('META-INF/container.xml', containerXml);
  zip.file('Contents/content.hpf', contentHpf);
  zip.file('Contents/header.xml', buildHwpxHeaderXml());
  zip.file('Contents/section0.xml', section0Xml);
  zip.file('Preview/PrvText.txt', previewLines.join('\r\n'));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/hwp+zip',
    compression: 'DEFLATE',
  });
  triggerDownload(blob, sanitizeFilename(docData.title, 'hwpx'));
}

/* ============================================================================
 * 3. PowerPoint (.pptx) Exporter
 * ========================================================================== */
export interface PptThemePalette {
  id: PptThemeId;
  label: string;
  coverBg: string;
  coverText: string;
  coverMuted: string;
  slideBg: string;
  cardBg: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  accentText: string;
  accentSoft: string;
  isDarkSlide?: boolean;
}

export const PPT_THEMES: Record<PptThemeId, PptThemePalette> = {
  ivory: {
    id: 'ivory',
    label: '웜 아이보리',
    coverBg: '17191C',
    coverText: 'FAF7F0',
    coverMuted: 'B8B3A7',
    slideBg: 'FAF7F0',
    cardBg: 'FFFEFA',
    border: 'DFD7C6',
    ink: '17191C',
    muted: '5A5E66',
    accent: '2E4A6F',
    accent2: 'C08A3E',
    accentText: 'FFFFFF',
    accentSoft: 'EFEAE0',
  },
  navy: {
    id: 'navy',
    label: '아카데믹 네이비',
    coverBg: '0F172A',
    coverText: 'F8FAFC',
    coverMuted: 'CBD5E1',
    slideBg: 'F8FAFC',
    cardBg: 'FFFFFF',
    border: 'CBD5E1',
    ink: '0F172A',
    muted: '475569',
    accent: '1E3A8A',
    accent2: '0284C7',
    accentText: 'FFFFFF',
    accentSoft: 'EFF6FF',
  },
  sage: {
    id: 'sage',
    label: '세이지 노트',
    coverBg: '14332B',
    coverText: 'F4F7F4',
    coverMuted: 'B7CBC3',
    slideBg: 'F3F6F3',
    cardBg: 'FFFFFF',
    border: 'CBD6CE',
    ink: '142822',
    muted: '4B6059',
    accent: '1E5B46',
    accent2: '4D8B6F',
    accentText: 'FFFFFF',
    accentSoft: 'E6EEE9',
  },
  terracotta: {
    id: 'terracotta',
    label: '테라코타 인문',
    coverBg: '3B1D16',
    coverText: 'FDF7F4',
    coverMuted: 'E6C9BE',
    slideBg: 'FDF8F5',
    cardBg: 'FFFFFF',
    border: 'E7D4CA',
    ink: '2B1814',
    muted: '6E524B',
    accent: 'B44C2E',
    accent2: 'D97757',
    accentText: 'FFFFFF',
    accentSoft: 'FAECE6',
  },
  cobalt: {
    id: 'cobalt',
    label: '코발트 테크',
    coverBg: '0B162C',
    coverText: 'F4F8FF',
    coverMuted: 'B8CBE8',
    slideBg: 'F4F7FC',
    cardBg: 'FFFFFF',
    border: 'CEDAF0',
    ink: '0E172A',
    muted: '4B5C7A',
    accent: '1D4ED8',
    accent2: '0891B2',
    accentText: 'FFFFFF',
    accentSoft: 'E8F0FE',
  },
  editorial: {
    id: 'editorial',
    label: '다크 에디토리얼',
    coverBg: '0D0F14',
    coverText: 'F6F2E9',
    coverMuted: 'B5B0A6',
    slideBg: '14171F',
    cardBg: '1D212B',
    border: '313746',
    ink: 'F3EFE6',
    muted: 'A6A39B',
    accent: 'D4A359',
    accent2: '6EA8FE',
    accentText: '14171F',
    accentSoft: '252A36',
    isDarkSlide: true,
  },
  lavender: {
    id: 'lavender',
    label: '라벤더 스튜디오',
    coverBg: '231B38',
    coverText: 'FAF8FF',
    coverMuted: 'D0C7E6',
    slideBg: 'F8F6FC',
    cardBg: 'FFFFFF',
    border: 'DDD6EB',
    ink: '1E1830',
    muted: '5E5673',
    accent: '5B3CC4',
    accent2: '8B5CF6',
    accentText: 'FFFFFF',
    accentSoft: 'EFEAFC',
  },
};

export async function exportToPptx(
  deck: StructuredPresentationData,
  themeIdOverride?: PptThemeId,
  coverStyleOverride?: PptCoverStyle
): Promise<void> {
  const resolvedThemeId = themeIdOverride || deck.themeId || 'ivory';
  const theme = PPT_THEMES[resolvedThemeId] ?? PPT_THEMES.ivory;
  const coverStyle: PptCoverStyle = coverStyleOverride || deck.coverStyle || 'split';

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
  pptx.title = cleanPlainMathText(deck.title);
  pptx.subject = cleanPlainMathText(deck.subjectLabel);
  pptx.author = 'STUDY:ON';

  const fontFace = 'Malgun Gothic';
  const totalSlides = deck.slides.length;

  deck.slides.forEach((slideData, idx) => {
    const slide = pptx.addSlide();
    const isCover = idx === 0 || slideData.layout === 'title';

    if (slideData.speakerNotes?.trim()) {
      slide.addNotes(cleanPlainMathText(slideData.speakerNotes));
    }

    if (isCover) {
      const coverTitle = cleanPlainMathText(idx === 0 ? deck.title : slideData.title);
      const coverSub = cleanPlainMathText(
        idx === 0 ? deck.subtitle : slideData.subtitle || slideData.bullets?.[0] || ''
      );
      const subjectBadge = cleanPlainMathText(deck.subjectLabel || 'STUDY:ON 발표 자료');

      if (coverStyle === 'split') {
        slide.background = { color: theme.slideBg };
        // Left dark architectural column
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 4.15,
          h: 7.5,
          fill: { color: theme.coverBg },
          line: { color: theme.coverBg, width: 0 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 4.15,
          y: 0,
          w: 0.08,
          h: 7.5,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });

        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.65,
          y: 0.9,
          w: 2.85,
          h: 0.42,
          rectRadius: 0.08,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });
        slide.addText(subjectBadge, {
          x: 0.72,
          y: 0.9,
          w: 2.71,
          h: 0.42,
          fontFace,
          fontSize: 11.5,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: theme.accentText,
        });

        slide.addText('PRESENTATION', {
          x: 0.65,
          y: 5.55,
          w: 3.0,
          h: 0.35,
          fontFace,
          fontSize: 10,
          bold: true,
          color: theme.coverMuted,
        });
        slide.addText(cleanPlainMathText(deck.authorLine), {
          x: 0.65,
          y: 5.9,
          w: 3.1,
          h: 0.9,
          fontFace,
          fontSize: 11,
          color: theme.coverText,
          valign: 'top',
        });

        slide.addText(coverTitle, {
          x: 4.85,
          y: 1.85,
          w: 7.75,
          h: 2.1,
          fontFace,
          fontSize: coverTitle.length > 26 ? 30 : 36,
          bold: true,
          color: theme.ink,
          valign: 'top',
        });
        if (coverSub) {
          slide.addText(coverSub, {
            x: 4.85,
            y: 4.1,
            w: 7.55,
            h: 1.2,
            fontFace,
            fontSize: 16.5,
            color: theme.muted,
            valign: 'top',
          });
        }
        slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, {
          x: 10.6,
          y: 6.72,
          w: 2.0,
          h: 0.35,
          align: 'right',
          fontFace,
          fontSize: 11.5,
          color: theme.muted,
        });
      } else if (coverStyle === 'modern') {
        slide.background = { color: theme.coverBg };
        // Geometric layered blocks on right
        slide.addShape(pptx.ShapeType.rect, {
          x: 9.75,
          y: 0,
          w: 3.583,
          h: 7.5,
          fill: { color: theme.accent, transparency: 15 },
          line: { color: theme.accent, width: 0 },
        });
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 8.95,
          y: 1.15,
          w: 3.4,
          h: 3.4,
          rectRadius: 0.2,
          fill: { color: theme.accent2, transparency: 25 },
          line: { color: theme.coverMuted, width: 0.75, transparency: 55 },
        });
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.9,
          y: 1.15,
          w: 2.8,
          h: 0.4,
          rectRadius: 0.2,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });
        slide.addText(subjectBadge, {
          x: 0.95,
          y: 1.15,
          w: 2.7,
          h: 0.4,
          fontFace,
          fontSize: 11,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: theme.accentText,
        });

        slide.addText(coverTitle, {
          x: 0.9,
          y: 1.85,
          w: 7.8,
          h: 2.2,
          fontFace,
          fontSize: coverTitle.length > 26 ? 30 : 36,
          bold: true,
          color: theme.coverText,
          valign: 'top',
        });
        if (coverSub) {
          slide.addText(coverSub, {
            x: 0.9,
            y: 4.2,
            w: 7.6,
            h: 1.15,
            fontFace,
            fontSize: 16.5,
            color: theme.coverMuted,
            valign: 'top',
          });
        }
        slide.addText(cleanPlainMathText(deck.authorLine), {
          x: 0.9,
          y: 6.45,
          w: 8.6,
          h: 0.4,
          fontFace,
          fontSize: 11.5,
          color: theme.coverMuted,
        });
        slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, {
          x: 10.6,
          y: 6.45,
          w: 1.9,
          h: 0.4,
          align: 'right',
          fontFace,
          fontSize: 11.5,
          color: theme.coverText,
        });
      } else if (coverStyle === 'framed') {
        slide.background = { color: theme.coverBg };
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.65,
          y: 0.65,
          w: 12.033,
          h: 6.2,
          rectRadius: 0.16,
          fill: { color: theme.slideBg },
          line: { color: theme.accent, width: 2 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.65,
          y: 0.65,
          w: 12.033,
          h: 0.14,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });
        slide.addText(subjectBadge, {
          x: 1.35,
          y: 1.35,
          w: 10.6,
          h: 0.4,
          fontFace,
          fontSize: 12,
          bold: true,
          color: theme.accent,
        });
        slide.addText(coverTitle, {
          x: 1.35,
          y: 1.95,
          w: 10.6,
          h: 2.0,
          fontFace,
          fontSize: coverTitle.length > 28 ? 30 : 35,
          bold: true,
          color: theme.ink,
          valign: 'top',
        });
        if (coverSub) {
          slide.addText(coverSub, {
            x: 1.35,
            y: 4.05,
            w: 10.4,
            h: 1.0,
            fontFace,
            fontSize: 16.5,
            color: theme.muted,
            valign: 'top',
          });
        }
        slide.addShape(pptx.ShapeType.line, {
          x: 1.35,
          y: 5.55,
          w: 10.6,
          h: 0,
          line: { color: theme.border, width: 1 },
        });
        slide.addText(cleanPlainMathText(deck.authorLine), {
          x: 1.35,
          y: 5.8,
          w: 8.5,
          h: 0.4,
          fontFace,
          fontSize: 11.5,
          color: theme.muted,
        });
        slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, {
          x: 10.1,
          y: 5.8,
          w: 1.85,
          h: 0.4,
          align: 'right',
          fontFace,
          fontSize: 11.5,
          color: theme.muted,
        });
      } else {
        // minimal
        slide.background = { color: theme.coverBg };
        slide.addText(subjectBadge, {
          x: 0.9,
          y: 1.45,
          w: 11.5,
          h: 0.4,
          fontFace,
          fontSize: 13,
          bold: true,
          color: theme.coverMuted,
        });
        slide.addText(coverTitle, {
          x: 0.9,
          y: 2.05,
          w: 11.4,
          h: 1.9,
          fontFace,
          fontSize: coverTitle.length > 28 ? 31 : 36,
          bold: true,
          color: theme.coverText,
          valign: 'top',
        });
        if (coverSub) {
          slide.addText(coverSub, {
            x: 0.9,
            y: 4.15,
            w: 10.6,
            h: 1.05,
            fontFace,
            fontSize: 17.5,
            color: theme.coverMuted,
            valign: 'top',
          });
        }
        slide.addShape(pptx.ShapeType.line, {
          x: 0.9,
          y: 5.95,
          w: 11.5,
          h: 0,
          line: { color: theme.coverMuted, width: 0.75, transparency: 60 },
        });
        slide.addText(cleanPlainMathText(deck.authorLine), {
          x: 0.9,
          y: 6.18,
          w: 9.0,
          h: 0.4,
          fontFace,
          fontSize: 12,
          color: theme.coverMuted,
        });
        slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`, {
          x: 10.5,
          y: 6.18,
          w: 1.9,
          h: 0.4,
          align: 'right',
          fontFace,
          fontSize: 12,
          color: theme.coverMuted,
        });
      }
      return;
    }

    // Content Slide
    slide.background = { color: theme.slideBg };

    // Top accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.08,
      fill: { color: theme.accent },
      line: { color: theme.accent, width: 0 },
    });

    // Kicker pill + slide title + optional subtitle
    const kickerLabel = cleanPlainMathText(slideData.kicker || deck.subjectLabel);
    slide.addText(kickerLabel, {
      x: 0.85,
      y: 0.36,
      w: 10.0,
      h: 0.28,
      fontFace,
      fontSize: 10.5,
      bold: true,
      color: theme.accent,
    });

    const slideTitle = cleanPlainMathText(slideData.title);
    slide.addText(slideTitle, {
      x: 0.85,
      y: 0.66,
      w: 11.6,
      h: 0.56,
      fontFace,
      fontSize: slideTitle.length > 32 ? 20.5 : 23,
      bold: true,
      color: theme.ink,
    });

    const hasSubtitle = Boolean(slideData.subtitle?.trim());
    if (hasSubtitle && slideData.subtitle) {
      slide.addText(cleanPlainMathText(slideData.subtitle), {
        x: 0.85,
        y: 1.24,
        w: 11.6,
        h: 0.34,
        fontFace,
        fontSize: 12.5,
        color: theme.muted,
      });
    }

    const dividerY = hasSubtitle ? 1.66 : 1.38;
    slide.addShape(pptx.ShapeType.line, {
      x: 0.85,
      y: dividerY,
      w: 11.63,
      h: 0,
      line: { color: theme.border, width: 1 },
    });

    const hasCallout = Boolean(slideData.callout?.trim());
    const contentTopY = dividerY + 0.22;
    const contentBottomY = hasCallout ? 5.68 : 6.62;
    const contentHeight = contentBottomY - contentTopY;

    if (
      slideData.layout === 'table' &&
      slideData.tableHeaders &&
      slideData.tableHeaders.length > 0 &&
      slideData.tableRows &&
      slideData.tableRows.length > 0
    ) {
      const colCount = slideData.tableHeaders.length;
      const rowCount = slideData.tableRows.length;
      const cellFontSize = rowCount >= 5 ? 11 : 12.5;
      const rows: PptxGenJS.TableRow[] = [
        slideData.tableHeaders.map((h) => ({
          text: cleanPlainMathText(h),
          options: {
            bold: true,
            fill: { color: theme.accent },
            color: theme.accentText,
            fontFace,
            fontSize: 12.5,
            align: 'left' as const,
            valign: 'middle' as const,
          },
        })),
        ...slideData.tableRows.map((r, rIdx) =>
          Array.from({ length: colCount }, (_, cIdx) => ({
            text: cleanPlainMathText(r[cIdx] ?? ''),
            options: {
              fill: { color: rIdx % 2 === 0 ? theme.cardBg : theme.accentSoft },
              color: theme.ink,
              fontFace,
              fontSize: cellFontSize,
              valign: 'middle' as const,
            },
          }))
        ),
      ];

      slide.addTable(rows, {
        x: 0.85,
        y: contentTopY,
        w: 11.63,
        colW: Array.from({ length: colCount }, () => 11.63 / colCount),
        border: { pt: 0.75, color: theme.border },
        margin: [0.09, 0.14, 0.09, 0.14],
      });
    } else if (
      slideData.layout === 'cards' &&
      slideData.cards &&
      slideData.cards.length > 0
    ) {
      const cards = slideData.cards.slice(0, 6);
      const count = cards.length;
      const cols = count === 2 || count === 4 ? 2 : 3;
      const rowsCount = Math.ceil(count / cols);
      const gapX = 0.28;
      const gapY = 0.24;
      const cardW = (11.63 - gapX * (cols - 1)) / cols;
      const cardH = (contentHeight - gapY * (rowsCount - 1)) / rowsCount;

      cards.forEach((card, cIdx) => {
        const colIdx = cIdx % cols;
        const rowIdx = Math.floor(cIdx / cols);
        const cx = 0.85 + colIdx * (cardW + gapX);
        const cy = contentTopY + rowIdx * (cardH + gapY);

        slide.addShape(pptx.ShapeType.roundRect, {
          x: cx,
          y: cy,
          w: cardW,
          h: cardH,
          rectRadius: 0.12,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });
        // Top accent stripe inside card
        slide.addShape(pptx.ShapeType.rect, {
          x: cx,
          y: cy,
          w: cardW,
          h: 0.07,
          fill: { color: cIdx % 2 === 0 ? theme.accent : theme.accent2 },
          line: { color: theme.accent, width: 0 },
        });

        let textY = cy + 0.18;
        if (card.tag?.trim()) {
          slide.addText(cleanPlainMathText(card.tag), {
            x: cx + 0.22,
            y: textY,
            w: cardW - 0.44,
            h: 0.24,
            fontFace,
            fontSize: 9.5,
            bold: true,
            color: theme.accent,
          });
          textY += 0.26;
        }

        slide.addText(cleanPlainMathText(card.title), {
          x: cx + 0.22,
          y: textY,
          w: cardW - 0.44,
          h: 0.36,
          fontFace,
          fontSize: rowsCount > 1 ? 13.5 : 15.5,
          bold: true,
          color: theme.ink,
          valign: 'top',
        });
        textY += 0.38;

        const bodyLen = card.body.length;
        const bodyFontSize =
          rowsCount > 1
            ? bodyLen > 95
              ? 10.5
              : 11.5
            : bodyLen > 110
              ? 12
              : 13.5;

        slide.addText(cleanPlainMathText(card.body), {
          x: cx + 0.22,
          y: textY,
          w: cardW - 0.44,
          h: Math.max(0.5, cy + cardH - textY - 0.14),
          fontFace,
          fontSize: bodyFontSize,
          color: theme.muted,
          valign: 'top',
        });
      });
    } else if (
      slideData.layout === 'timeline' &&
      slideData.steps &&
      slideData.steps.length > 0
    ) {
      const steps = slideData.steps.slice(0, 5);
      const count = steps.length;
      const gapX = count >= 5 ? 0.18 : 0.26;
      const stepW = (11.63 - gapX * (count - 1)) / count;
      const trackY = contentTopY + 0.32;

      // Connecting track line
      slide.addShape(pptx.ShapeType.line, {
        x: 0.85 + stepW / 2,
        y: trackY,
        w: 11.63 - stepW,
        h: 0,
        line: { color: theme.accent, width: 2 },
      });

      steps.forEach((st, sIdx) => {
        const sx = 0.85 + sIdx * (stepW + gapX);
        const pillW = 0.72;
        const pillX = sx + (stepW - pillW) / 2;

        slide.addShape(pptx.ShapeType.roundRect, {
          x: pillX,
          y: contentTopY + 0.08,
          w: pillW,
          h: 0.46,
          rectRadius: 0.23,
          fill: { color: theme.accent },
          line: { color: theme.slideBg, width: 2 },
        });
        slide.addText(cleanPlainMathText(st.step || `0${sIdx + 1}`), {
          x: pillX,
          y: contentTopY + 0.08,
          w: pillW,
          h: 0.46,
          fontFace,
          fontSize: 12,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: theme.accentText,
        });

        const cardY = contentTopY + 0.74;
        const cardH = contentHeight - 0.78;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: sx,
          y: cardY,
          w: stepW,
          h: cardH,
          rectRadius: 0.12,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });

        slide.addText(cleanPlainMathText(st.title), {
          x: sx + 0.18,
          y: cardY + 0.2,
          w: stepW - 0.36,
          h: 0.56,
          fontFace,
          fontSize: count >= 5 ? 12.5 : 14,
          bold: true,
          align: 'center',
          color: theme.ink,
          valign: 'top',
        });

        slide.addText(cleanPlainMathText(st.detail), {
          x: sx + 0.18,
          y: cardY + 0.84,
          w: stepW - 0.36,
          h: cardH - 1.0,
          fontFace,
          fontSize: count >= 5 ? 10.5 : 12,
          align: 'left',
          color: theme.muted,
          valign: 'top',
        });
      });
    } else if (
      slideData.layout === 'stats' &&
      slideData.stats &&
      slideData.stats.length > 0
    ) {
      const stats = slideData.stats.slice(0, 4);
      const count = stats.length;
      const gapX = 0.25;
      const statW = (11.63 - gapX * (count - 1)) / count;
      const hasBullets = (slideData.bullets?.length || 0) > 0;
      const statH = hasBullets ? Math.min(2.35, contentHeight * 0.52) : contentHeight;

      stats.forEach((st, idxStat) => {
        const sx = 0.85 + idxStat * (statW + gapX);
        slide.addShape(pptx.ShapeType.roundRect, {
          x: sx,
          y: contentTopY,
          w: statW,
          h: statH,
          rectRadius: 0.14,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: sx,
          y: contentTopY,
          w: statW,
          h: 0.08,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });

        slide.addText(cleanPlainMathText(st.value), {
          x: sx + 0.2,
          y: contentTopY + 0.24,
          w: statW - 0.4,
          h: 0.65,
          fontFace,
          fontSize: st.value.length > 8 ? 20 : 26,
          bold: true,
          color: theme.accent,
          valign: 'middle',
        });
        slide.addText(cleanPlainMathText(st.label), {
          x: sx + 0.2,
          y: contentTopY + 0.94,
          w: statW - 0.4,
          h: 0.45,
          fontFace,
          fontSize: 13.5,
          bold: true,
          color: theme.ink,
          valign: 'top',
        });
        if (st.note?.trim()) {
          slide.addText(cleanPlainMathText(st.note), {
            x: sx + 0.2,
            y: contentTopY + 1.42,
            w: statW - 0.4,
            h: Math.max(0.45, statH - 1.56),
            fontFace,
            fontSize: 11,
            color: theme.muted,
            valign: 'top',
          });
        }
      });

      if (hasBullets) {
        const lowerY = contentTopY + statH + 0.22;
        const lowerH = contentBottomY - lowerY;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.85,
          y: lowerY,
          w: 11.63,
          h: lowerH,
          rectRadius: 0.12,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });
        const extraRows: PptxGenJS.TextProps[] = slideData.bullets.map((b) => ({
          text: cleanPlainMathText(b),
          options: {
            bullet: { indent: 14 },
            paraSpaceAfter: 6,
            fontFace,
            fontSize: 13,
            color: theme.ink,
          },
        }));
        slide.addText(extraRows, {
          x: 1.15,
          y: lowerY + 0.18,
          w: 11.0,
          h: Math.max(0.6, lowerH - 0.34),
          valign: 'top',
        });
      }
    } else if (slideData.layout === 'quote' && slideData.quoteText?.trim()) {
      const hasBullets = (slideData.bullets?.length || 0) > 0;
      const quoteH = hasBullets ? contentHeight * 0.56 : contentHeight;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.85,
        y: contentTopY,
        w: 11.63,
        h: quoteH,
        rectRadius: 0.14,
        fill: { color: theme.accentSoft },
        line: { color: theme.border, width: 1 },
      });
      slide.addText('“', {
        x: 1.15,
        y: contentTopY + 0.08,
        w: 0.8,
        h: 0.7,
        fontFace,
        fontSize: 42,
        bold: true,
        color: theme.accent,
      });
      slide.addText(cleanPlainMathText(slideData.quoteText), {
        x: 1.45,
        y: contentTopY + 0.58,
        w: 10.4,
        h: Math.max(1.0, quoteH - 1.25),
        fontFace,
        fontSize: slideData.quoteText.length > 90 ? 17 : 20,
        bold: true,
        color: theme.ink,
        valign: 'middle',
      });
      if (slideData.quoteAuthor?.trim()) {
        slide.addText(`— ${cleanPlainMathText(slideData.quoteAuthor)}`, {
          x: 1.45,
          y: contentTopY + quoteH - 0.52,
          w: 10.4,
          h: 0.36,
          align: 'right',
          fontFace,
          fontSize: 12.5,
          bold: true,
          color: theme.accent,
        });
      }

      if (hasBullets) {
        const lowerY = contentTopY + quoteH + 0.22;
        const lowerH = contentBottomY - lowerY;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.85,
          y: lowerY,
          w: 11.63,
          h: lowerH,
          rectRadius: 0.12,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });
        const extraRows: PptxGenJS.TextProps[] = slideData.bullets.map((b) => ({
          text: cleanPlainMathText(b),
          options: {
            bullet: { indent: 14 },
            paraSpaceAfter: 6,
            fontFace,
            fontSize: 13.5,
            color: theme.ink,
          },
        }));
        slide.addText(extraRows, {
          x: 1.15,
          y: lowerY + 0.18,
          w: 11.0,
          h: Math.max(0.6, lowerH - 0.34),
          valign: 'top',
        });
      }
    } else if (
      slideData.layout === 'two-column' &&
      slideData.rightBullets &&
      slideData.rightBullets.length > 0
    ) {
      const leftBullets = slideData.bullets || [];
      const rightBullets = slideData.rightBullets || [];
      const maxBullets = Math.max(leftBullets.length, rightBullets.length);
      const colFontSize = maxBullets >= 5 ? 12.5 : 14;

      // Left card
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.85,
        y: contentTopY,
        w: 5.62,
        h: contentHeight,
        rectRadius: 0.12,
        fill: { color: theme.cardBg },
        line: { color: theme.border, width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.85,
        y: contentTopY,
        w: 5.62,
        h: 0.08,
        fill: { color: theme.accent },
        line: { color: theme.accent, width: 0 },
      });

      const hasLeftTitle = Boolean(slideData.leftTitle?.trim());
      if (hasLeftTitle && slideData.leftTitle) {
        slide.addText(cleanPlainMathText(slideData.leftTitle), {
          x: 1.15,
          y: contentTopY + 0.22,
          w: 5.02,
          h: 0.38,
          fontFace,
          fontSize: 15,
          bold: true,
          color: theme.accent,
        });
      }

      const leftTextRows: PptxGenJS.TextProps[] = leftBullets.map((b) => ({
        text: cleanPlainMathText(b),
        options: {
          bullet: { indent: 14 },
          paraSpaceAfter: 9,
          fontFace,
          fontSize: colFontSize,
          color: theme.ink,
        },
      }));
      slide.addText(leftTextRows, {
        x: 1.15,
        y: contentTopY + (hasLeftTitle ? 0.68 : 0.28),
        w: 5.02,
        h: contentHeight - (hasLeftTitle ? 0.85 : 0.45),
        valign: 'top',
      });

      // Right card
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 6.86,
        y: contentTopY,
        w: 5.62,
        h: contentHeight,
        rectRadius: 0.12,
        fill: { color: theme.cardBg },
        line: { color: theme.border, width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 6.86,
        y: contentTopY,
        w: 5.62,
        h: 0.08,
        fill: { color: theme.accent2 },
        line: { color: theme.accent2, width: 0 },
      });

      const hasRightTitle = Boolean(slideData.rightTitle?.trim());
      if (hasRightTitle && slideData.rightTitle) {
        slide.addText(cleanPlainMathText(slideData.rightTitle), {
          x: 7.16,
          y: contentTopY + 0.22,
          w: 5.02,
          h: 0.38,
          fontFace,
          fontSize: 15,
          bold: true,
          color: theme.accent,
        });
      }

      const rightTextRows: PptxGenJS.TextProps[] = rightBullets.map((b) => ({
        text: cleanPlainMathText(b),
        options: {
          bullet: { indent: 14 },
          paraSpaceAfter: 9,
          fontFace,
          fontSize: colFontSize,
          color: theme.ink,
        },
      }));
      slide.addText(rightTextRows, {
        x: 7.16,
        y: contentTopY + (hasRightTitle ? 0.68 : 0.28),
        w: 5.02,
        h: contentHeight - (hasRightTitle ? 0.85 : 0.45),
        valign: 'top',
      });
    } else if (slideData.layout === 'agenda') {
      const items = (slideData.bullets || []).slice(0, 6);
      const count = Math.max(1, items.length);
      const gapY = 0.16;
      const itemH = Math.min(0.95, (contentHeight - gapY * (count - 1)) / count);

      items.forEach((b, bIdx) => {
        const iy = contentTopY + bIdx * (itemH + gapY);
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.85,
          y: iy,
          w: 11.63,
          h: itemH,
          rectRadius: 0.1,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 1.05,
          y: iy + (itemH - 0.44) / 2,
          w: 0.56,
          h: 0.44,
          rectRadius: 0.08,
          fill: { color: theme.accent },
          line: { color: theme.accent, width: 0 },
        });
        slide.addText(String(bIdx + 1).padStart(2, '0'), {
          x: 1.05,
          y: iy + (itemH - 0.44) / 2,
          w: 0.56,
          h: 0.44,
          fontFace,
          fontSize: 13,
          bold: true,
          align: 'center',
          valign: 'middle',
          color: theme.accentText,
        });
        slide.addText(cleanPlainMathText(b), {
          x: 1.8,
          y: iy + 0.08,
          w: 10.4,
          h: itemH - 0.16,
          fontFace,
          fontSize: itemH < 0.72 ? 13 : 14.5,
          bold: true,
          color: theme.ink,
          valign: 'middle',
        });
      });
    } else {
      // Standard bullets or summary — auto-split into 2 clean columns if dense/many items
      const items = slideData.bullets || [];
      const totalChars = items.reduce((sum, s) => sum + s.length, 0);
      const splitTwoCols = items.length >= 6 || (items.length >= 4 && totalChars > 340);

      if (splitTwoCols) {
        const mid = Math.ceil(items.length / 2);
        const leftItems = items.slice(0, mid);
        const rightItems = items.slice(mid);
        const denseFontSize = items.length >= 6 ? 12.5 : 13.5;

        [
          { list: leftItems, x: 0.85 },
          { list: rightItems, x: 6.86 },
        ].forEach((col) => {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: col.x,
            y: contentTopY,
            w: 5.62,
            h: contentHeight,
            rectRadius: 0.12,
            fill: { color: theme.cardBg },
            line: { color: theme.border, width: 1 },
          });
          const rows: PptxGenJS.TextProps[] = col.list.map((b) => ({
            text: cleanPlainMathText(b),
            options: {
              bullet: { indent: 14 },
              paraSpaceAfter: 10,
              fontFace,
              fontSize: denseFontSize,
              color: theme.ink,
            },
          }));
          slide.addText(rows, {
            x: col.x + 0.3,
            y: contentTopY + 0.28,
            w: 5.02,
            h: contentHeight - 0.56,
            valign: 'top',
          });
        });
      } else {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.85,
          y: contentTopY,
          w: 11.63,
          h: contentHeight,
          rectRadius: 0.12,
          fill: { color: theme.cardBg },
          line: { color: theme.border, width: 1 },
        });

        const fontSize = totalChars > 240 ? 14 : 15.5;
        const bulletRows: PptxGenJS.TextProps[] = items.map((b) => ({
          text: cleanPlainMathText(b),
          options: {
            bullet: { indent: 16 },
            paraSpaceAfter: 11,
            fontFace,
            fontSize,
            color: theme.ink,
          },
        }));

        slide.addText(bulletRows, {
          x: 1.2,
          y: contentTopY + 0.3,
          w: 10.95,
          h: contentHeight - 0.55,
          valign: 'top',
        });
      }
    }

    if (hasCallout && slideData.callout) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.85,
        y: 5.86,
        w: 11.63,
        h: 0.7,
        rectRadius: 0.08,
        fill: { color: theme.accentSoft },
        line: { color: theme.border, width: 0.75 },
      });
      slide.addText(`핵심 포인트  |  ${cleanPlainMathText(slideData.callout)}`, {
        x: 1.1,
        y: 5.93,
        w: 11.1,
        h: 0.56,
        fontFace,
        fontSize: 13,
        bold: true,
        color: theme.accent,
        valign: 'middle',
      });
    }

    // Slide footer
    slide.addText(cleanPlainMathText(deck.title), {
      x: 0.85,
      y: 6.94,
      w: 8.5,
      h: 0.3,
      fontFace,
      fontSize: 10,
      color: theme.muted,
    });
    slide.addText(
      `${String(idx + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`,
      {
        x: 10.5,
        y: 6.94,
        w: 1.98,
        h: 0.3,
        align: 'right',
        fontFace,
        fontSize: 10,
        color: theme.muted,
      }
    );
  });

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  triggerDownload(blob, sanitizeFilename(deck.title, 'pptx'));
}

/* ============================================================================
 * 4. PDF (.pdf) Exporter (High-DPI Korean + KaTeX DOM capture)
 * ========================================================================== */
export async function exportElementToPdf(
  element: HTMLElement,
  title: string
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 10;
  const printableWidthMm = pageWidthMm - marginMm * 2;
  const printableHeightMm = pageHeightMm - marginMm * 2;

  const pxPerMm = canvas.width / printableWidthMm;
  const pageSliceHeightPx = Math.floor(printableHeightMm * pxPerMm);

  let offsetY = 0;
  let pageIdx = 0;

  while (offsetY < canvas.height) {
    const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - offsetY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );
    }

    if (pageIdx > 0) {
      pdf.addPage();
    }

    const sliceHeightMm = sliceHeightPx / pxPerMm;
    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', marginMm, marginMm, printableWidthMm, sliceHeightMm);

    offsetY += sliceHeightPx;
    pageIdx += 1;
  }

  pdf.save(sanitizeFilename(title, 'pdf'));
}
