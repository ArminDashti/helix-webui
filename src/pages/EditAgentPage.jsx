import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, Save } from "lucide-react";
import {
  fetchAgents,
  renameAgent,
  updateAgentInstruction,
} from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function EditAgentPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await fetchAgents()) || [];
        if (cancelled) return;
        const found = list.find((a) => a.id === agentId);
        if (!found) {
          setError("Agent not found");
          return;
        }
        setAgent(found);
        setName(found.name || found.id);
        setInstruction(found.instruction || "");
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
      await renameAgent(agent.id, name);
      await updateAgentInstruction(agent.id, instruction);
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
          <span className="font-medium text-ink">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex min-h-0 flex-1 flex-col text-sm">
          <span className="font-medium text-ink">Instruction</span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="mt-1 min-h-[12rem] w-full flex-1 resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
            spellCheck={false}
          />
        </label>
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
