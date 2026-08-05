import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { streamRun } from "../api/client.js";

const PIPELINE = [
  { id: "task_validator", name: "Task Validator" },
  { id: "solution_strategist", name: "Solution Strategist" },
  { id: "technical_architect", name: "Technical Architect" },
  { id: "code_builder", name: "Code Builder" },
  { id: "sql_guardian", name: "SQL Guardian" },
  { id: "implementation_auditor", name: "Implementation Auditor" },
  { id: "response_publisher", name: "Response Publisher" },
];

const NODE_W = 160;
const NODE_H = 56;

function statusClass(status) {
  if (status === "running") return "border-moss bg-moss/20 shadow-md shadow-moss/20 scale-105";
  if (status === "done") return "border-moss bg-paper";
  if (status === "retry") return "border-warn bg-warn-bg";
  if (status === "visible") return "border-line/60 bg-paper/50 opacity-70";
  return "border-line/40 bg-fog/40 opacity-40";
}

export default function RunPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { prompt, mode, demoOnly, demoResult } = location.state || {};

  const [nodeStatus, setNodeStatus] = useState({ user: "done" });
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState("user");
  const [loopEdges, setLoopEdges] = useState([]);
  const [result, setResult] = useState(null);
  const [usedDemo, setUsedDemo] = useState(false);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!prompt || !mode) {
      navigate("/", { replace: true });
      return;
    }

    if (demoOnly && demoResult) {
      setResult(demoResult);
      setUsedDemo(true);
      setNodeStatus((prev) => {
        const next = { ...prev, user: "done" };
        for (const a of PIPELINE) next[a.id] = "done";
        return next;
      });
      setMessages([{ agent_id: "system", message: "Local demo preview (no stream)." }]);
      return;
    }

    const controller = new AbortController();
    setRunning(true);
    setMessages([]);
    setLoopEdges([]);
    setNodeStatus({ user: "done" });
    setResult(null);
    setError(null);

    (async () => {
      try {
        const final = await streamRun(
          { prompt, mode },
          (evt) => {
            if (evt.event === "step") {
              const { agent_id, status, message, retry_to } = evt;
              setActiveId(agent_id);
              setNodeStatus((prev) => ({
                ...prev,
                [agent_id]: status === "retry" ? "retry" : status,
              }));
              if (message) {
                setMessages((prev) => [
                  ...prev,
                  { agent_id, status, message },
                ]);
              }
              if (status === "retry" && retry_to) {
                setLoopEdges((prev) => [
                  ...prev,
                  {
                    from: agent_id,
                    to: retry_to,
                    key: `${agent_id}-${retry_to}-${prev.length}`,
                  },
                ]);
              }
            }
          },
          controller.signal,
        );
        setResult(final);
        setUsedDemo(Boolean(final.used_demo));
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Run failed");
      } finally {
        setRunning(false);
      }
    })();

    return () => controller.abort();
  }, [prompt, mode, demoOnly, demoResult, navigate]);

  const layout = useMemo(
    () => [
      { id: "user", name: "Your prompt", x: 220, y: 24 },
      ...PIPELINE.map((a, i) => ({
        id: a.id,
        name: a.name,
        x: 220,
        y: 110 + i * 88,
      })),
    ],
    [],
  );

  const edges = useMemo(() => {
    const main = [];
    for (let i = 0; i < layout.length - 1; i++) {
      main.push({ from: layout[i].id, to: layout[i + 1].id, kind: "main" });
    }
    return main;
  }, [layout]);

  const byId = useMemo(() => Object.fromEntries(layout.map((n) => [n.id, n])), [layout]);

  const svgH = 110 + PIPELINE.length * 88 + 40;

  const showChart =
    result &&
    (result.mode === "chart" || result.mode === "both") &&
    result.echarts_option;
  const showText =
    result &&
    (result.mode === "analysis" || result.mode === "both") &&
    result.text_report;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Pipeline run</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted line-clamp-2">{prompt}</p>
        </div>
        <Link
          to="/"
          className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          New prompt
        </Link>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <svg
            viewBox={`0 0 600 ${svgH}`}
            className="h-auto w-full"
            role="img"
            aria-label="Agent pipeline flowchart"
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#3d9b82" />
              </marker>
              <marker
                id="arrow-retry"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#c4a574" />
              </marker>
            </defs>

            {edges.map((e) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b) return null;
              const x1 = a.x + NODE_W / 2;
              const y1 = a.y + NODE_H;
              const x2 = b.x + NODE_W / 2;
              const y2 = b.y;
              const visible =
                nodeStatus[e.to] ||
                nodeStatus[e.from] === "done" ||
                e.from === "user";
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M ${x1} ${y1} C ${x1} ${y1 + 28}, ${x2} ${y2 - 28}, ${x2} ${y2}`}
                  fill="none"
                  stroke={visible ? "#3d9b82" : "#3a4a45"}
                  strokeWidth={visible ? 2.5 : 1.5}
                  strokeOpacity={visible ? 1 : 0.35}
                  markerEnd={visible ? "url(#arrow)" : undefined}
                  className="transition-all duration-500"
                />
              );
            })}

            {loopEdges.map((e) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b) return null;
              const x1 = a.x;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              return (
                <path
                  key={e.key}
                  d={`M ${x1} ${y1} C ${x1 - 90} ${y1}, ${x2 - 90} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#c4a574"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  markerEnd="url(#arrow-retry)"
                  className="animate-pulse"
                />
              );
            })}

            {layout.map((node) => {
              const status =
                nodeStatus[node.id] ||
                (node.id === activeId ? "running" : "idle");
              const isActive = node.id === activeId;
              return (
                <g
                  key={node.id}
                  className="transition-transform duration-500"
                  style={{
                    transformOrigin: `${node.x + NODE_W / 2}px ${node.y + NODE_H / 2}px`,
                  }}
                >
                  <foreignObject
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      className={[
                        "flex h-full items-center justify-center rounded-xl border-2 px-2 text-center text-[12px] font-semibold leading-snug text-ink transition-all duration-500",
                        statusClass(status === "idle" ? "idle" : status),
                        isActive && status === "running" ? "ring-2 ring-moss/40" : "",
                      ].join(" ")}
                    >
                      {node.name}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Live log
          </h2>
          <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
            {messages.length === 0 && running ? (
              <li className="text-muted">Connecting to pipeline…</li>
            ) : null}
            {messages.map((m, i) => (
              <li
                key={`${m.agent_id}-${i}`}
                className="rounded-lg border border-line/60 bg-fog/60 px-3 py-2 animate-[fadeIn_0.4s_ease]"
              >
                <span className="font-medium text-moss">
                  {m.agent_id === "user"
                    ? "Prompt"
                    : PIPELINE.find((p) => p.id === m.agent_id)?.name || m.agent_id}
                </span>
                <p className="mt-0.5 text-ink/90">{m.message}</p>
              </li>
            ))}
          </ul>
          {running ? (
            <p className="mt-3 shrink-0 text-xs font-medium text-moss animate-pulse">
              Agents working…
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn"
          role="status"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="space-y-6" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl text-ink">Result</h2>
            {usedDemo ? (
              <span className="rounded-full bg-fog px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                Demo preview
              </span>
            ) : null}
          </div>
          {showChart ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-paper/80 p-3 sm:p-4">
              <ReactECharts
                option={result.echarts_option}
                style={{ height: 360, width: "100%" }}
                notMerge
                lazyUpdate
              />
            </div>
          ) : null}
          {showText ? (
            <article className="rounded-2xl border border-line bg-paper/80 px-5 py-4 text-[15px] leading-relaxed text-ink whitespace-pre-wrap">
              {result.text_report}
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
