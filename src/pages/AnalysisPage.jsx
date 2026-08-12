import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAgents, streamRun } from "../api/client.js";
import RunProgressModal from "../components/RunProgressModal.jsx";
import {
  parseColumns,
  textDirection,
  textLang,
} from "../utils/textDirection.js";

const MODES = [
  { value: "auto", label: "Auto" },
  { value: "chart", label: "Chart" },
  { value: "analytical_report", label: "Analytical report" },
  { value: "grid", label: "Grid" },
  { value: "analytical_report_chart", label: "Analytical report + Chart" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fa", label: "Persian" },
];

const REPORT_TYPES = [
  { value: "deep", label: "Deep" },
  { value: "summary", label: "Summary" },
  { value: "simple", label: "Simple" },
];

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
  { value: "scatter", label: "Scatter" },
  { value: "stacked_bar", label: "Stacked bar" },
  { value: "horizontal_bar", label: "Horizontal bar" },
];

const selectClass =
  "mt-1.5 w-full min-w-[8.5rem] rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none ring-moss/30 focus:border-moss focus:ring-2";

function needsType(mode) {
  return mode === "analytical_report" || mode === "analytical_report_chart";
}

function needsChart(mode) {
  return mode === "chart" || mode === "analytical_report_chart";
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(
    "Show total sales by product category",
  );
  const [mode, setMode] = useState("auto");
  const [language, setLanguage] = useState("en");
  const [reportType, setReportType] = useState("summary");
  const [chartType, setChartType] = useState("bar");
  const [columnsRaw, setColumnsRaw] = useState(
    "Category/Product/OrderQty/LineTotal",
  );
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [runError, setRunError] = useState(null);
  const [activePrompt, setActivePrompt] = useState("");
  const [nameById, setNameById] = useState({});
  const abortRef = useRef(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const agents = await fetchAgents();
        if (cancelled) return;
        const map = {};
        for (const a of agents || []) {
          if (a?.id) map[a.id] = a.name || a.id;
        }
        setNameById(map);
      } catch {
        /* keep empty map */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRun(event) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Enter a prompt first.");
      return;
    }
    setError(null);
    setRunError(null);
    setMessages([]);
    setActivePrompt(trimmed);
    setModalOpen(true);
    setRunning(true);

    const columns = mode === "grid" ? parseColumns(columnsRaw) : undefined;
    const payload = {
      prompt: trimmed,
      mode,
      language,
      report_type: needsType(mode) ? reportType : undefined,
      chart_type: needsChart(mode) ? chartType : undefined,
      columns,
    };

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const final = await streamRun(payload, (evt) => {
        if (evt.event === "step" && evt.message) {
          setMessages((prev) => [
            ...prev,
            {
              agent_id: evt.agent_id,
              status: evt.status,
              message: evt.message,
            },
          ]);
        }
      }, controller.signal);
      setModalOpen(false);
      setRunning(false);
      navigate("/results", {
        state: {
          prompt: trimmed,
          mode,
          language,
          reportType: payload.report_type,
          chartType: payload.chart_type,
          columns,
          result: final,
        },
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setRunning(false);
      setRunError(err instanceof Error ? err.message : "Run failed");
    }
  }

  function dismissModal() {
    if (running) {
      abortRef.current?.abort();
      setRunning(false);
    }
    setModalOpen(false);
    setRunError(null);
  }

  const promptDir = textDirection(prompt);
  const columnsDir = textDirection(columnsRaw);

  return (
    <div className="flex h-full min-h-0 max-w-6xl flex-col">
      <form
        onSubmit={handleRun}
        className="rounded-2xl border border-line/80 bg-paper/80 p-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-5"
      >
        <label htmlFor="prompt" className="block text-sm font-medium text-ink">
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={4}
          value={prompt}
          dir={promptDir}
          lang={textLang(prompt)}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-moss/30 transition focus:border-moss focus:ring-2"
          placeholder="e.g. Cluster clients by revenue and usage"
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="mode" className="block text-sm font-medium text-ink">
              Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className={selectClass}
            >
              {MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {needsType(mode) ? (
            <div className="min-w-[8.5rem] flex-1">
              <label
                htmlFor="report_type"
                className="block text-sm font-medium text-ink"
              >
                Type
              </label>
              <select
                id="report_type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className={selectClass}
              >
                {REPORT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needsChart(mode) ? (
            <div className="min-w-[9rem] flex-1">
              <label
                htmlFor="chart_type"
                className="block text-sm font-medium text-ink"
              >
                Chart
              </label>
              <select
                id="chart_type"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className={selectClass}
              >
                {CHART_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="min-w-[8.5rem] flex-1">
            <label
              htmlFor="language"
              className="block text-sm font-medium text-ink"
            >
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={selectClass}
            >
              {LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={running}
            className="shrink-0 rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-deep disabled:opacity-60"
          >
            Run
          </button>
        </div>

        {mode === "grid" ? (
          <div className="mt-3">
            <label
              htmlFor="grid_columns"
              className="block text-sm font-medium text-ink"
            >
              Columns
            </label>
            <input
              id="grid_columns"
              type="text"
              value={columnsRaw}
              dir={columnsDir}
              lang={textLang(columnsRaw)}
              onChange={(e) => setColumnsRaw(e.target.value)}
              placeholder="Category/Product/OrderQty/LineTotal or Category, Product, Qty"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-[15px] text-ink outline-none ring-moss/30 focus:border-moss focus:ring-2"
            />
            <p className="mt-1 text-xs text-muted">
              Separate columns with / or ,
            </p>
          </div>
        ) : null}
      </form>

      {error ? (
        <p
          className="mt-3 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn"
          role="status"
        >
          {error}
        </p>
      ) : null}

      <RunProgressModal
        open={modalOpen}
        prompt={activePrompt}
        messages={messages}
        running={running}
        error={runError}
        onDismiss={dismissModal}
        nameById={nameById}
      />
    </div>
  );
}
