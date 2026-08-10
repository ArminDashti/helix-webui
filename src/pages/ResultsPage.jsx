import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";

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

function exportResultPdf({ prompt, chartInstance, textReport, showChart, showText }) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    window.alert("Allow pop-ups to export PDF.");
    return;
  }

  let chartImg = "";
  if (showChart && chartInstance) {
    try {
      chartImg = chartInstance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#1a1a1a",
      });
    } catch {
      chartImg = "";
    }
  }

  const safePrompt = String(prompt || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeReport = String(textReport || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  win.document.write(`<!DOCTYPE html><html><head><title>Helix export</title>
<style>
  body { font-family: system-ui, sans-serif; color: #e8e8e8; background: #121212; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .meta { color: #9a9a9a; font-size: 13px; margin-bottom: 20px; white-space: pre-wrap; }
  img { max-width: 100%; height: auto; border: 1px solid #2e2e2e; border-radius: 12px; }
  article { margin-top: 20px; padding: 16px; border: 1px solid #2e2e2e; border-radius: 12px;
    background: #1a1a1a; white-space: pre-wrap; line-height: 1.5; font-size: 14px; }
  @media print { body { background: #fff; color: #111; } .meta, article { color: inherit; }
    article { background: #f7f7f7; border-color: #ccc; } }
</style></head><body>
  <h1>Helix report</h1>
  <div class="meta">${safePrompt}</div>
  ${chartImg ? `<img src="${chartImg}" alt="Chart" />` : ""}
  ${showText ? `<article>${safeReport}</article>` : ""}
  <script>window.onload = function () { window.print(); };</script>
</body></html>`);
  win.document.close();
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { prompt, mode, result } = location.state || {};
  const chartRef = useRef(null);

  useEffect(() => {
    if (!result) {
      navigate("/", { replace: true });
    }
  }, [result, navigate]);

  const effectiveMode = result?.mode || mode;
  const showChart =
    Boolean(result) &&
    (effectiveMode === "chart" || effectiveMode === "both") &&
    Boolean(result.echarts_option);
  const showText =
    Boolean(result) &&
    (effectiveMode === "analysis" || effectiveMode === "both") &&
    Boolean(result.text_report);

  const chartOption = useMemo(
    () => (showChart ? withDarkChartColors(result.echarts_option) : null),
    [showChart, result],
  );

  if (!result) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Results</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted line-clamp-2">{prompt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showChart || showText ? (
            <button
              type="button"
              onClick={() =>
                exportResultPdf({
                  prompt,
                  chartInstance: chartRef.current?.getEchartsInstance?.(),
                  textReport: result.text_report,
                  showChart,
                  showText,
                })
              }
              className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              Export PDF
            </button>
          ) : null}
          <Link
            to="/"
            className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
          >
            New prompt
          </Link>
        </div>
      </div>

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
          <article className="rounded-2xl border border-line bg-paper/80 px-5 py-4 text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Report
            </h2>
            {result.text_report}
          </article>
        ) : null}
        {!showChart && !showText ? (
          <p className="rounded-xl border border-line bg-paper/80 px-4 py-3 text-sm text-muted">
            No chart or report was returned for this run.
          </p>
        ) : null}
      </section>
    </div>
  );
}
