import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Sparkles } from "lucide-react";
import { fetchSkills, renameSkill, updateSkill } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

export default function EditSkillPage() {
  const { scope, skillId } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [name, setName] = useState("");
  const [idDraft, setIdDraft] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const skills = await fetchSkills();
        if (cancelled) return;
        const found = (skills || []).find(
          (s) => s.scope === scope && s.id === skillId,
        );
        if (!found) {
          setError("Skill not found");
          return;
        }
        setSkill(found);
        setName(found.name || found.id);
        setIdDraft(found.id);
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
  }, [scope, skillId]);

  async function handleSave(event) {
    event.preventDefault();
    if (!skill) return;
    setSaving(true);
    setError(null);
    try {
      let currentId = skill.id;
      if (idDraft.trim() && idDraft.trim() !== skill.id) {
        const renamed = await renameSkill(skill.scope, skill.id, idDraft.trim());
        currentId = renamed.id;
      }
      await updateSkill(skill.scope, currentId, {
        content,
        agents: [],
        name,
      });
      navigate("/skills");
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
      <PageHeader icon={Sparkles} title="Edit skill" backTo="/skills" />
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
            {saving ? "Saving…" : "Save skill"}
          </IconButton>
        </div>
      </form>
    </div>
  );
}
