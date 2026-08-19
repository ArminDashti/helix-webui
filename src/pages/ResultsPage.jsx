import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  ArrowLeft,
  Eye,
  FileDown,
  History,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteResult,
  fetchResult,
  fetchResults,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";
import { hasPersianScript } from "../utils/textDirection.js";
import { assetUrl } from "../utils/assetUrl.js";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const DARK_CHART_DEFAULTS = {
  backgroundColor: "transparent",
  textStyle: { color: "#e8e8e8" },
};

function withDarkChartColors(option) {
  if (!option || typeof option !== "object") return option;
  return {
    ...DARK_CHART_DEFAULTS,
    ...option,
    color: option.color || ["#3d9b82", "#5cb89a", "#7ab89f"],
    backgroundColor: option.backgroundColor ?? "transparent",
    title: option.title
      ? {
          ...option.title,
          textStyle: {
            color: "#e8e8e8",
            fontWeight: 600,
            ...(option.title.textStyle || {}),
          },
        }
      : option.title,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolveDir(language, text) {
  if (language === "fa") return "rtl";
  if (language === "en") return "ltr";
  return hasPersianScript(text) ? "rtl" : "ltr";
}

async function loadLogoDataUrl(url) {
  if (!url) return "";
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

async function exportResultPdf({
  prompt,
  chartInstance,
  textReport,
  grid,
  showChart,
  showText,
  showGrid,
  language,
  labels,
  logoUrl,
  locale,
}) {
  let chartImg = "";
  if (showChart && chartInstance) {
    try {
      chartImg = chartInstance.getDataURL({
        type: "png",
        pixelRatio: 2,
        // Light branded background for readable charts on paper.
        backgroundColor: "#fafcfb",
      });
    } catch {
      chartImg = "";
    }
  }

  const dir = resolveDir(language, textReport || prompt);
  const lang = dir === "rtl" ? "fa" : "en";
  const safePrompt = escapeHtml(prompt);
  const safeReport = escapeHtml(textReport);
  const exportedAt = formatDateTime(new Date(), locale || "en");

  const logoDataUrl = await loadLogoDataUrl(logoUrl);
  const safeLogoUrl = escapeHtml(logoDataUrl);

  // Ensure Vazirmatn is loaded so html2canvas captures correct glyphs.
  try {
    const id = "helix-pdf-vazirmatn";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600&display=swap";
      document.head.appendChild(link);
    }
    await (document.fonts?.ready || Promise.resolve());
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    // Font load is best-effort; export still works with fallback fonts.
  }

  const element = document.createElement("div");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  element.style.top = "0";
  element.style.width = "794px"; // ~A4 width at 96dpi
  element.style.background = "#ffffff";
  element.setAttribute("dir", dir);
  element.setAttribute("lang", lang);
  document.body.appendChild(element);

  const S = {
    root: `font-family:Vazirmatn,system-ui,sans-serif;color:#111;background:#fff;padding:16px;box-sizing:border-box;`,
    header: `display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 14px 0;padding:12px 14px;border-radius:14px;background:#3d9b82;color:#fff;`,
    logo: `height:44px;width:auto;object-fit:contain;`,
    title: `direction:ltr;text-align:center;font-size:22px;font-weight:600;margin:0;color:#fff;`,
    meta: `margin:0 0 14px 0;padding:12px 14px;border-radius:14px;background:#eef7f4;color:#0f3b2f;font-size:13px;font-weight:600;white-space:pre-wrap;line-height:1.4;`,
    chartWrap: `margin-bottom:14px;`,
    chart: `max-width:100%;height:auto;border:1px solid #3d9b82;border-radius:14px;display:block;`,
    article: `margin-bottom:14px;padding:14px 16px;border:2px solid #3d9b82;border-radius:14px;background:#f6fbf9;white-space:pre-wrap;line-height:1.6;font-size:14px;`,
    table: `width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;`,
    th: `border:1px solid #cfe6dd;padding:8px 10px;text-align:start;background:#3d9b82;color:#fff;font-weight:600;`,
    td: `border:1px solid #cfe6dd;padding:8px 10px;text-align:start;`,
    tdEven: `border:1px solid #cfe6dd;padding:8px 10px;text-align:start;background:#eef7f4;`,
  };

  const logoImgInline = safeLogoUrl
    ? `<img style="${S.logo}" src="${safeLogoUrl}" alt="${escapeHtml(labels.pdfLogoAlt)}" />`
    : "";
  const chartImgInline = chartImg
    ? `<div style="${S.chartWrap}"><img style="${S.chart}" src="${chartImg}" alt="${escapeHtml(labels.pdfChartAlt)}" /></div>`
    : "";
  const articleInline = showText
    ? `<div style="${S.article}" dir="${dir}">${safeReport}</div>`
    : "";

  let gridInline = "";
  if (showGrid && grid?.columns?.length) {
    const cols = grid.columns;
    const rows = grid.rows || [];
    const headerCells = cols.map((c) => `<th style="${S.th}">${escapeHtml(c)}</th>`).join("");
    const bodyRows = rows
      .map(
        (row, i) =>
          `<tr>${cols
            .map((c) => `<td style="${i % 2 === 1 ? S.tdEven : S.td}">${escapeHtml(row?.[c])}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    gridInline = `<table style="${S.table}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  element.innerHTML = `
    <div style="${S.root}">
      <div style="${S.header}">
        ${logoImgInline}
        <h1 style="${S.title}">${escapeHtml(labels.pdfHeading)}</h1>
      </div>
      <div style="${S.meta}">${safePrompt}</div>
      ${chartImgInline}
      ${articleInline}
      ${gridInline}
    </div>
  `;

  try {
    // Give browser one frame to paint the element before capturing.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    // A4 dimensions in mm
    const A4_W = 210;
    const A4_H = 297;
    const MARGIN = 12; // mm on all sides
    const FOOTER_H = 10; // mm reserved for footer bar

    const contentW = A4_W - MARGIN * 2;
    const contentH = A4_H - MARGIN - FOOTER_H - MARGIN; // top + bottom + footer

    const imgW = canvas.width;
    const imgH = canvas.height;

    // Scale factor: fit canvas width to content width
    const mmPerPx = contentW / (imgW / 2); // /2 because scale:2
    const totalImgH_mm = (imgH / 2) * mmPerPx;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    let yRemaining = totalImgH_mm;
    let srcY = 0; // in canvas px
    let pageNum = 0;

    // Pre-calculate total pages
    const totalPages = Math.ceil(totalImgH_mm / contentH);

    while (yRemaining > 0) {
      if (pageNum > 0) pdf.addPage();
      pageNum++;

      const sliceH_mm = Math.min(yRemaining, contentH);
      const sliceH_px = Math.round((sliceH_mm / mmPerPx) * 2); // back to canvas px

      // Slice the canvas into a temporary canvas for this page
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceH_px;
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, srcY, imgW, sliceH_px, 0, 0, imgW, sliceH_px);

      const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(sliceDataUrl, "JPEG", MARGIN, MARGIN, contentW, sliceH_mm);

      // Draw footer bar
      const barY = A4_H - FOOTER_H;
      const textY = barY + 6.5;
      pdf.setFillColor(61, 155, 130);
      pdf.rect(0, barY, A4_W, FOOTER_H, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.text(exportedAt, MARGIN, textY, { align: "left" });
      pdf.text(labels.pdfFooter, A4_W / 2, textY, { align: "center" });
      pdf.text(`${pageNum}/${totalPages}`, A4_W - MARGIN, textY, { align: "right" });

      srcY += sliceH_px;
      yRemaining -= sliceH_mm;
    }

    const blobUrl = pdf.output("bloburl");
    window.open(blobUrl, "_blank");
  } catch (err) {
    console.error("PDF export failed:", err);
    window.alert(labels.pdfAlert);
  } finally {
    element.remove();
  }
}

function normalizeMode(mode) {
  if (mode === "analysis" || mode === "research") return "analytical_report";
  if (mode === "both") return "analytical_report_chart";
  return mode || "auto";
}

function ResultsList() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pdfLabels = useMemo(
    () => ({
      pdfAlert: t("results.pdfAlert"),
      pdfTitle: t("results.pdfTitle"),
      pdfHeading: t("results.pdfHeading"),
      pdfChartAlt: t("results.pdfChartAlt"),
      pdfLogoAlt: t("results.pdfLogoAlt"),
      pdfFooter: t("results.pdfFooter"),
    }),
    [t],
  );

  async function load() {
    const data = await fetchResults();
    setItems(data);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(failMessage(err, t, "results.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function handleExport(item) {
    setError(null);
    try {
      const record = await fetchResult(item.id);
      const result = record?.payload;
      if (!result) {
        setError(t("results.noPayload"));
        return;
      }
      const showChart = Boolean(result.echarts_option);
      const showText = Boolean(result.text_report);
      const showGrid = Boolean(result.grid?.columns?.length);
      await exportResultPdf({
        prompt: record.prompt || "",
        chartInstance: null,
        textReport: result.text_report || "",
        grid: result.grid,
        showChart,
        showText,
        showGrid,
        language: result.language || record.language || "en",
        labels: pdfLabels,
        logoUrl: assetUrl("helix-logo.png"),
        locale,
      });
    } catch (err) {
      setError(failMessage(err, t, "results.exportFailed"));
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(t("results.deleteConfirm"))) return;
    setError(null);
    try {
      await deleteResult(item.id);
      await load();
    } catch (err) {
      setError(failMessage(err, t, "results.deleteFailed"));
    }
  }

  const rows = useMemo(
    () => items.map((item) => ({ key: item.id, item })),
    [items],
  );

  const columns = useMemo(
    () => [
      {
        key: "title",
        label: t("results.colTitle"),
        render: (item) => item.prompt || t("results.noPrompt"),
      },
      {
        key: "mode",
        label: t("results.colMode"),
        render: (item) => item.mode || t("common.noneDash"),
      },
      {
        key: "datetime",
        label: t("results.colDatetime"),
        render: (item) => (
          <span className="whitespace-nowrap font-sans text-[13px]">
            {formatDateTime(item.created_at, locale)}
          </span>
        ),
      },
      {
        key: "show",
        label: t("results.colShow"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Eye}
            onClick={() => navigate(`/results/${item.id}`)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("results.show")}
          </IconButton>
        ),
      },
      {
        key: "export",
        label: t("results.colExport"),
        render: (item) => (
          <IconButton
            type="button"
            icon={FileDown}
            onClick={() => handleExport(item)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("results.export")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("results.colDelete"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(item)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("results.delete")}
          </IconButton>
        ),
      },
    ],
    [t, locale, navigate],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("results.loadingList")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Play} title={t("results.title")}>
        <p className="mt-0.5 text-sm text-muted">{t("results.subtitle")}</p>
      </PageHeader>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <DataGrid columns={columns} rows={rows} emptyLabel={t("results.empty")} />
    </div>
  );
}

function ResultDetail({ resultId }) {
  const chartRef = useRef(null);
  const { t, locale } = useI18n();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedReport, setEditedReport] = useState("");

  const pdfLabels = useMemo(
    () => ({
      pdfAlert: t("results.pdfAlert"),
      pdfTitle: t("results.pdfTitle"),
      pdfHeading: t("results.pdfHeading"),
      pdfChartAlt: t("results.pdfChartAlt"),
      pdfLogoAlt: t("results.pdfLogoAlt"),
      pdfFooter: t("results.pdfFooter"),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchResult(resultId);
        if (cancelled) return;
        setRecord(data);
        setEditedPrompt(data.prompt || "");
        setEditedReport(data.payload?.text_report || "");
        setEditing(false);
      } catch (err) {
        if (!cancelled) {
          setRecord(null);
          setError(failMessage(err, t, "results.loadOneFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultId, t]);

  const result = record?.payload;
  const mode = record?.mode;
  const language = result?.language || record?.language || "en";

  const effectiveMode = normalizeMode(result?.mode || mode);
  const showChart =
    Boolean(result) &&
    (effectiveMode === "chart" ||
      effectiveMode === "analytical_report_chart" ||
      effectiveMode === "auto") &&
    Boolean(result.echarts_option);
  const showText =
    Boolean(result) &&
    (effectiveMode === "analytical_report" ||
      effectiveMode === "analytical_report_chart" ||
      effectiveMode === "auto") &&
    Boolean(result.text_report || editedReport);
  const showGrid =
    Boolean(result) &&
    effectiveMode === "grid" &&
    Boolean(result.grid?.columns?.length);

  const chartOption = useMemo(
    () => (showChart ? withDarkChartColors(result.echarts_option) : null),
    [showChart, result],
  );

  const reportDir = resolveDir(language, editedReport || result?.text_report);
  const reportLang = reportDir === "rtl" ? "fa" : "en";

  if (loading) {
    return <p className="text-sm text-muted">{t("results.loadingDetail")}</p>;
  }

  if (error || !record || !result) {
    return (
      <div className="space-y-3">
        <PageHeader icon={Play} title={t("results.title")} backTo="/results" />
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error || t("results.notFound")}
        </p>
        <Link
          to="/results"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          <ArrowLeft
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
          {t("results.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader
        icon={Play}
        title={t("results.title")}
        backTo="/results"
        actions={
          <>
          {showText ? (
            <IconButton
              type="button"
              icon={Pencil}
              onClick={() => setEditing((v) => !v)}
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              {editing ? t("results.done") : t("results.edit")}
            </IconButton>
          ) : null}
          {showChart || showText || showGrid ? (
            <IconButton
              type="button"
              icon={FileDown}
              onClick={async () => {
                await exportResultPdf({
                  prompt: editedPrompt,
                  chartInstance: chartRef.current?.getEchartsInstance?.(),
                  textReport: editedReport,
                  grid: result.grid,
                  showChart,
                  showText,
                  showGrid,
                  language,
                  labels: pdfLabels,
                  logoUrl: assetUrl("helix-logo.png"),
                  locale,
                });
              }}
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              {t("results.exportPdf")}
            </IconButton>
          ) : null}
          <Link
            to="/results"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
          >
            <History className="size-4 shrink-0" aria-hidden="true" />
            {t("results.history")}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {t("results.newPrompt")}
          </Link>
          </>
        }
      >
          {editing ? (
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={2}
              className="mt-1 w-full max-w-2xl resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
            />
          ) : (
            <p className="mt-0.5 max-w-2xl text-sm text-muted line-clamp-2">
              {editedPrompt}
            </p>
          )}
      </PageHeader>

      <section className="space-y-3" aria-live="polite">
        {showChart ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-paper/80 p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("results.sectionChart")}
            </h2>
            <div dir="ltr">
              <ReactECharts
                ref={chartRef}
                option={chartOption}
                style={{ height: 360, width: "100%" }}
                notMerge
                lazyUpdate
              />
            </div>
          </div>
        ) : null}

        {showText ? (
          <article
            className="rounded-2xl border border-line bg-paper/80 px-5 py-4 text-[15px] leading-relaxed text-ink"
            dir={reportDir}
            lang={reportLang}
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("results.sectionReport")}
            </h2>
            {editing ? (
              <textarea
                value={editedReport}
                onChange={(e) => setEditedReport(e.target.value)}
                rows={10}
                dir={reportDir}
                lang={reportLang}
                className="w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              />
            ) : (
              <div className="whitespace-pre-wrap">{editedReport}</div>
            )}
          </article>
        ) : null}

        {showGrid ? (
          <div
            className="overflow-x-auto rounded-2xl border border-line bg-paper/80 p-3 sm:p-4"
            dir={language === "fa" ? "rtl" : "ltr"}
            lang={language === "fa" ? "fa" : "en"}
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {t("results.sectionGrid")}
            </h2>
            <table className="w-full min-w-[20rem] border-collapse font-sans text-sm">
              <thead>
                <tr>
                  {result.grid.columns.map((col) => (
                    <th
                      key={col}
                      className="border border-line bg-fog/50 px-3 py-2 text-start font-semibold text-ink"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.grid.rows || []).map((row, idx) => (
                  <tr key={idx}>
                    {result.grid.columns.map((col) => (
                      <td
                        key={col}
                        className="border border-line px-3 py-1.5 text-ink"
                      >
                        {row?.[col] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!showChart && !showText && !showGrid ? (
          <p className="rounded-xl border border-line bg-paper/80 px-4 py-3 text-sm text-muted">
            {t("results.emptyPayload")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default function ResultsPage() {
  const { resultId } = useParams();
  if (resultId) return <ResultDetail resultId={resultId} />;
  return <ResultsList />;
}
