/**
 * Shared three-pane shell: agents (+ Shared below) | item list | markdown editor.
 */
export default function AgentScopedMarkdownPage({
  agents,
  selectedScope,
  onSelectScope,
  items,
  selectedId,
  onSelectItem,
  itemLabel = (item) => item.id,
  getItemId = (item) => item.id,
  itemsTitle = "Items",
  emptyItemsLabel = "None",
  editorTitle,
  draft,
  onDraftChange,
  onSave,
  onDelete,
  canDelete = true,
  showCreate = true,
  newId,
  onNewIdChange,
  onCreate,
  createPlaceholder = "new-id",
  createLabel = "Create",
  createInputId = "scoped-new-id",
  createInputLabel = "New id",
  status,
  error,
  loading,
  loadingLabel = "Loading…",
  textareaRows = 20,
}) {
  if (loading) {
    return <p className="text-sm text-muted">{loadingLabel}</p>;
  }

  const scopeLabel =
    selectedScope === "shared"
      ? "Shared"
      : agents.find((a) => a.id === selectedScope)?.name || selectedScope;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="rounded-xl border border-line bg-paper/80 px-4 py-3 text-sm text-moss">
          {status}
        </p>
      ) : null}

      {showCreate ? (
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label
              htmlFor={createInputId}
              className="block text-sm font-medium text-ink"
            >
              {createInputLabel}
            </label>
            <input
              id={createInputId}
              value={newId}
              onChange={(e) => onNewIdChange(e.target.value)}
              placeholder={createPlaceholder}
              className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-line bg-fog px-4 py-2 text-sm font-medium hover:bg-fog/80"
          >
            {createLabel}
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_220px_1fr]">
        <aside className="rounded-2xl border border-line/80 bg-paper/80 p-3">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Agents
          </p>
          <ul className="mt-2 space-y-1">
            {agents.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  onClick={() => onSelectScope(agent.id)}
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                    selectedScope === agent.id
                      ? "bg-moss text-white"
                      : "hover:bg-fog text-ink",
                  ].join(" ")}
                >
                  {agent.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line/60 pt-3">
            <button
              type="button"
              onClick={() => onSelectScope("shared")}
              className={[
                "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                selectedScope === "shared"
                  ? "bg-moss text-white"
                  : "hover:bg-fog text-ink",
              ].join(" ")}
            >
              Shared
            </button>
          </div>
        </aside>

        <aside className="rounded-2xl border border-line/80 bg-paper/80 p-3">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {itemsTitle}
            {scopeLabel ? (
              <span className="mt-0.5 block font-normal normal-case tracking-normal text-muted">
                {scopeLabel}
              </span>
            ) : null}
          </p>
          <ul className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">{emptyItemsLabel}</li>
            ) : (
              items.map((item) => {
                const id = getItemId(item);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onSelectItem(id)}
                      className={[
                        "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                        selectedId === id
                          ? "bg-moss text-white"
                          : "hover:bg-fog text-ink",
                      ].join(" ")}
                    >
                      {itemLabel(item)}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <div className="space-y-4 rounded-2xl border border-line/80 bg-paper/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl text-ink">
              {editorTitle || "Select an item"}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!selectedId}
                className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
              >
                Save
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!selectedId}
                  className="rounded-xl border border-line bg-fog px-4 py-2 text-sm hover:bg-fog/80 disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            disabled={!selectedId}
            rows={textareaRows}
            className="w-full resize-y rounded-xl border border-line bg-fog/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30 disabled:opacity-50"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
