import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Scale } from "lucide-react";
import { createRule, fetchAgents } from "../api/client.js";
import AgentPicker from "../components/AgentPicker.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function NewRulePage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [agentIds, setAgentIds] = useState([]);
  const [newId, setNewId] = useState("");
  const [name, setName] = useState("");
  const [content, setContent] = useState("# New rule\n\n");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await fetchAgents()) || [];
        if (cancelled) return;
        setAgents(list);
        setAgentIds(list[0]?.id ? [list[0].id] : []);
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
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    const id = newId.trim();
    if (!id) {
      setError("Enter a rule id.");
      return;
    }
    if (!name.trim()) {
      setError("Enter a rule name.");
      return;
    }
    if (!agentIds.length) {
      setError("Select at least one agent.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createRule(id, {
        content: content || "# New rule\n\n",
        agents: agentIds,
        name: name.trim(),
      });
      navigate("/rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Scale} title="New rule" backTo="/rules" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={handleCreate}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-ink">Id</span>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className={inputClass}
              placeholder="my-custom-rule"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="My rule"
              required
            />
          </label>
        </div>
        <AgentPicker
          agents={agents}
          selectedIds={agentIds}
          onChange={setAgentIds}
        />
        <label className="flex min-h-0 flex-1 flex-col text-sm">
          <span className="font-medium text-ink">Content</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 min-h-[12rem] w-full flex-1 resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <IconButton
            type="submit"
            icon={Plus}
            disabled={saving}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create rule"}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
