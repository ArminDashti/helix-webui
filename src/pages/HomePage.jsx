import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDemoResult } from "../api/client.js";

const MODES = [
  { value: "analysis", label: "Analysis" },
  { value: "chart", label: "Chart" },
  { value: "both", label: "Both" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(
    "Show sales by region for the last quarter",
  );
  const [mode, setMode] = useState("both");
  const [error, setError] = useState(null);

  function handleRun(event) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Enter a prompt first.");
      return;
    }
    setError(null);
    navigate("/run", { state: { prompt: trimmed, mode } });
  }

  function handleDemoOnly() {
    setError(null);
    navigate("/run", {
      state: {
        prompt: prompt.trim() || "Demo preview",
        mode,
        demoOnly: true,
        demoResult: getDemoResult(mode),
      },
    });
  }

  return (
    <div className="max-w-6xl">
      <form
        onSubmit={handleRun}
        className="rounded-2xl border border-line/80 bg-paper/80 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6"
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
              type="button"
              onClick={handleDemoOnly}
              className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-fog"
            >
              Preview demo
            </button>
            <button
              type="submit"
              className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-deep"
            >
              Run
            </button>
          </div>
        </div>
      </form>

      {error ? (
        <p
          className="mt-4 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
