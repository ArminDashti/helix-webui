import { useEffect, useMemo, useState } from "react";
import {
  createReference,
  deleteReference,
  fetchAgents,
  fetchReferences,
  saveAgentInstruction,
  updateReference,
} from "../api/client.js";
import AgentScopedMarkdownPage from "../components/AgentScopedMarkdownPage.jsx";

export default function InstructionsPage() {
  const [agents, setAgents] = useState([]);
  const [references, setReferences] = useState([]);
  const [selectedScope, setSelectedScope] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newId, setNewId] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const isShared = selectedScope === "shared";

  const scopedItems = useMemo(() => {
    if (!selectedScope) return [];
    if (isShared) {
      return references.map((r) => ({ id: r.name, content: r.content }));
    }
    const agent = agents.find((a) => a.id === selectedScope);
    if (!agent) return [];
    return [{ id: "instruction", content: agent.instruction || "" }];
  }, [selectedScope, isShared, references, agents]);

  useEffect(() => {
    (async () => {
      try {
        const [a, r] = await Promise.all([fetchAgents(), fetchReferences()]);
        setAgents(a);
        setReferences(r);
        const scope = a[0]?.id || null;
        setSelectedScope(scope);
        if (scope) {
          setSelectedId("instruction");
          setDraft(a.find((x) => x.id === scope)?.instruction || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function selectScope(scope) {
    setSelectedScope(scope);
    setStatus(null);
    if (scope === "shared") {
      const first = references[0]?.name || null;
      setSelectedId(first);
      setDraft(references.find((r) => r.name === first)?.content || "");
    } else {
      setSelectedId("instruction");
      setDraft(agents.find((a) => a.id === scope)?.instruction || "");
    }
  }

  function selectItem(id) {
    setSelectedId(id);
    setStatus(null);
    if (isShared) {
      setDraft(references.find((r) => r.name === id)?.content || "");
    } else {
      setDraft(agents.find((a) => a.id === selectedScope)?.instruction || "");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!isShared) return;
    const name = newId.trim();
    if (!name) {
      setError("Enter a shared instruction id.");
      return;
    }
    setError(null);
    try {
      const created = await createReference(name, "# New instruction\n\n");
      setReferences((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewId("");
      setSelectedId(created.name);
      setDraft(created.content);
      setStatus(`Created ${created.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function handleSave() {
    if (!selectedId || !selectedScope) return;
    setError(null);
    try {
      if (isShared) {
        const updated = await updateReference(selectedId, draft);
        setReferences((prev) =>
          prev.map((r) => (r.name === selectedId ? updated : r)),
        );
        setStatus("Shared instruction saved.");
      } else {
        const updated = await saveAgentInstruction(selectedScope, draft);
        setAgents((prev) =>
          prev.map((a) =>
            a.id === selectedScope
              ? { ...a, instruction: updated.instruction }
              : a,
          ),
        );
        setStatus("Instruction saved.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!isShared || !selectedId) return;
    if (!window.confirm(`Delete ${selectedId}.md?`)) return;
    setError(null);
    try {
      await deleteReference(selectedId);
      const next = references.filter((r) => r.name !== selectedId);
      setReferences(next);
      const pick = next[0]?.name || null;
      setSelectedId(pick);
      setDraft(next.find((r) => r.name === pick)?.content || "");
      setStatus("Shared instruction deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const editorTitle = selectedId
    ? isShared
      ? `shared / ${selectedId}`
      : `${selectedScope} / instruction`
    : "Select an instruction";

  return (
    <AgentScopedMarkdownPage
      agents={agents}
      selectedScope={selectedScope}
      onSelectScope={selectScope}
      items={scopedItems}
      selectedId={selectedId}
      onSelectItem={selectItem}
      itemLabel={(item) => (isShared ? item.id : "instruction")}
      itemsTitle="Instructions"
      editorTitle={editorTitle}
      draft={draft}
      onDraftChange={setDraft}
      onSave={handleSave}
      onDelete={handleDelete}
      canDelete={isShared}
      showCreate={isShared}
      newId={newId}
      onNewIdChange={setNewId}
      onCreate={handleCreate}
      createPlaceholder="schema-notes"
      createLabel="Create instruction"
      createInputId="instruction-id"
      createInputLabel="New shared instruction id"
      status={status}
      error={error}
      loading={loading}
      loadingLabel="Loading instructions…"
      textareaRows={18}
    />
  );
}
