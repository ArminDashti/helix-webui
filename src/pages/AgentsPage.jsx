import { useEffect, useState } from "react";
import {
  createAgent,
  deleteAgent,
  fetchAgents,
  renameAgent,
  updateAgentInstruction,
} from "../api/client.js";
import AgentGraphDesigner from "../components/AgentGraphDesigner.jsx";

const PIPELINE_DESIGNER_HINT = {
  id: "pipeline_designer",
  name: "Pipeline Designer",
  description: "Designs and documents analysis pipelines",
  instruction:
    "You design Helix analysis pipelines. Propose agent stages, responsibilities, handoffs, and validation rules. Prefer clear markdown plans over code unless asked.",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [view, setView] = useState("list");

  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [selectedBuiltin, setSelectedBuiltin] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState(PIPELINE_DESIGNER_HINT.id);
  const [newName, setNewName] = useState(PIPELINE_DESIGNER_HINT.name);
  const [newDescription, setNewDescription] = useState(
    PIPELINE_DESIGNER_HINT.description,
  );
  const [newInstruction, setNewInstruction] = useState(
    PIPELINE_DESIGNER_HINT.instruction,
  );

  function applyAgent(agent) {
    if (!agent) {
      setSelectedAgentId(null);
      setAgentName("");
      setAgentInstruction("");
      setAgentDescription("");
      setSelectedBuiltin(true);
      return;
    }
    setSelectedAgentId(agent.id);
    setAgentName(agent.name || "");
    setAgentInstruction(agent.instruction || "");
    setAgentDescription(agent.description || "");
    setSelectedBuiltin(agent.builtin !== false);
  }

  async function loadAgents(preferId) {
    const list = (await fetchAgents()) || [];
    setAgents(list);
    const pick =
      list.find((a) => a.id === preferId) ||
      list.find((a) => a.id === selectedAgentId) ||
      list[0] ||
      null;
    applyAgent(pick);
    return list;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAgents();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load agents");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  function selectAgent(agent) {
    setStatus(null);
    setError(null);
    applyAgent(agent);
    setShowCreate(false);
  }

  async function handleSaveAgent(event) {
    event.preventDefault();
    if (!selectedAgentId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await renameAgent(selectedAgentId, agentName);
      await updateAgentInstruction(selectedAgentId, agentInstruction);
      await loadAgents(selectedAgentId);
      setStatus("Agent saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAgent(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const created = await createAgent({
        id: newId.trim(),
        name: newName.trim(),
        description: newDescription.trim(),
        instruction: newInstruction,
      });
      await loadAgents(created.id);
      setShowCreate(false);
      setStatus(`Created agent “${created.name}”.`);
      setNewId(PIPELINE_DESIGNER_HINT.id);
      setNewName(PIPELINE_DESIGNER_HINT.name);
      setNewDescription(PIPELINE_DESIGNER_HINT.description);
      setNewInstruction(PIPELINE_DESIGNER_HINT.instruction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent() {
    if (!selectedAgentId || selectedBuiltin) return;
    if (!window.confirm(`Delete agent “${agentName || selectedAgentId}”?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await deleteAgent(selectedAgentId);
      await loadAgents();
      setStatus("Agent deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setSaving(false);
    }
  }

  function fillPipelineDesigner() {
    setNewId(PIPELINE_DESIGNER_HINT.id);
    setNewName(PIPELINE_DESIGNER_HINT.name);
    setNewDescription(PIPELINE_DESIGNER_HINT.description);
    setNewInstruction(PIPELINE_DESIGNER_HINT.instruction);
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

  if (loading) {
    return <p className="text-sm text-muted">Loading agents…</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-xl text-ink sm:text-2xl">Agents</h1>
          <p className="text-sm text-muted">
            Built-in pipeline agents plus custom profiles (e.g. Pipeline Designer).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-xl border border-line bg-fog/40 p-0.5"
            role="tablist"
            aria-label="Agents view"
          >
            {[
              { id: "list", label: "List" },
              { id: "arrange", label: "Arrange" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={view === tab.id}
                onClick={() => setView(tab.id)}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  view === tab.id
                    ? "bg-moss text-white"
                    : "text-ink hover:bg-fog",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {view === "list" ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setStatus(null);
                setError(null);
                fillPipelineDesigner();
              }}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
            >
              New agent
            </button>
          ) : null}
        </div>
      </header>

      {error && view === "list" ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {status && view === "list" ? (
        <p className="shrink-0 rounded-xl border border-line bg-paper/80 px-4 py-2 text-sm text-moss">
          {status}
        </p>
      ) : null}

      {view === "arrange" ? (
        <AgentGraphDesigner agents={agents} />
      ) : (
        <>
      {showCreate ? (
        <form
          onSubmit={handleCreateAgent}
          className="shrink-0 space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Create agent
            </h2>
            <button
              type="button"
              onClick={fillPipelineDesigner}
              className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-fog"
            >
              Use Pipeline Designer template
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-ink">Id</span>
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className={inputClass}
                placeholder="pipeline_designer"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
                placeholder="Pipeline Designer"
                required
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-ink">Description</span>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Instruction</span>
            <textarea
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              className="mt-1 min-h-[8rem] w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create agent"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[220px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <p className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Agents
          </p>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {agents.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">No agents</li>
            ) : (
              agents.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => selectAgent(agent)}
                    className={[
                      "w-full rounded-xl px-3 py-1.5 text-left text-sm transition",
                      selectedAgentId === agent.id
                        ? "bg-moss text-white"
                        : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    <span className="block truncate font-medium">{agent.name}</span>
                    <span
                      className={[
                        "block truncate text-[11px]",
                        selectedAgentId === agent.id
                          ? "text-white/80"
                          : "text-muted",
                      ].join(" ")}
                    >
                      {agent.id}
                      {agent.builtin === false ? " · custom" : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <form
          onSubmit={handleSaveAgent}
          className="flex min-h-0 flex-col gap-3 rounded-2xl border border-line/80 bg-paper/80 p-4"
        >
          {selectedAgentId ? (
            <>
              <label className="block text-sm">
                <span className="font-medium text-ink">Display name</span>
                <input
                  id="agent_display_name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className={inputClass}
                />
              </label>
              {agentDescription ? (
                <p className="text-sm text-muted">{agentDescription}</p>
              ) : null}
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {selectedBuiltin ? "Built-in pipeline agent" : "Custom agent"}
              </p>
              <div className="flex min-h-0 flex-1 flex-col">
                <label
                  htmlFor="agent_instruction"
                  className="block text-sm font-medium text-ink"
                >
                  Instruction
                </label>
                <textarea
                  id="agent_instruction"
                  value={agentInstruction}
                  onChange={(e) => setAgentInstruction(e.target.value)}
                  className="mt-1 min-h-[16rem] w-full flex-1 resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save agent"}
                </button>
                {!selectedBuiltin ? (
                  <button
                    type="button"
                    onClick={handleDeleteAgent}
                    disabled={saving}
                    className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm font-medium text-warn hover:opacity-90 disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Select an agent to edit.</p>
          )}
        </form>
      </div>
        </>
      )}
    </div>
  );
}
