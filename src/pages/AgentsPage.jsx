import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, Bot, LayoutList, ListTree, Network, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteAgent,
  fetchAgents,
  fetchRules,
  fetchSkills,
  setAgentDisabled,
} from "../api/client.js";
import PipelineDesigner from "../components/PipelineDesigner.jsx";
import DataGrid from "../components/DataGrid.jsx";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import useFlash from "../lib/useFlash.js";
import StackedNames from "../components/StackedNames.jsx";

function namesForAgent(agentId, items) {
  return items
    .filter((item) => (item.agents || []).includes(agentId))
    .map((item) => item.name || item.id);
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useFlash();
  const [view, setView] = useState("list");

  async function reload() {
    const [a, r, s] = await Promise.all([
      fetchAgents(),
      fetchRules(),
      fetchSkills(),
    ]);
    setAgents(a || []);
    setRules(r || []);
    setSkills(s || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(
    () => agents.map((agent) => ({ key: agent.id, item: agent })),
    [agents],
  );

  async function handleDisable(agent) {
    setError(null);
    try {
      const updated = await setAgentDisabled(agent.id, !agent.disabled);
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, ...updated } : a)),
      );
      setStatus(
        updated.disabled ? `Disabled ${updated.name}` : `Enabled ${updated.name}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(agent) {
    if (!window.confirm(`Delete agent “${agent.name || agent.id}”?`)) return;
    setError(null);
    try {
      await deleteAgent(agent.id);
      await reload();
      setStatus("Agent deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    }
  }

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (agent) => (
        <span className="font-mono text-[13px]">{agent.id}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (agent) => agent.name || agent.id,
    },
    {
      key: "rules",
      label: "Rules",
      render: (agent) => <StackedNames items={namesForAgent(agent.id, rules)} />,
    },
    {
      key: "skills",
      label: "Skills",
      render: (agent) => <StackedNames items={namesForAgent(agent.id, skills)} />,
    },
    {
      key: "edit",
      label: "Edit",
      render: (agent) => (
        <IconButton
          type="button"
          icon={Pencil}
          onClick={() => navigate(`/agents/${encodeURIComponent(agent.id)}`)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          Edit
        </IconButton>
      ),
    },
    {
      key: "disable",
      label: "Disable",
      render: (agent) => (
        <IconButton
          type="button"
          icon={Ban}
          onClick={() => handleDisable(agent)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {agent.disabled ? "Enable" : "Disable"}
        </IconButton>
      ),
    },
    {
      key: "delete",
      label: "Delete",
      render: (agent) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(agent)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            Delete
          </IconButton>
        ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">Loading agents…</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Bot}
        title="Agents"
        actions={
          <>
            <div
              className="flex rounded-xl border border-line bg-fog/40 p-0.5"
              role="tablist"
              aria-label="Agents view"
            >
              {[
                { id: "list", label: "List", icon: LayoutList },
                { id: "arrange", label: "Arrange", icon: ListTree },
                { id: "graph", label: "Graph", icon: Network },
              ].map((tab) => (
                <IconButton
                  key={tab.id}
                  type="button"
                  role="tab"
                  icon={tab.icon}
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
                </IconButton>
              ))}
            </div>
            {view === "list" ? (
              <Link
                to="/agents/new"
                className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
              >
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                New agent
              </Link>
            ) : null}
          </>
        }
      />
      {error && view === "list" ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {view === "list" ? <FlashMessage message={status} /> : null}
      {view === "list" ? (
        <DataGrid columns={columns} rows={rows} emptyLabel="No agents" />
      ) : null}
      <div
        className={
          view === "list" ? "hidden" : "flex min-h-0 flex-1 flex-col"
        }
      >
        <PipelineDesigner
          agents={agents}
          mode={view === "list" ? "arrange" : view}
        />
      </div>
    </div>
  );
}
