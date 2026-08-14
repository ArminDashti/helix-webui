import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FileDown,
  History,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import {
  fetchResult,
  fetchResults,
  setResultArchived,
} from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { hasPersianScript } from "../utils/textDirection.js";

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

function exportResultPdf({
  prompt,
  chartInstance,
  textReport,
  grid,
  showChart,
  showText,
  showGrid,
  language,
}) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden",
  );
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    window.alert("Could not open print view for PDF export.");
    return;
  }

  let chartImg = "";
  if (showChart && chartInstance) {
    try {
      chartImg = chartInstance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    } catch {
      chartImg = "";
    }
  }

  const dir = resolveDir(language, textReport || prompt);
  const lang = dir === "rtl" ? "fa" : "en";
  const safePrompt = escapeHtml(prompt);
  const safeReport = escapeHtml(textReport);

  let gridHtml = "";
  if (showGrid && grid?.columns?.length) {
    const cols = grid.columns;
    const rows = grid.rows || [];
    gridHtml = `<table><thead><tr>${cols
      .map((c) => `<th>${escapeHtml(c)}</th>`)
      .join("")}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr>${cols
            .map((c) => `<td>${escapeHtml(row?.[c])}</td>`)
            .join("")}</tr>`,
      )
      .join("")}</tbody></table>`;
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><title>Helix export</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600&display=swap" rel="stylesheet" />
<style>
  body { font-family: Vazirmatn, system-ui, sans-serif; color: #111; background: #fff; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 20px; white-space: pre-wrap; }
  img { max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 12px; }
  article { margin-top: 20px; padding: 16px; border: 1px solid #ccc; border-radius: 12px;
    background: #f7f7f7; white-space: pre-wrap; line-height: 1.5; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: start; }
  th { background: #f0f0f0; }
  @media print { body { margin: 12px; } }
</style></head><body>
  <h1>Helix report</h1>
  <div class="meta">${safePrompt}</div>
  ${chartImg ? `<img src="${chartImg}" alt="Chart" />` : ""}
  ${showText ? `<article dir="${dir}">${safeReport}</article>` : ""}
  ${gridHtml}
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 50);
    };
  </script>
</body></html>`);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };
  win.addEventListener("afterprint", cleanup);
  setTimeout(cleanup, 60_000);
}

function normalizeMode(mode) {
  if (mode === "analysis") return "analytical_report";
  if (mode === "both") return "analytical_report_chart";
  return mode || "auto";
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function ResultRow({ item, onArchive, archiveLabel }) {
  return (
    <li>
      <div className="flex items-stretch gap-2">
        <Link
          to={`/results/${item.id}`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-fog/40 px-3 py-2 text-left hover:bg-fog"
        >
          <span className="block truncate text-sm font-medium text-ink">
            {item.prompt || "(no prompt)"}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {formatWhen(item.created_at)}
            {item.mode ? ` · ${item.mode}` : ""}
          </span>
        </Link>
        <IconButton
          type="button"
          icon={archiveLabel === "Restore" ? ArchiveRestore : Archive}
          onClick={() => onArchive(item)}
          className="shrink-0 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-medium text-ink hover:bg-fog"
        >
          {archiveLabel}
        </IconButton>
      </div>
    </li>
  );
}

function ResultsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    const data = await fetchResults();
    setItems(data);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggleArchive(item, archived) {
    setError(null);
    try {
      await setResultArchived(item.id, archived);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update result");
    }
  }

  const history = items.filter((item) => !item.archived);
  const archive = items.filter((item) => item.archived);

  if (loading) {
    return <p className="text-sm text-muted">Loading results…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader icon={Play} title="Results">
        <p className="mt-0.5 text-sm text-muted">
          History of analysis runs and archived reports.
        </p>
      </PageHeader>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <section className="space-y-2 rounded-2xl border border-line/80 bg-paper/80 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No results yet. Run an analysis to add one.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <ResultRow
                key={item.id}
                item={item}
                archiveLabel="Archive"
                onArchive={(row) => toggleArchive(row, true)}
              />
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2 rounded-2xl border border-line/80 bg-paper/80 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Archive
        </h2>
        {archive.length === 0 ? (
          <p className="text-sm text-muted">No archived results.</p>
        ) : (
          <ul className="space-y-2">
            {archive.map((item) => (
              <ResultRow
                key={item.id}
                item={item}
                archiveLabel="Restore"
                onArchive={(row) => toggleArchive(row, false)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultDetail({ resultId }) {
  const chartRef = useRef(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedReport, setEditedReport] = useState("");

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
          setError(err instanceof Error ? err.message : "Failed to load result");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultId]);

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
    return <p className="text-sm text-muted">Loading result…</p>;
  }

  if (error || !record || !result) {
    return (
      <div className="space-y-3">
        <PageHeader icon={Play} title="Results" backTo="/results" />
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error || "Result not found."}
        </p>
        <Link
          to="/results"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          Back to results
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader
        icon={Play}
        title="Results"
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
              {editing ? "Done" : "Edit"}
            </IconButton>
          ) : null}
          {showChart || showText || showGrid ? (
            <IconButton
              type="button"
              icon={FileDown}
              onClick={() =>
                exportResultPdf({
                  prompt: editedPrompt,
                  chartInstance: chartRef.current?.getEchartsInstance?.(),
                  textReport: editedReport,
                  grid: result.grid,
                  showChart,
                  showText,
                  showGrid,
                  language,
                })
              }
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              Export PDF
            </IconButton>
          ) : null}
          <Link
            to="/results"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
          >
            <History className="size-4 shrink-0" aria-hidden="true" />
            History
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            New prompt
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
              Chart
            </h2>
            <ReactECharts
              ref={chartRef}
              option={chartOption}
              style={{ height: 360, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>
        ) : null}

        {showText ? (
          <article
            className="rounded-2xl border border-line bg-paper/80 px-5 py-4 text-[15px] leading-relaxed text-ink"
            dir={reportDir}
            lang={reportLang}
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Report
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
              Grid
            </h2>
            <table className="w-full min-w-[20rem] border-collapse text-sm">
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
            No chart, report, or grid was returned for this run.
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
