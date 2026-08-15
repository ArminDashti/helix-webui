import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Database, Play } from "lucide-react";
import {
  fetchDbExplorerColumns,
  fetchDbExplorerTables,
  runDbExplorerQuery,
} from "../api/client.js";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";

const LIMITS = [16, 32, 64, 128];
const WHERE_PLACEHOLDER = "e.g. Status = Active AND Amount > 0";

export default function DbExplorerPage() {
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState([]);
  const [limit, setLimit] = useState(32);
  const [position, setPosition] = useState("top");
  const [where, setWhere] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [sort, setSort] = useState("ASC");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [tableFilter, setTableFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDbExplorerTables();
        const list = data.tables || [];
        setTables(list);
        if (list[0]?.full_name) setTable(list[0].full_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tables");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!table) {
      setColumns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDbExplorerColumns(table);
        if (cancelled) return;
        const cols = data.columns || [];
        setColumns(cols);
        setOrderBy((prev) => prev || cols[0]?.name || "");
      } catch {
        if (!cancelled) setColumns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [table]);

  const columnNames = useMemo(() => columns.map((c) => c.name), [columns]);

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) =>
      String(t.full_name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [tables, tableFilter]);

  async function handleRun(event) {
    event.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const data = await runDbExplorerQuery({
        table,
        limit,
        position,
        where,
        order_by: orderBy,
        sort,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading DB explorer…</p>;
  }

  return (
    <div className="hx-rise flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={Database} title="DB Explorer">
        <p className="text-sm text-muted">
          SELECT top or tail rows with WHERE, ORDER BY, and ASC/DESC sort.
        </p>
      </PageHeader>

      {error ? (
        <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleRun}
        className="filter-section shrink-0 space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="block text-sm md:col-span-2 xl:col-span-1">
            <span className="font-medium text-ink">Table</span>
            <input
              type="search"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Filter tables…"
              className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
            />
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
            >
              {tables.length === 0 ? (
                <option value="">No tables</option>
              ) : filteredTables.length === 0 ? (
                <option value={table || ""}>
                  {table ? `${table} (not in filter)` : "No matching tables"}
                </option>
              ) : (
                <>
                  {table &&
                  !filteredTables.some((t) => t.full_name === table) ? (
                    <option value={table}>{table} (not in filter)</option>
                  ) : null}
                  {filteredTables.map((t) => (
                    <option key={t.full_name} value={t.full_name}>
                      {t.full_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <fieldset className="text-sm">
            <legend className="font-medium text-ink">Rows</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {LIMITS.map((n) => (
                <IconButton
                  key={n}
                  type="button"
                  icon={Database}
                  onClick={() => setLimit(n)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                    limit === n
                      ? "border-moss bg-moss text-white"
                      : "border-line bg-fog/40 text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {n}
                </IconButton>
              ))}
            </div>
          </fieldset>

          <fieldset className="text-sm">
            <legend className="font-medium text-ink">Position</legend>
            <div className="mt-1 flex gap-2">
              {["top", "tail"].map((pos) => (
                <IconButton
                  key={pos}
                  type="button"
                  icon={pos === "top" ? ArrowUp : ArrowDown}
                  onClick={() => setPosition(pos)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize",
                    position === pos
                      ? "border-moss bg-moss text-white"
                      : "border-line bg-fog/40 text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  {pos}
                </IconButton>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="font-medium text-ink">ORDER BY</span>
              <select
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
              >
                {columnNames.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  columnNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">SORT</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss"
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
            </label>
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-ink">WHERE</span>
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder={WHERE_PLACEHOLDER}
            className="mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[13px] outline-none focus:border-moss"
          />
        </label>

        <IconButton
          type="submit"
          icon={Play}
          disabled={!table || running}
          className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
        >
          {running ? "Running…" : "Run SELECT"}
        </IconButton>
      </form>

      {result ? (
        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-2xl border border-line/80 bg-paper/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>
              {result.row_count} row(s) · {result.position} {result.limit} · ordered by{" "}
              {result.order_by} {result.sort}
            </span>
            <code className="max-w-full truncate rounded-lg bg-fog/50 px-2 py-1 font-mono text-[11px] text-ink">
              {result.sql}
            </code>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
            <table className="min-w-full text-left font-sans text-sm">
              <thead className="sticky top-0 bg-fog/80 text-xs uppercase tracking-wide text-muted backdrop-blur">
                <tr>
                  {(result.columns || []).map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.rows || []).map((row, idx) => (
                  <tr key={idx} className="border-t border-line/70">
                    {(result.columns || []).map((c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-1.5 font-sans text-[12px]">
                        {row[c] === null || row[c] === undefined ? (
                          <span className="text-muted">NULL</span>
                        ) : (
                          String(row[c])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
