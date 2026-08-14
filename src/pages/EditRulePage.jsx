import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Scale } from "lucide-react";
import {
  fetchAgents,
  fetchRules,
  renameRule,
  updateRule,
} from "../api/client.js";
import AgentPicker from "../components/AgentPicker.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function EditRulePage() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [rule, setRule] = useState(null);
  const [name, setName] = useState("");
  const [idDraft, setIdDraft] = useState("");
  const [agentIds, setAgentIds] = useState([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, rules] = await Promise.all([fetchAgents(), fetchRules()]);
        if (cancelled) return;
        setAgents(list || []);
        const found = (rules || []).find((r) => r.id === ruleId);
        if (!found) {
          setError("Rule not found");
          return;
        }
        setRule(found);
        setName(found.name || found.id);
        setIdDraft(found.id);
        setAgentIds(found.agents || []);
        setContent(found.content || "");
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
  }, [ruleId]);

  async function handleSave(event) {
    event.preventDefault();
    if (!rule) return;
    if (!agentIds.length) {
      setError("Select at least one agent.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let currentId = rule.id;
      if (idDraft.trim() && idDraft.trim() !== rule.id) {
        const renamed = await renameRule(rule.id, idDraft.trim());
        currentId = renamed.id;
      }
      await updateRule(currentId, {
        content,
        agents: agentIds,
        name,
      });
      navigate("/rules");
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
      <PageHeader icon={Scale} title="Edit rule" backTo="/rules" />
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={handleSave}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-ink">Id</span>
            <input
              value={idDraft}
              onChange={(e) => setIdDraft(e.target.value)}
              className={inputClass}
              required
            />
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
            icon={Save}
            disabled={saving}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rule"}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
