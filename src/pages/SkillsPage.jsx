import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ban, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  deleteSkill,
  fetchAgents,
  fetchSkills,
  updateSkill,
} from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StackedNames from "../components/StackedNames.jsx";

function agentLabels(skill, agents) {
  const ids = skill.agents || [];
  return ids.map((id) => agents.find((a) => a.id === id)?.name || id);
}

export default function SkillsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [skills, setSkills] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [a, s] = await Promise.all([fetchAgents(), fetchSkills()]);
    setAgents(a || []);
    setSkills(s || []);
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
    () =>
      skills.map((skill) => ({
        key: `${skill.scope}/${skill.id}`,
        item: skill,
      })),
    [skills],
  );

  async function handleDisable(skill) {
    setError(null);
    try {
      const updated = await updateSkill(skill.scope, skill.id, {
        disabled: !skill.disabled,
      });
      setSkills((prev) =>
        prev.map((s) =>
          s.scope === skill.scope && s.id === skill.id ? updated : s,
        ),
      );
      setStatus(
        updated.disabled
          ? `Disabled ${updated.id}`
          : `Enabled ${updated.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(skill) {
    if (!window.confirm(`Delete skill ${skill.id}?`)) return;
    setError(null);
    try {
      await deleteSkill(skill.scope, skill.id);
      setSkills((prev) =>
        prev.filter((s) => !(s.scope === skill.scope && s.id === skill.id)),
      );
      setStatus("Skill deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const columns = [
    {
      key: "id",
      label: "ID",
      render: (skill) => (
        <span className="font-mono text-[13px]">{skill.id}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (skill) => skill.name || skill.id,
    },
    {
      key: "agents",
      label: "Agents",
      render: (skill) => <StackedNames items={agentLabels(skill, agents)} />,
    },
    {
      key: "edit",
      label: "Edit",
      render: (skill) => (
        <IconButton
          type="button"
          icon={Pencil}
          onClick={() =>
            navigate(`/skills/${encodeURIComponent(skill.scope)}/${encodeURIComponent(skill.id)}`)
          }
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          Edit
        </IconButton>
      ),
    },
    {
      key: "disable",
      label: "Disable",
      render: (skill) => (
        <IconButton
          type="button"
          icon={Ban}
          onClick={() => handleDisable(skill)}
          className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
        >
          {skill.disabled ? "Enable" : "Disable"}
        </IconButton>
      ),
    },
    {
      key: "delete",
      label: "Delete",
      render: (skill) => (
        <IconButton
          type="button"
          icon={Trash2}
          onClick={() => handleDelete(skill)}
          className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
        >
          Delete
        </IconButton>
      ),
    },
  ];

  if (loading) {
    return <p className="text-sm text-muted">Loading skills…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        icon={Sparkles}
        title="Skills"
        actions={
          <Link
            to="/skills/new"
            className="inline-flex items-center gap-2 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            New skill
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
      <DataGrid columns={columns} rows={rows} emptyLabel="No skills" />
    </div>
  );
}
