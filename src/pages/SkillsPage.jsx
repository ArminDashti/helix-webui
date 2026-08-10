import { useEffect, useMemo, useState } from "react";
import {
  createSkill,
  deleteSkill,
  fetchAgents,
  fetchSkills,
  renameAgent,
  renameSkill,
  updateSkill,
} from "../api/client.js";
import AgentScopedMarkdownPage from "../components/AgentScopedMarkdownPage.jsx";

export default function SkillsPage() {
  const [agents, setAgents] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedScope, setSelectedScope] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newId, setNewId] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const scopedItems = useMemo(
    () => skills.filter((s) => s.scope === selectedScope),
    [skills, selectedScope],
  );

  const selected = useMemo(
    () => scopedItems.find((s) => s.id === selectedId) || null,
    [scopedItems, selectedId],
  );

  function pickFirstInScope(list, scope) {
    const first = list.find((s) => s.scope === scope);
    return first ? first.id : null;
  }

  async function reload(preferScope, preferId) {
    const [a, s] = await Promise.all([fetchAgents(), fetchSkills()]);
    setAgents(a);
    setSkills(s);
    const scope = preferScope || selectedScope || a[0]?.id || null;
    setSelectedScope(scope);
    const id = preferId || (scope === selectedScope ? selectedId : null) || pickFirstInScope(s, scope);
    setSelectedId(id);
    const skill = s.find((x) => x.scope === scope && x.id === id);
    setDraft(skill?.content || "");
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
    const id = pickFirstInScope(skills, scope);
    setSelectedId(id);
    const skill = skills.find((s) => s.scope === scope && s.id === id);
    setDraft(skill?.content || "");
  }

  function selectItem(id) {
    const skill = skills.find((s) => s.scope === selectedScope && s.id === id);
    setSelectedId(id);
    setDraft(skill?.content || "");
    setStatus(null);
  }

  async function handleCreate(event) {
    event.preventDefault();
    const id = newId.trim();
    if (!id) {
      setError("Enter a skill id.");
      return;
    }
    if (!selectedScope) {
      setError("Select an agent or Shared.");
      return;
    }
    setError(null);
    try {
      const created = await createSkill(
        id,
        selectedScope,
        "---\nname: " + id + "\ndescription: \n---\n\n# " + id + "\n\n",
      );
      setSkills((prev) =>
        [...prev, created].sort((a, b) =>
          `${a.scope}/${a.id}`.localeCompare(`${b.scope}/${b.id}`),
        ),
      );
      setNewId("");
      setSelectedId(created.id);
      setDraft(created.content);
      setStatus(`Created ${created.scope}/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function handleSave() {
    if (!selected) return;
    setError(null);
    try {
      const updated = await updateSkill(selected.scope, selected.id, draft);
      setSkills((prev) =>
        prev.map((s) =>
          s.scope === selected.scope && s.id === selected.id ? updated : s,
        ),
      );
      setStatus("Skill saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete skill ${selected.scope}/${selected.id}?`)) return;
    setError(null);
    try {
      await deleteSkill(selected.scope, selected.id);
      const next = skills.filter(
        (s) => !(s.scope === selected.scope && s.id === selected.id),
      );
      setSkills(next);
      const id = pickFirstInScope(next, selectedScope);
      setSelectedId(id);
      setDraft(next.find((s) => s.scope === selectedScope && s.id === id)?.content || "");
      setStatus("Skill deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }


  async function handleRename() {
    if (!selected || !selectedScope) return;
    const next = window.prompt("Rename skill", selected.id);
    if (!next || next.trim() === selected.id) return;
    setError(null);
    try {
      const updated = await renameSkill(selectedScope, selected.id, next.trim());
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
      itemsTitle="Skills"
      editorTitle={
        selected ? `${selected.scope} / ${selected.id}` : "Select a skill"
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
      createPlaceholder="my-skill"
      createLabel="Create skill"
      createInputId="skill-id"
      createInputLabel=""
      status={status}
      error={error}
      loading={loading}
      loadingLabel="Loading skills…"
    />
  );
}
