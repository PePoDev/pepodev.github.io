// The resume as a PDF, built in the browser from the same data as the HTML
// page (Download PDF; see ResumeDownloadScript.tsx). Plain PDF 1.4 with the
// standard Helvetica fonts: text is measured with their AFM advance widths so
// centred and right-aligned text (the date column) lines up, links get URI
// annotations, the document gets /Info metadata, and a section heading never
// ends a page without its first block.
//
// createResumePdf is inlined into the page with Function#toString, so it
// must be self-contained: it may use only its parameter and browser globals,
// never imports or other module-level names (the server bundle is minified
// and may rename them).

export interface ResumePdfData {
  name: string;
  title: string;
  contact: { label: string; href?: string }[];
  summary: string;
  /** Degree, school, period. */
  education: [string, string, string];
  experiences: { role: string; company: string; period: string; details: string[] }[];
  /** "Kubernetes / Docker - 90%" */
  skills: string[];
  certifications: { text: string; href: string }[];
}

type PdfItem = string | { text: string; href?: string };

export function createResumePdf(data: ResumePdfData): string {
  // Advance widths (1/1000 em) of ASCII 32-126 in Helvetica and
  // Helvetica-Bold (Adobe AFM metrics, StandardEncoding).
  const HELVETICA_WIDTHS = [
    278, 278, 355, 556, 556, 889, 667, 222, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778,
    722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
    278, 278, 469, 556, 222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ];
  const HELVETICA_BOLD_WIDTHS = [
    278, 333, 474, 556, 556, 889, 722, 278, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778,
    722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
    278, 333, 584, 556, 278, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ];

  // Helvetica's StandardEncoding covers printable ASCII only.
  const normalizePdfText = (value: string) =>
    String(value)
      .replace(/™/g, "")
      .replace(/•/g, "-")
      .replace(/[–—]/g, "-")
      .replace(/[^\x20-\x7e]/g, "");

  const escapePdfText = (value: string) =>
    normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const formatNumber = (value: number) =>
    Number(value)
      .toFixed(2)
      .replace(/\.?0+$/, "");

  function getTextWidth(text: string, fontSize: number, bold = false) {
    const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
    let units = 0;
    for (const char of normalizePdfText(text)) units += widths[char.charCodeAt(0) - 32];
    return (units * fontSize) / 1000;
  }

  function wrapPdfLine(line: string, maxWidth = 503, fontSize = 10) {
    const normalized = normalizePdfText(line);
    if (getTextWidth(normalized, fontSize) <= maxWidth) return [normalized];
    const wrapped: string[] = [];
    let current = "";
    for (const word of normalized.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && getTextWidth(next, fontSize) > maxWidth) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) wrapped.push(current);
    return wrapped;
  }

  function splitIntoColumns<T>(items: T[], columns: number) {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
    return rows;
  }

  const width = 595;
  const height = 842;
  const marginX = 46;
  const bottomMargin = 46;
  const contentWidth = width - marginX * 2;
  type PdfLink = { rect: number[]; uri: string };
  const pages: { content: string; links: PdfLink[] }[] = [];
  let commands: string[] = [];
  let links: PdfLink[] = [];
  let y = 792;

  function addPage() {
    if (commands.length) pages.push({ content: commands.join("\n"), links });
    commands = [];
    links = [];
    y = 792;
  }

  // A clickable area over text drawn at baseline textY.
  function addLink(x: number, textY: number, linkWidth: number, size: number, uri: string) {
    links.push({ rect: [x, textY - size * 0.25, x + linkWidth, textY + size * 0.85], uri });
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight < bottomMargin) addPage();
  }

  function drawText(
    text: string,
    x: number,
    textY: number,
    options: { size?: number; bold?: boolean; color?: string; align?: "center" | "right" } = {},
  ) {
    const size = options.size || 10;
    const font = options.bold ? "F2" : "F1";
    const color = options.color || "0.16 0.17 0.2";
    let textX = x;
    if (options.align === "center") textX = x - getTextWidth(text, size, options.bold) / 2;
    else if (options.align === "right") textX = x - getTextWidth(text, size, options.bold);
    commands.push(
      "BT",
      `/${font} ${size} Tf`,
      `${color} rg`,
      `${formatNumber(textX)} ${formatNumber(textY)} Td`,
      `(${escapePdfText(text)}) Tj`,
      "ET",
    );
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number, shade = "0.86") {
    commands.push(
      `${shade} G`,
      "0.6 w",
      `${formatNumber(x1)} ${formatNumber(y1)} m`,
      `${formatNumber(x2)} ${formatNumber(y2)} l`,
      "S",
    );
  }

  function drawRect(x: number, rectY: number, rectWidth: number, rectHeight: number, fill = "0.96 0.97 0.98") {
    commands.push(
      `${fill} rg`,
      `${formatNumber(x)} ${formatNumber(rectY)} ${formatNumber(rectWidth)} ${formatNumber(rectHeight)} re`,
      "f",
    );
  }

  // keepWith is the height of the section's first block. The heading takes
  // 38pt, so this keeps it off the bottom of a page by itself.
  function drawSection(title: string, keepWith: number) {
    ensureSpace(38 + keepWith);
    y -= 8;
    drawRect(marginX, y - 14, contentWidth, 18);
    drawText(title.toUpperCase(), width / 2, y - 9, { size: 10, align: "center", color: "0.18 0.19 0.22" });
    y -= 30;
  }

  function paragraphHeight(text: string) {
    return wrapPdfLine(text, contentWidth, 10).length * 12 + 6;
  }

  function drawParagraph(text: string) {
    const lines = wrapPdfLine(text, contentWidth, 10);
    ensureSpace(paragraphHeight(text));
    for (const line of lines) {
      drawText(line, marginX, y, { size: 10 });
      y -= 12;
    }
    y -= 6;
  }

  // Bullet items are strings, or { text, href } for a linked item.
  function bulletHeight(item: PdfItem) {
    const text = typeof item === "string" ? item : item.text;
    return wrapPdfLine(text, contentWidth - 22, 9.3).length * 11 + 2;
  }

  function drawBulletList(items: PdfItem[], maxItems: number) {
    for (const item of items.slice(0, maxItems)) {
      const { text, href } = typeof item === "string" ? { text: item, href: undefined } : item;
      const lines = wrapPdfLine(text, contentWidth - 22, 9.3);
      ensureSpace(bulletHeight(item));
      drawText("-", marginX + 10, y, { size: 9.5 });
      lines.forEach((line, index) => {
        const lineY = y - index * 11;
        drawText(line, marginX + 24, lineY, { size: 9.3 });
        if (href) addLink(marginX + 24, lineY, getTextWidth(line, 9.3), 9.3, href);
      });
      y -= lines.length * 11 + 2;
    }
  }

  drawText(data.name, width / 2, y, { size: 24, align: "center", color: "0.1 0.11 0.14" });
  y -= 17;
  drawText(data.title.toUpperCase(), width / 2, y, { size: 11, align: "center", color: "0.23 0.24 0.28" });
  y -= 11;
  drawLine(marginX, y, width - marginX, y, "0.88");
  y -= 14;
  const contactSeparator = " - ";
  const contactLine = data.contact.map(({ label }) => label).join(contactSeparator);
  drawText(contactLine, width / 2, y, { size: 8.5, align: "center", color: "0.3 0.31 0.35" });
  let contactX = width / 2 - getTextWidth(contactLine, 8.5) / 2;
  for (const { label, href } of data.contact) {
    const labelWidth = getTextWidth(label, 8.5);
    if (href) addLink(contactX, y, labelWidth, 8.5, href);
    contactX += labelWidth + getTextWidth(contactSeparator, 8.5);
  }
  y -= 24;

  drawSection("Summary", paragraphHeight(data.summary));
  drawParagraph(data.summary);

  // Role, company, and the first bullets of an entry stay together.
  const entryHeight = 72;
  drawSection("Experience", entryHeight);
  data.experiences.forEach((experience, index) => {
    ensureSpace(entryHeight);
    drawText(experience.role, marginX, y, { size: 10.2, bold: true });
    drawText(experience.period, width - marginX, y, { size: 9.3, align: "right" });
    y -= 12;
    drawText(experience.company, marginX, y, { size: 9.4, color: "0.32 0.33 0.37" });
    y -= 14;
    drawBulletList(experience.details, index === 0 ? 5 : 4);
    y -= 5;
  });

  const skillRowHeight = 14;
  drawSection("Technical Skills", skillRowHeight);
  const skillRows = splitIntoColumns(
    data.skills.map((skill) => skill.replace(/\s-\s\d+%$/, "")),
    2,
  );
  for (const row of skillRows) {
    ensureSpace(skillRowHeight);
    row.forEach((skill, index) => {
      drawText(skill, marginX + index * (contentWidth / 2), y, { size: 9.5 });
    });
    y -= 13;
  }
  y -= 8;

  drawSection("Education", 42);
  drawText(data.education[0], marginX, y, { size: 10.2, bold: true });
  drawText(data.education[2], width - marginX, y, { size: 9.3, align: "right" });
  y -= 12;
  drawText(data.education[1], marginX, y, { size: 9.4, color: "0.32 0.33 0.37" });
  y -= 24;

  const [firstCertification] = data.certifications;
  drawSection("Certifications", firstCertification ? bulletHeight(firstCertification) : 0);
  drawBulletList(data.certifications, data.certifications.length);
  if (commands.length) pages.push({ content: commands.join("\n"), links });

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject(
    "<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /ViewerPreferences << /DisplayDocTitle true >> >>",
  );
  const pagesId = addObject("");
  const infoId = addObject(
    [
      "<<",
      `/Title (${escapePdfText(`${data.name} - Resume`)})`,
      `/Author (${escapePdfText(data.name)})`,
      `/Subject (${escapePdfText(data.title)})`,
      "/Creator (pepo.dev)",
      ">>",
    ].join(" "),
  );
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  for (const { content, links: pageLinks } of pages) {
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const annotIds = pageLinks.map(({ rect, uri }) =>
      addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${rect.map(formatNumber).join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfText(uri)}) >> >>`,
      ),
    );
    pageIds.push(
      addObject(
        [
          "<< /Type /Page",
          "/Parent 2 0 R",
          `/MediaBox [0 0 ${width} ${height}]`,
          `/Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
          `/Contents ${contentId} 0 R`,
          annotIds.length ? `/Annots [${annotIds.map((id) => `${id} 0 R`).join(" ")}]` : "",
          ">>",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  return pdf;
}
