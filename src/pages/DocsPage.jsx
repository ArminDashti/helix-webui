import { useEffect, useMemo, useState } from "react";
import { Save, Table2 } from "lucide-react";
import { fetchDocsTable, fetchDocsTables, saveDocsTableOverview } from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function DocsPage() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listError, setListError] = useState(null);
  const [tableFilter, setTableFilter] = useState("");
  const [overviewDraft, setOverviewDraft] = useState("");
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDocsTables();
        setTables(data.tables || []);
        setListError(data.error || null);
        const first = data.tables?.[0]?.full_name;
        if (first) setSelected(first);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load docs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setError(null);
      try {
        const data = await fetchDocsTable(selected);
        if (!cancelled) {
          setDetail(data);
          setOverviewDraft(data.overview || "");
          setOverviewDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Failed to load table");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) =>
      String(t.full_name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [tables, tableFilter]);

  if (loading) {
    return <p className="text-sm text-muted">Loading database docs…</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-2">
      <PageHeader icon={Table2} title="Table docs" />

      {listError ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          Live schema unavailable: {listError}
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(22rem,32rem)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-2">
          <label className="block px-1">
            <span className="sr-only">Filter tables</span>
            <input
              type="search"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Filter tables…"
              className="w-full rounded-lg border border-line bg-fog/40 px-2 py-1.5 text-sm outline-none focus:border-moss"
            />
          </label>
          <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {tables.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">No tables found</li>
            ) : filteredTables.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted">No matching tables</li>
            ) : (
              filteredTables.map((t) => (
                <li key={t.full_name}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.full_name)}
                    className={[
                      "w-full rounded-xl px-3 py-1.5 text-left text-sm transition",
                      selected === t.full_name
                        ? "bg-moss text-white"
                        : "text-ink hover:bg-fog",
                    ].join(" ")}
                  >
                    <span className="block break-all whitespace-normal font-medium">
                      {t.full_name}
                    </span>
                    <span
                      className={[
                        "block text-[11px]",
                        selected === t.full_name ? "text-white/80" : "text-muted",
                      ].join(" ")}
                    >
                      {t.kind || "table"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-line/80 bg-paper/80 p-4">
          {detailLoading ? (
            <p className="text-sm text-muted">Loading table…</p>
          ) : !detail ? (
            <p className="text-sm text-muted">Select a table</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-ink">Overview</h3>
                <textarea
                  value={overviewDraft}
                  onChange={(e) => {
                    setOverviewDraft(e.target.value);
                    setOverviewDirty(true);
                  }}
                  rows={5}
                  placeholder="Write an explanation for this table…"
                  className="w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <IconButton
                    type="button"
                    icon={Save}
                    disabled={savingOverview || !overviewDirty}
                    onClick={async () => {
                      if (!selected) return;
                      setSavingOverview(true);
                      setError(null);
                      try {
                        const data = await saveDocsTableOverview(
                          selected,
                          overviewDraft,
                        );
                        setDetail(data);
                        setOverviewDraft(data.overview || "");
                        setOverviewDirty(false);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to save explanation",
                        );
                      } finally {
                        setSavingOverview(false);
                      }
                    }}
                    className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
                  >
                    {savingOverview ? "Saving…" : "Save explanation"}
                  </IconButton>
                  {overviewDirty ? (
                    <span className="text-xs text-muted">Unsaved changes</span>
                  ) : null}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Columns</h3>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-fog/50 text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Column</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Null</th>
                        <th className="px-3 py-2 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.columns || []).map((col) => (
                        <tr key={col.name} className="border-t border-line/70">
                          <td className="px-3 py-2 font-mono text-[13px]">{col.name}</td>
                          <td className="px-3 py-2 text-muted">{col.data_type || "—"}</td>
                          <td className="px-3 py-2 text-muted">
                            {col.nullable ? "YES" : "NO"}
                          </td>
                          <td className="px-3 py-2">
                            {col.description || (
                              <span className="text-muted">No description</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
