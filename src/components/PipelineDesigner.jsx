import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import {
  fetchPipelineBundle,
  resetPipelineBundle,
  savePipelineBundle,
} from "../api/client.js";
import AgentArrangeDesigner from "./AgentArrangeDesigner.jsx";
import AgentGraphDesigner from "./AgentGraphDesigner.jsx";
import FlashMessage from "./FlashMessage.jsx";
import IconButton from "./IconButton.jsx";
import useFlash from "../lib/useFlash.js";
import {
  cloneFlow,
  compileFlow,
  emptyStages,
  mergeGraphPositions,
  validateFlow,
} from "../pipeline/pipelineFlow.js";

export default function PipelineDesigner({ agents, mode }) {
  const [flow, setFlow] = useState(emptyStages());
  const [graph, setGraph] = useState({ entry: null, nodes: [], edges: [] });
  const [arrangeCompatible, setArrangeCompatible] = useState(true);
  const [arrangeError, setArrangeError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();

  const applyBundle = useCallback((bundle) => {
    setGraph(bundle.pipeline_graph || { entry: null, nodes: [], edges: [] });
    setFlow(bundle.pipeline_flow || emptyStages());
    setArrangeCompatible(Boolean(bundle.arrange_compatible));
    setArrangeError(bundle.arrange_error || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bundle = await fetchPipelineBundle();
        if (!cancelled) applyBundle(bundle);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load pipeline");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBundle]);

  function positionsFromGraph(g) {
    const map = {};
    for (const n of g?.nodes || []) {
      if (n.id && n.position) map[n.id] = n.position;
    }
    return map;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const unstructured = !arrangeCompatible || !flow?.type;
      if (!unstructured) {
        const errs = validateFlow(flow);
        if (errs.length) {
          setError(errs[0]);
          setSaving(false);
          return;
        }
        const compiled = compileFlow(flow, positionsFromGraph(graph));
        const saved = await savePipelineBundle({
          pipeline_flow: flow,
          pipeline_graph: compiled,
        });
        applyBundle(saved);
      } else {
        const saved = await savePipelineBundle({ pipeline_graph: graph });
        applyBundle(saved);
      }
      setStatus("Pipeline saved.");
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
      const saved = await resetPipelineBundle();
      applyBundle(saved);
      setStatus("Pipeline reset to default.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  function onPositionsChange(nextPositions) {
    setGraph((prev) => ({
      ...prev,
      nodes: (prev.nodes || []).map((n) => ({
        ...n,
        position: nextPositions[n.id] || n.position,
      })),
    }));
  }

  function onGraphChange(updater) {
    setGraph((prev) => (typeof updater === "function" ? updater(prev) : updater));
    setArrangeCompatible(false);
    setArrangeError("Arrange needs one IF per stage.");
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading pipeline…</p>;
  }

  const unstructured = !arrangeCompatible;
  const showArrange = mode === "arrange";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {unstructured && showArrange ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {arrangeError || "Arrange needs one IF per stage."} Open Graph
          to edit this pipeline, or reset to the default flow.
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <FlashMessage message={status} />

      <div className="flex shrink-0 justify-end gap-2">
        <IconButton
          type="button"
          icon={RotateCcw}
          onClick={handleReset}
          disabled={saving}
          className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80 disabled:opacity-50"
        >
          Reset default
        </IconButton>
        <IconButton
          type="button"
          icon={Save}
          onClick={handleSave}
          disabled={saving || (showArrange && unstructured)}
          className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </IconButton>
      </div>

      {showArrange && !unstructured ? (
        <AgentArrangeDesigner
          agents={agents}
          flow={flow}
          onFlowChange={(next) => {
            setFlow(cloneFlow(next));
            try {
              setGraph(compileFlow(next, mergeGraphPositions(graph, positionsFromGraph(graph))));
              setArrangeCompatible(true);
              setArrangeError(null);
            } catch {
              setArrangeCompatible(true);
            }
          }}
        />
      ) : showArrange ? null : (
        <AgentGraphDesigner
          agents={agents}
          flow={flow}
          graph={graph}
          unstructured={unstructured}
          onFlowChange={(next) => {
            setFlow(cloneFlow(next));
            try {
              setGraph(compileFlow(next, positionsFromGraph(graph)));
              setArrangeCompatible(true);
              setArrangeError(null);
            } catch {
              /* keep editing */
            }
          }}
          onGraphChange={onGraphChange}
          onPositionsChange={onPositionsChange}
        />
      )}
    </div>
  );
}
