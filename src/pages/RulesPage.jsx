import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import {
  deleteRule,
  fetchAgents,
  fetchRules,
  updateRule,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StackedNames from "../components/StackedNames.jsx";

function agentLabels(rule, agents) {
  const ids = rule.agents || [];
  return ids.map((id) => agents.find((a) => a.id === id)?.name || id);
}

export default function RulesPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [a, r] = await Promise.all([fetchAgents(), fetchRules()]);
    setAgents(a || []);
    setRules(r || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(
    () => rules.map((rule) => ({ key: rule.id, item: rule })),
    [rules],
  );

  async function handleDisable(rule) {
    setError(null);
    try {
      const updated = await updateRule(rule.id, { disabled: !rule.disabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      setStatus(
        updated.disabled ? `Disabled ${updated.id}` : `Enabled ${updated.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(`Delete rule ${rule.id}?`)) return;
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setStatus("Rule deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (rule) => (
        <span className="font-mono text-[13px]">{rule.id}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (rule) => rule.name || rule.id,
    },
    {
      key: "agents",
      label: "Agents",
      render: (rule) => <StackedNames items={agentLabels(rule, agents)} />,
    },
    {
      key: "edit",
      label: "Edit",
      render: (rule) => (
        <IconButton
          type="button"
          icon={Pencil}
          onClick={() => navigate(`/rules/${encodeURIComponent(rule.id)}`)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          Edit
        </IconButton>
      ),
    },
    {
      key: "disable",
      label: "Disable",
      render: (rule) => (
        <IconButton
          type="button"
          icon={Ban}
          onClick={() => handleDisable(rule)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {rule.disabled ? "Enable" : "Disable"}
        </IconButton>
      ),
    },
    {
      key: "delete",
      label: "Delete",
      render: (rule) => (
        <IconButton
          type="button"
          icon={Trash2}
          onClick={() => handleDelete(rule)}
          className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
        >
          Delete
        </IconButton>
      ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">Loading rules…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Scale}
        title="Rules"
        actions={
          <Link
            to="/rules/new"
            className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            New rule
          </Link>
        }
      />
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
      <DataGrid columns={columns} rows={rows} emptyLabel="No rules" />
    </div>
  );
}
