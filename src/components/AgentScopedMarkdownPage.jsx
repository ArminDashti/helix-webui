import { useState } from "react";
import { renderMarkdownToHtml } from "../lib/markdownPreview.js";

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
  onRenameItem,
  onRenameAgent,
  canDelete = true,
  canRename = true,
  showCreate = true,
  newId,
  onNewIdChange,
  onCreate,
  createPlaceholder = "new-id",
  createLabel = "Create",
  createInputId = "scoped-new-id",
  createInputLabel = "",
  status,
  error,
  loading,
  loadingLabel = "Loading…",
}) {
  const [viewMode, setViewMode] = useState("source");

  if (loading) {
    return <p className="text-sm text-muted">{loadingLabel}</p>;
  }

  const scopeLabel =
    selectedScope === "shared"
      ? "Shared"
      : agents.find((a) => a.id === selectedScope)?.name || selectedScope;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
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

      {showCreate ? (
        <form
          onSubmit={onCreate}
          className="flex shrink-0 flex-wrap items-end gap-2"
        >
          <div className="min-w-[14rem] flex-1">
            {createInputLabel ? (
              <label
                htmlFor={createInputId}
                className="block text-sm font-medium text-ink"
              >
                {createInputLabel}
              </label>
            ) : null}
            <input
              id={createInputId}
              value={newId}
              onChange={(e) => onNewIdChange(e.target.value)}
              placeholder={createPlaceholder}
              aria-label={createInputLabel || createPlaceholder || "Id"}
              className={[
                "w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30",
                createInputLabel ? "mt-1" : "",
              ].join(" ")}
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

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[200px_200px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <p className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Agents
          </p>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {agents.map((agent) => (
              <li key={agent.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectScope(agent.id)}
                  className={[
                    "w-full rounded-xl px-3 py-1.5 text-left text-sm transition",
                    selectedScope === agent.id
                      ? "bg-moss text-white"
                      : "hover:bg-fog text-ink",
                  ].join(" ")}
                >
                  {agent.name}
                </button>
                {onRenameAgent ? (
                  <button
                    type="button"
                    onClick={() => onRenameAgent(agent)}
                    className="w-full rounded-lg px-3 py-0.5 text-left text-[11px] text-muted hover:bg-fog hover:text-ink"
                  >
                    Rename agent
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-2 shrink-0 border-t border-line/60 pt-2">
            <button
              type="button"
              onClick={() => onSelectScope("shared")}
              className={[
                "w-full rounded-xl px-3 py-1.5 text-left text-sm transition",
                selectedScope === "shared"
                  ? "bg-moss text-white"
                  : "hover:bg-fog text-ink",
              ].join(" ")}
            >
              Shared
            </button>
          </div>
        </aside>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <p className="shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {itemsTitle}
            {scopeLabel ? (
              <span className="mt-0.5 block font-normal normal-case tracking-normal text-muted">
                {scopeLabel}
              </span>
            ) : null}
          </p>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
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
                        "w-full rounded-xl px-3 py-1.5 text-left text-sm transition",
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

        <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-line/80 bg-paper/80 p-3 sm:p-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl text-ink sm:text-2xl">
              {editorTitle || "Select an item"}
            </h2>
            <div className="flex flex-wrap gap-2">
              <div
                className="flex rounded-xl border border-line bg-fog/40 p-0.5"
                role="tablist"
                aria-label="Editor mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "source"}
                  onClick={() => setViewMode("source")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    viewMode === "source"
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  Source
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "preview"}
                  onClick={() => setViewMode("preview")}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    viewMode === "preview"
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  Preview
                </button>
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={!selectedId}
                className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
              >
                Save
              </button>
              {canRename && onRenameItem ? (
                <button
                  type="button"
                  onClick={onRenameItem}
                  disabled={!selectedId}
                  className="rounded-xl border border-line bg-fog px-4 py-2 text-sm hover:bg-fog/80 disabled:opacity-50"
                >
                  Rename
                </button>
              ) : null}
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

          {viewMode === "source" ? (
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={!selectedId}
              className="min-h-0 w-full flex-1 resize-none rounded-xl border border-line bg-fog/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30 disabled:opacity-50"
              spellCheck={false}
            />
          ) : (
            <div
              className="md-preview min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-fog/40 px-4 py-3 text-[15px] leading-relaxed text-ink"
              dangerouslySetInnerHTML={{
                __html: selectedId
                  ? renderMarkdownToHtml(draft)
                  : "<p class='text-muted'>Select an item</p>",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
