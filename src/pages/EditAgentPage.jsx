import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, Save } from "lucide-react";
import { fetchAgents, updateAgent } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function EditAgentPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState("");
  const [humanName, setHumanName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAgents();
        if (cancelled) return;
        const found = (list || []).find((a) => a.id === agentId);
        if (!found) {
          setError("Agent not found");
          return;
        }
        setAgent(found);
        setName(found.name || found.id);
        setHumanName(found.human_name || "");
        setDescription(found.description || "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function handleSave(event) {
    event.preventDefault();
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      await updateAgent(agent.id, {
        name,
        human_name: humanName,
        description,
      });
      navigate("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Bot} title="Edit agent" backTo="/agents" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={handleSave}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <label className="block text-sm">
          <span className="font-medium text-ink">Id</span>
          <input value={agent?.id || agentId} className={inputClass} disabled />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Human name</span>
          <input
            value={humanName}
            onChange={(e) => setHumanName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Role</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="text-sm text-muted">
          Agents use assigned rules and skills only.
        </p>
        <div className="flex flex-wrap gap-2">
          <IconButton
            type="submit"
            icon={Save}
            disabled={saving}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save agent"}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
