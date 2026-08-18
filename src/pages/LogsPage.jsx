import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, ScrollText, Trash2 } from "lucide-react";
import { deleteLog, fetchLog, fetchLogs } from "../api/client.js";
import DataGrid from "../components/DataGrid.jsx";
import IconButton from "../components/IconButton.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";

const LOG_KIND_FILTERS = ["all", "pipeline", "llm", "sql", "database", "api"];

function truncateText(value, max = 120) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function kindLabel(t, kind) {
  const key = `logs.kind.${kind}`;
  const label = t(key);
  return label === key ? kind : label;
}

function LogsList() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kindFilter, setKindFilter] = useState("all");

  async function load() {
    const records = await fetchLogs();
    setItems(records);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(failMessage(err, t, "logs.loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  async function handleDelete(item) {
    if (!window.confirm(t("logs.deleteConfirm"))) return;
    setError(null);
    try {
      await deleteLog(item.id);
      await load();
    } catch (err) {
      setError(failMessage(err, t, "logs.deleteFailed"));
    }
  }

  const filtered = useMemo(
    () =>
      kindFilter === "all"
        ? items
        : items.filter((item) => item.kind === kindFilter),
    [items, kindFilter],
  );

  const rows = useMemo(
    () => filtered.map((item) => ({ key: item.id, item })),
    [filtered],
  );

  const columns = useMemo(
    () => [
      {
        key: "datetime",
        label: t("logs.colDatetime"),
        render: (item) => (
          <span className="whitespace-nowrap font-sans text-[13px]">
            {formatDateTime(item.created_at, locale)}
          </span>
        ),
      },
      {
        key: "kind",
        label: t("logs.colKind"),
        render: (item) => (
          <span className="rounded-full border border-warn-border bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
            {kindLabel(t, item.kind)}
          </span>
        ),
      },
      {
        key: "message",
        label: t("logs.colMessage"),
        render: (item) => truncateText(item.message),
      },
      {
        key: "prompt",
        label: t("logs.colPrompt"),
        render: (item) =>
          item.prompt ? truncateText(item.prompt, 80) : t("logs.noPrompt"),
      },
      {
        key: "show",
        label: t("logs.colShow"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Eye}
            onClick={() => navigate(`/logs/${item.id}`)}
            className="rounded-lg border border-line bg-fog px-2 py-1.5 text-xs font-medium hover:bg-fog/80"
          >
            {t("logs.show")}
          </IconButton>
        ),
      },
      {
        key: "delete",
        label: t("logs.colDelete"),
        render: (item) => (
          <IconButton
            type="button"
            icon={Trash2}
            onClick={() => handleDelete(item)}
            className="rounded-lg border border-warn-border bg-warn-bg px-2 py-1.5 text-xs font-medium text-warn hover:opacity-90"
          >
            {t("logs.delete")}
          </IconButton>
        ),
      },
    ],
    [t, locale, navigate],
  );

  if (loading) {
    return <p className="text-sm text-muted">{t("logs.loadingList")}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader icon={ScrollText} title={t("logs.title")}>
        <p className="mt-0.5 text-sm text-muted">{t("logs.subtitle")}</p>
      </PageHeader>
      {error ? (
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("logs.filterAria")}
      >
        {LOG_KIND_FILTERS.map((kind) => {
          const isActive = kindFilter === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-fog/40 text-muted hover:bg-fog",
              ].join(" ")}
            >
              {kind === "all" ? t("logs.filterAll") : kindLabel(t, kind)}
            </button>
          );
        })}
      </div>
      <DataGrid columns={columns} rows={rows} emptyLabel={t("logs.empty")} />
    </div>
  );
}

function LogDetail({ logId }) {
  const { t, locale } = useI18n();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchLog(logId);
        if (!cancelled) setRecord(item);
      } catch (err) {
        if (!cancelled) {
          setRecord(null);
          setError(failMessage(err, t, "logs.loadOneFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, t]);

  if (loading) {
    return <p className="text-sm text-muted">{t("logs.loadingDetail")}</p>;
  }

  if (error || !record) {
    return (
      <div className="space-y-3">
        <PageHeader icon={ScrollText} title={t("logs.title")} backTo="/logs" />
        <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {error || t("logs.notFound")}
        </p>
        <Link
          to="/logs"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          <ArrowLeft
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
          {t("logs.backToList")}
        </Link>
      </div>
    );
  }

  const fields = [
    { key: "created_at", label: t("logs.fieldDatetime"), value: formatDateTime(record.created_at, locale) },
    { key: "kind", label: t("logs.fieldKind"), value: kindLabel(t, record.kind) },
    { key: "message", label: t("logs.fieldMessage"), value: record.message || t("common.noneDash") },
    { key: "prompt", label: t("logs.fieldPrompt"), value: record.prompt || t("logs.noPrompt") },
    { key: "mode", label: t("logs.fieldMode"), value: record.mode || t("common.noneDash") },
    { key: "agent_id", label: t("logs.fieldAgent"), value: record.agent_id || t("common.noneDash") },
    { key: "path", label: t("logs.fieldPath"), value: record.path || t("common.noneDash") },
    {
      key: "status_code",
      label: t("logs.fieldStatus"),
      value: record.status_code != null ? String(record.status_code) : t("common.noneDash"),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <PageHeader icon={ScrollText} title={t("logs.title")} backTo="/logs" />
      <dl className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4">
        {fields.map((field) => (
          <div key={field.key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              {field.label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
              {field.value}
            </dd>
          </div>
        ))}
        {record.sql ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("logs.fieldSql")}
            </dt>
            <dd className="mt-1 overflow-x-auto rounded-xl border border-line bg-fog/40 p-3 font-mono text-xs text-ink">
              {record.sql}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default function LogsPage() {
  const { logId } = useParams();
  if (logId) return <LogDetail logId={logId} />;
  return <LogsList />;
}
