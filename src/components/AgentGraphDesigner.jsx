import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchPipelineGraph,
  resetPipelineGraph,
  savePipelineGraph,
} from "../api/client.js";

const WHEN_OPTIONS = [
  { value: "always", label: "Always (on success)" },
  { value: "on_success", label: "On success" },
  { value: "on_failure", label: "On failure" },
  { value: "on_retry", label: "On retry" },
  { value: "on_status", label: "On status" },
];

function AgentNode({ data }) {
  return (
    <div className="min-w-[9rem] rounded-xl border border-line bg-paper px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-moss" />
      <p className="truncate text-sm font-semibold text-ink">{data.label}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-moss" />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

function graphToFlow(graph, agentsById) {
  const nodes = (graph?.nodes || []).map((n) => ({
    id: n.id,
    type: "agent",
    position: n.position || { x: 0, y: 0 },
    data: {
      agentId: n.id,
      label: agentsById[n.id]?.name || n.id,
    },
  }));
  const edges = (graph?.edges || []).map((e) => {
    const whenType = e.when?.type || "always";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: whenType,
      data: {
        when: { ...(e.when || { type: "always" }) },
      },
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.5 },
    };
  });
  return { nodes, edges, entry: graph?.entry || null };
}

function flowToGraph(nodes, edges, entry) {
  return {
    entry: entry || nodes[0]?.id || null,
    nodes: nodes.map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      direction: "forward",
      when: e.data?.when || { type: "always" },
    })),
  };
}

function AgentGraphDesignerInner({ agents }) {
  const agentsById = useMemo(() => {
    const map = {};
    for (const a of agents) map[a.id] = a;
    return map;
  }, [agents]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [entry, setEntry] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [paletteId, setPaletteId] = useState(agents[0]?.id || "");

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;

  const applyGraph = useCallback(
    (graph) => {
      const flow = graphToFlow(graph, agentsById);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setEntry(flow.entry);
      setSelectedEdgeId(null);
    },
    [agentsById, setNodes, setEdges],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const graph = await fetchPipelineGraph();
        if (!cancelled) applyGraph(graph);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load graph");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyGraph]);

  useEffect(() => {
    if (!paletteId && agents[0]?.id) setPaletteId(agents[0].id);
  }, [agents, paletteId]);

  const onConnect = useCallback(
    (connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e_${connection.source}_${connection.target}_${Date.now()}`,
            label: "always",
            data: { when: { type: "always" } },
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 1.5 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  function addAgentNode() {
    if (!paletteId) return;
    if (nodes.some((n) => n.id === paletteId)) {
      setError(`Node ${paletteId} is already on the canvas.`);
      return;
    }
    const agent = agentsById[paletteId];
    setNodes((prev) => [
      ...prev,
      {
        id: paletteId,
        type: "agent",
        position: { x: 80 + prev.length * 24, y: 80 + prev.length * 40 },
        data: {
          agentId: paletteId,
          label: agent?.name || paletteId,
        },
      },
    ]);
    if (!entry) setEntry(paletteId);
    setError(null);
  }

  function updateSelectedWhen(patch) {
    if (!selectedEdgeId) return;
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== selectedEdgeId) return e;
        const when = { ...(e.data?.when || { type: "always" }), ...patch };
        return {
          ...e,
          label: when.type,
          data: { ...e.data, when },
        };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const graph = flowToGraph(nodes, edges, entry);
      const saved = await savePipelineGraph(graph);
      applyGraph(saved);
      setStatus("Pipeline graph saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Reset to the default linear pipeline?")) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const graph = await resetPipelineGraph();
      applyGraph(graph);
      setStatus("Pipeline graph reset to default.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading pipeline graph…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="shrink-0 rounded-xl border border-line bg-paper/80 px-4 py-2 text-sm text-moss">
          {status}
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="font-medium text-ink">Add agent</span>
          <select
            value={paletteId}
            onChange={(e) => setPaletteId(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={addAgentNode}
          className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80"
        >
          Add to canvas
        </button>
        <label className="block text-sm">
          <span className="font-medium text-ink">Entry</span>
          <select
            value={entry || ""}
            onChange={(e) => setEntry(e.target.value || null)}
            className="mt-1 block min-w-[12rem] rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
          >
            <option value="">Auto</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {agentsById[n.id]?.name || n.id}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80 disabled:opacity-50"
          >
            Reset default
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save graph"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1fr_16rem]">
        <div className="min-h-[22rem] overflow-hidden rounded-2xl border border-line/80 bg-fog/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
            onPaneClick={() => setSelectedEdgeId(null)}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Edge condition
          </h3>
          {!selectedEdge ? (
            <p className="text-sm text-muted">
              Select an edge to set when it is used and which direction it
              follows (source → target).
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-mono text-xs text-muted">
                {selectedEdge.source} → {selectedEdge.target}
              </p>
              <label className="block">
                <span className="font-medium text-ink">When</span>
                <select
                  value={selectedEdge.data?.when?.type || "always"}
                  onChange={(e) => updateSelectedWhen({ type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 outline-none focus:border-moss"
                >
                  {WHEN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {(selectedEdge.data?.when?.type || "always") === "on_status" ? (
                <label className="block">
                  <span className="font-medium text-ink">Status</span>
                  <input
                    value={selectedEdge.data?.when?.status || ""}
                    onChange={(e) =>
                      updateSelectedWhen({ status: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 outline-none focus:border-moss"
                    placeholder="done"
                  />
                </label>
              ) : null}
              <p className="text-xs text-muted">
                Direction is the connection itself: drag from a source handle to
                a target handle.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
                  setSelectedEdgeId(null);
                }}
                className="rounded-xl border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80"
              >
                Delete edge
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AgentGraphDesigner({ agents }) {
  return (
    <ReactFlowProvider>
      <AgentGraphDesignerInner agents={agents} />
    </ReactFlowProvider>
  );
}
