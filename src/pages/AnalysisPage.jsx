import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { streamRun } from "../api/client.js";
import RunProgressModal from "../components/RunProgressModal.jsx";

const MODES = [
  { value: "analysis", label: "Analysis" },
  { value: "chart", label: "Chart" },
  { value: "both", label: "Both" },
];

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(
    "Show sales by region for the last quarter",
  );
  const [mode, setMode] = useState("both");
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [runError, setRunError] = useState(null);
  const [activePrompt, setActivePrompt] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
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

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const final = await streamRun(
        { prompt: trimmed, mode },
        (evt) => {
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
        },
        controller.signal,
      );
      setModalOpen(false);
      setRunning(false);
      navigate("/results", {
        state: { prompt: trimmed, mode, result: final },
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
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink outline-none ring-moss/30 transition focus:border-moss focus:ring-2"
          placeholder="e.g. Cluster clients by revenue and usage"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-52">
            <label
              htmlFor="mode"
              className="block text-sm font-medium text-ink"
            >
              Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none ring-moss/30 focus:border-moss focus:ring-2"
            >
              {MODES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={running}
              className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-deep disabled:opacity-60"
            >
              Run
            </button>
          </div>
        </div>
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
      />
    </div>
  );
}
