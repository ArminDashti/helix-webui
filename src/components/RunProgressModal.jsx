import { useEffect, useRef } from "react";

const AGENT_NAMES = {
  task_validator: "Task Validator",
  solution_strategist: "Solution Strategist",
  technical_architect: "Technical Architect",
  code_builder: "Code Builder",
  sql_guardian: "SQL Guardian",
  implementation_auditor: "Implementation Auditor",
  response_publisher: "Response Publisher",
  user: "Prompt",
  system: "System",
};

function agentLabel(agentId) {
  return AGENT_NAMES[agentId] || agentId || "Agent";
}

/**
 * Full-screen progress modal for a live pipeline run (English log only).
 */
export default function RunProgressModal({
  open,
  prompt,
  messages,
  running,
  error,
  onDismiss,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-progress-title"
    >
      <div className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]">
        <header className="shrink-0 border-b border-line/80 px-4 py-3">
          <h2 id="run-progress-title" className="font-display text-lg text-ink">
            Running analysis
          </h2>
          {prompt ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted">{prompt}</p>
          ) : null}
        </header>

        <ul
          ref={listRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm"
        >
          {messages.length === 0 && running ? (
            <li className="text-muted">Connecting to pipeline…</li>
          ) : null}
          {messages.map((m, i) => (
            <li
              key={`${m.agent_id}-${i}`}
              className="rounded-lg border border-line/60 bg-fog/60 px-3 py-2 animate-[fadeIn_0.4s_ease]"
            >
              <span className="font-medium text-moss">
                {agentLabel(m.agent_id)}
              </span>
              <p className="mt-0.5 text-ink/90">{m.message}</p>
            </li>
          ))}
        </ul>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line/80 px-4 py-3">
          {running ? (
            <p className="text-xs font-medium text-moss animate-pulse">
              Agents working…
            </p>
          ) : error ? (
            <p className="text-sm text-warn" role="status">
              {error}
            </p>
          ) : (
            <span />
          )}
          {!running ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium text-ink hover:bg-fog/80"
            >
              Close
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
