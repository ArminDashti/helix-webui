import { useEffect, useMemo, useState } from "react";
import { fetchDocsTable, fetchDocsTables } from "../api/client.js";

export default function DocsPage() {
  const [tables, setTables] = useState([]);
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listError, setListError] = useState(null);
  const [tableFilter, setTableFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDocsTables();
        setTables(data.tables || []);
        setSource(data.source || "");
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
        if (!cancelled) setDetail(data);
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
      <header className="shrink-0">
        <h1 className="font-display text-xl text-ink sm:text-2xl">Docs</h1>
        {source ? (
          <p className="text-sm text-muted">Source: {source}.</p>
        ) : null}
      </header>

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
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Tables
          </p>
          <label className="mt-1 block px-1">
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
                <h2 className="font-display text-lg text-ink">{detail.full_name}</h2>
                {detail.kind ? (
                  <p className="text-xs uppercase tracking-wide text-muted">{detail.kind}</p>
                ) : null}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-ink">Overview</h3>
                <p className="text-sm leading-relaxed text-ink/90">
                  {detail.overview ||
                    "No overview yet. Add a description in references/tables.md or SQL extended properties."}
                </p>
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
