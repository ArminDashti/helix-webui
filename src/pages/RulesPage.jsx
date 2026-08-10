import { useEffect, useMemo, useState } from "react";
import {
  createRule,
  deleteRule,
  fetchAgents,
  fetchRules,
  renameAgent,
  renameRule,
  updateRule,
} from "../api/client.js";
import AgentScopedMarkdownPage from "../components/AgentScopedMarkdownPage.jsx";

function isSharedRule(rule, agentIds) {
  if (!agentIds.length) return false;
  const assigned = rule.agents || [];
  return agentIds.every((id) => assigned.includes(id));
}

function ruleScope(rule, agentIds) {
  if (isSharedRule(rule, agentIds)) return "shared";
  const assigned = rule.agents || [];
  if (assigned.length === 1) return assigned[0];
  return null;
}

export default function RulesPage() {
  const [agents, setAgents] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedScope, setSelectedScope] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newId, setNewId] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const agentIds = useMemo(() => agents.map((a) => a.id), [agents]);

  const scopedItems = useMemo(() => {
    if (!selectedScope) return [];
    return rules.filter((r) => ruleScope(r, agentIds) === selectedScope);
  }, [rules, selectedScope, agentIds]);

  const selected = useMemo(
    () => scopedItems.find((r) => r.id === selectedId) || null,
    [scopedItems, selectedId],
  );

  function pickFirst(list) {
    return list[0]?.id || null;
  }

  async function reload(preferScope, preferId) {
    const [a, r] = await Promise.all([fetchAgents(), fetchRules()]);
    setAgents(a);
    setRules(r);
    const ids = a.map((x) => x.id);
    const scope = preferScope || selectedScope || a[0]?.id || null;
    setSelectedScope(scope);
    const scoped = r.filter((rule) => ruleScope(rule, ids) === scope);
    const id =
      preferId ||
      (scope === selectedScope && scoped.some((x) => x.id === selectedId)
        ? selectedId
        : null) ||
      pickFirst(scoped);
    setSelectedId(id);
    setDraft(r.find((x) => x.id === id)?.content || "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectScope(scope) {
    setSelectedScope(scope);
    setStatus(null);
    const scoped = rules.filter((r) => ruleScope(r, agentIds) === scope);
    const id = pickFirst(scoped);
    setSelectedId(id);
    setDraft(scoped.find((r) => r.id === id)?.content || "");
  }

  function selectItem(id) {
    const rule = rules.find((r) => r.id === id);
    setSelectedId(id);
    setDraft(rule?.content || "");
    setStatus(null);
  }

  async function handleCreate(event) {
    event.preventDefault();
    const id = newId.trim();
    if (!id) {
      setError("Enter a rule id.");
      return;
    }
    if (!selectedScope) {
      setError("Select an agent or Shared.");
      return;
    }
    const assigned =
      selectedScope === "shared" ? agentIds : [selectedScope];
    setError(null);
    try {
      const created = await createRule(id, "# New rule\n\n", assigned);
      setRules((prev) =>
        [...prev, created].sort((a, b) => a.id.localeCompare(b.id)),
      );
      setNewId("");
      setSelectedId(created.id);
      setDraft(created.content);
      setStatus(`Created ${created.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function handleSave() {
    if (!selected) return;
    setError(null);
    try {
      const updated = await updateRule(selected.id, {
        content: draft,
        agents: selected.agents || [],
      });
      setRules((prev) => prev.map((r) => (r.id === selected.id ? updated : r)));
      setStatus("Rule saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete rule ${selected.id}?`)) return;
    setError(null);
    try {
      await deleteRule(selected.id);
      const next = rules.filter((r) => r.id !== selected.id);
      setRules(next);
      const scoped = next.filter((r) => ruleScope(r, agentIds) === selectedScope);
      const id = pickFirst(scoped);
      setSelectedId(id);
      setDraft(scoped.find((r) => r.id === id)?.content || "");
      setStatus("Rule deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }


  async function handleRename() {
    if (!selected) return;
    const next = window.prompt("Rename rule", selected.id);
    if (!next || next.trim() === selected.id) return;
    setError(null);
    try {
      const updated = await renameRule(selected.id, next.trim());
      await reload(selectedScope, updated.id);
      setStatus(`Renamed to ${updated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function handleRenameAgent(agent) {
    const next = window.prompt("New agent display name", agent.name);
    if (!next || next.trim() === agent.name) return;
    setError(null);
    try {
      await renameAgent(agent.id, next.trim());
      await reload(selectedScope, selectedId);
      setStatus(`Agent renamed to ${next.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  return (
    <AgentScopedMarkdownPage
      agents={agents}
      selectedScope={selectedScope}
      onSelectScope={selectScope}
      items={scopedItems}
      selectedId={selectedId}
      onSelectItem={selectItem}
      itemsTitle="Rules"
      editorTitle={
        selected
          ? `${selectedScope === "shared" ? "shared" : selectedScope} / ${selected.id}`
          : "Select a rule"
      }
      draft={draft}
      onDraftChange={setDraft}
      onSave={handleSave}
      onDelete={handleDelete}
      onRenameItem={handleRename}
      onRenameAgent={handleRenameAgent}
      newId={newId}
      onNewIdChange={setNewId}
      onCreate={handleCreate}
      createPlaceholder="my-custom-rule"
      createLabel="Create rule"
      createInputId="rule-id"
      createInputLabel=""
      status={status}
      error={error}
      loading={loading}
      loadingLabel="Loading rules…"
      textareaRows={16}
    />
  );
}
