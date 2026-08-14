export default function DataGrid({ columns, rows, emptyLabel = "None" }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line/80 bg-paper/80">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-fog/80 text-xs uppercase tracking-wide text-muted backdrop-blur">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-3 py-4 text-sm text-muted"
                colSpan={columns.length}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} className="border-t border-line/70">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 align-top">
                    {col.render(row.item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
