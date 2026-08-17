import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  Database,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  fetchAgents,
  fetchDatabaseSettings,
  fetchOpenRouterModels,
  fetchOpenRouterSettings,
  fetchProviderSettings,
  saveDatabaseSettings,
  saveOpenRouterSettings,
  saveProvider,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import ModelCombobox from "../components/ModelCombobox.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { failMessage, translateKnownMessage } from "../i18n/apiErrors.js";
import { formatDateTime } from "../i18n/format.js";
import useFlash from "../lib/useFlash.js";
import { compareAz, sortByLabel, sortStrings } from "../utils/sortOptions.js";
import { agentCompanyLabel } from "../utils/agentLabel.js";

const EMPTY_DB = {
  engine: "sqlite",
  host: "",
  port: 0,
  name: "helix-sample.sqlite",
  user: "",
  password: "",
  sslmode: "prefer",
  driver: "ODBC Driver 18 for SQL Server",
  trust_server_certificate: true,
  encrypt: true,
  path: "",
};

const SSL_MODES = ["disable", "prefer", "require", "verify-ca", "verify-full"];

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const EMPTY_OPENROUTER = {
  token: "",
  base_url: OPENROUTER_BASE_URL,
  app_name: "Helix",
  default_model: "auto",
  agents: {},
  token_configured: false,
};

const TAB_ALIASES = {
  general: "llm",
  provider: "llm",
  openrouter: "llm",
  cursor: "llm",
  sql: "database",
  connection: "llm",
  logs: "status",
};

function engineLabel(t, value) {
  if (value === "sqlite") return t("settings.engineSqlite");
  if (value === "postgresql") return t("settings.enginePostgresql");
  if (value === "sqlserver") return t("settings.engineSqlserver");
  return value;
}

function isSampleDbName(name) {
  const base = String(name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.toLowerCase();
  return (
    base === "helix-sample.sqlite" ||
    base === "adventureworks-lt.sqlite" ||
    base === "sample.sqlite"
  );
}

function tabIcon(tabId) {
  if (tabId === "database") return Database;
  if (tabId === "status") return Activity;
  return SettingsIcon;
}

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function StatusLogsSection() {
  const { t, locale } = useI18n();
  const { health, checking, lastFetchError, statusLog, checkConnection } =
    useApiStatus();
  const providerKey = "llm";
  const current = {
    llm: {
      status: health?.[providerKey]?.status,
      detail: health
        ? health[providerKey]?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.[providerKey]?.checked_at,
    },
    engine: {
      status: health?.api?.status,
      detail: health
        ? health.api?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .map((part) => translateKnownMessage(t, part))
              .join(" — ")
          : t("settings.cannotReach"),
      checked_at: health?.api?.checked_at,
    },
    database: {
      status: health?.database?.status,
      detail: health
        ? health.database?.detail || ""
        : t("settings.engineUnreachableDb"),
      checked_at: health?.database?.checked_at,
    },
  };

  const services = [
    { id: "llm", label: t("layout.status.llm") },
    { id: "engine", label: t("layout.status.engine") },
    { id: "database", label: t("layout.status.database") },
  ];

  return (
    <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabStatus")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("settings.statusIntro")}</p>
        </div>
        <IconButton
          type="button"
          icon={RefreshCw}
          onClick={() => checkConnection({ silent: false })}
          className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          {checking ? t("settings.checking") : t("settings.checkNow")}
        </IconButton>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {services.map((svc) => {
          const block = current[svc.id];
          const connected = isConnectedStatus(block.status);
          const stateLabel =
            checking && !block.status
              ? t("settings.checking")
              : connected
                ? t("settings.connected")
                : block.status
                  ? t("settings.disconnectedWithRaw", { status: block.status })
                  : t("settings.disconnected");
          const events = [...statusLog]
            .filter((evt) => evt.service === svc.id)
            .reverse();
          return (
            <div
              key={svc.id}
              className="flex min-h-0 flex-col rounded-xl border border-line/80 bg-fog/30 p-3"
            >
              <p className="text-sm font-semibold text-ink">{svc.label}</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  connected ? "text-moss" : "text-danger"
                }`}
              >
                {stateLabel}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("settings.checkedAt", {
                  time: formatDateTime(block.checked_at, locale) || t("common.noneDash"),
                })}
              </p>
              <p className="mt-2 text-sm text-ink">
                {translateKnownMessage(t, block.detail) || t("settings.noReason")}
              </p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {events.length === 0 ? (
                  <li className="text-muted">{t("settings.noEvents")}</li>
                ) : (
                  events.map((evt, index) => (
                    <li
                      key={`${evt.at}-${evt.status}-${index}`}
                      className="rounded-lg border border-line/70 bg-paper/80 px-2 py-1.5"
                    >
                      <p className="text-muted">{formatDateTime(evt.at, locale)}</p>
                      <p className="font-medium text-ink">{evt.status}</p>
                      {evt.detail ? (
                        <p className="mt-0.5 break-words text-ink">
                          {translateKnownMessage(t, evt.detail)}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_ALIASES[tabParam] || tabParam;

  const tabs = useMemo(
    () => [
      { id: "llm", label: t("settings.tabLlm") },
      { id: "database", label: t("settings.tabDatabase") },
      { id: "status", label: t("settings.tabStatus") },
    ],
    [t],
  );

  const activeSection = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : "llm";

  const dbEngines = useMemo(
    () =>
      sortByLabel(
        [
          { value: "sqlite", label: t("settings.engineSqlite") },
          { value: "postgresql", label: t("settings.enginePostgresql") },
          { value: "sqlserver", label: t("settings.engineSqlserver") },
        ],
        (item) => item.label,
        locale,
      ),
    [t, locale],
  );

  const sslModes = useMemo(
    () => sortStrings(SSL_MODES, locale),
    [locale],
  );

  const apiOptions = useMemo(
    () => [
      { value: "openrouter", label: t("settings.apiOpenrouter") },
      { value: "openai_compatible", label: t("settings.apiOpenaiCompatible") },
    ],
    [t],
  );

  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [connectionStringDirty, setConnectionStringDirty] = useState(false);
  const [provider, setProvider] = useState("openrouter");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [status, setStatus] = useFlash();
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentNameById, setAgentNameById] = useState({});
  const { checkConnection } = useApiStatus();

  function agentLabel(agentId) {
    return agentNameById[agentId] || agentId.replace(/_/g, " ");
  }

  function setActiveSection(id) {
    setSearchParams(id === "llm" ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    (async () => {
      const failures = [];
      let anyOk = false;
      try {
        try {
          const agents = await fetchAgents();
          const map = {};
          for (const a of agents || []) {
            if (a?.id) map[a.id] = agentCompanyLabel(a);
          }
          setAgentNameById(map);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionAgentsFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const dbData = await fetchDatabaseSettings();
          setDbForm({ ...EMPTY_DB, ...dbData.database });
          setConnectionString(dbData.connection_string || "");
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionDatabaseFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const orData = await fetchOpenRouterSettings();
          setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter, token: "" });
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionLlmFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        try {
          const providerData = await fetchProviderSettings();
          const nextProvider =
            providerData.provider === "openai_compatible"
              ? "openai_compatible"
              : "openrouter";
          setProvider(nextProvider);
          anyOk = true;
        } catch (err) {
          failures.push({
            key: "settings.sectionApiFail",
            message: err instanceof Error ? err.message : "",
          });
        }

        setSectionErrors(failures);
        if (!anyOk && failures.length) {
          setError(t("settings.allUnreachable"));
        } else if (failures.length) {
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  useEffect(() => {
    if (loading) return;
    if (!orForm.token_configured) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const data = await fetchOpenRouterModels({ silent: true });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        if (!cancelled) {
          setModelsError(
            err instanceof Error ? err.message : t("settings.modelsFail"),
          );
          setModels([]);
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, orForm.token_configured, t]);

  function defaultPortForEngine(engine) {
    if (engine === "sqlserver") return 1433;
    if (engine === "sqlite") return 0;
    return 5432;
  }

  function updateDbField(key, value) {
    setDbForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "engine") {
        next.port = defaultPortForEngine(value);
        if (value === "sqlite") {
          next.name = "helix-sample.sqlite";
          next.host = "";
          next.path = "";
        } else {
          if (isSampleDbName(next.name) || isSampleDbName(next.path)) {
            next.name = "";
          }
          next.path = "";
        }
      }
      return next;
    });
    setConnectionStringDirty(false);
    if (key === "engine") {
      setConnectionString("");
    }
  }

  function updateOrField(key, value) {
    setOrForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAgentModel(agentId, model) {
    setOrForm((prev) => ({
      ...prev,
      agents: {
        ...prev.agents,
        [agentId]: { ...(prev.agents?.[agentId] || {}), model },
      },
    }));
  }

  function handleApiChange(next) {
    setProvider(next);
    if (next !== "openrouter") return;
    setOrForm((prev) => {
      const current = (prev.base_url || "").trim();
      if (!current || current === OPENROUTER_BASE_URL) {
        return { ...prev, base_url: OPENROUTER_BASE_URL };
      }
      return prev;
    });
  }

  async function handleSaveDatabase(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const engine = dbForm.engine || "sqlite";
      const trimmedConn = (connectionString || "").trim();
      const staleSqliteConn = trimmedConn.toLowerCase().startsWith("file:");
      const payload =
        connectionStringDirty && trimmedConn && !(engine !== "sqlite" && staleSqliteConn)
          ? { connection_string: trimmedConn, engine }
          : engine === "sqlite"
            ? { engine: "sqlite", name: "helix-sample.sqlite" }
            : {
                engine,
                host: dbForm.host,
                port: Number(dbForm.port) || defaultPortForEngine(engine),
                name: dbForm.name,
                user: dbForm.user,
                password: dbForm.password,
                driver: dbForm.driver,
                sslmode: dbForm.sslmode,
                encrypt: dbForm.encrypt,
                trust_server_certificate: dbForm.trust_server_certificate,
              };
      const data = await saveDatabaseSettings(payload);
      setDbForm({ ...EMPTY_DB, ...data.database });
      setConnectionString(data.connection_string || "");
      setConnectionStringDirty(false);
      setStatus(t("settings.dbSaved"));
      checkConnection({ silent: true });
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function handleSaveLlm(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        base_url: (orForm.base_url || "").trim(),
        app_name: orForm.app_name,
        default_model: orForm.default_model,
        agents: orForm.agents,
      };
      if (orForm.token?.trim()) {
        payload.token = orForm.token.trim();
      }
      const data = await saveOpenRouterSettings(payload);
      const providerData = await saveProvider(provider);
      setProvider(providerData.provider || provider);
      setOrForm({ ...EMPTY_OPENROUTER, ...data.openrouter, token: "" });
      setStatus(t("settings.llmSaved"));
      checkConnection({ silent: true });
      if (data.openrouter?.token_configured) {
        await refreshModels({ tokenConfigured: true });
      }
    } catch (err) {
      setError(failMessage(err, t, "common.saveFailed"));
    }
  }

  async function refreshModels({ tokenConfigured = orForm.token_configured } = {}) {
    if (!tokenConfigured && !(orForm.token || "").trim()) {
      setModels([]);
      setModelsError(null);
      setModelsLoading(false);
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchOpenRouterModels({ force: true, silent: true });
      setModels(data.models || []);
    } catch (err) {
      setModelsError(
        err instanceof Error ? err.message : t("settings.modelsFail"),
      );
    } finally {
      setModelsLoading(false);
    }
  }

  if (tabParam === "agents") {
    return <Navigate to="/agents" replace />;
  }

  if (loading) {
    return <p className="text-sm text-muted">{t("settings.loading")}</p>;
  }

  const agentIds = sortStrings(
    Object.keys(orForm.agents || {}).length
      ? Object.keys(orForm.agents)
      : Object.keys(agentNameById),
    locale,
  ).sort((a, b) => compareAz(agentLabel(a), agentLabel(b), locale));

  const modelPlaceholder =
    provider === "openai_compatible"
      ? t("settings.modelsSearch")
      : t("settings.modelsSearchOpenRouter");

  function sectionErrorMessage(failure) {
    const message =
      translateKnownMessage(t, failure.message) || t("common.failedToLoad");
    return t(failure.key, { message });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader icon={SettingsIcon} title={t("settings.title")} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-e">
        <nav
          className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label={t("settings.categoriesAria")}
        >
          {tabs.map((tab) => (
            <IconButton
              key={tab.id}
              type="button"
              role="tab"
              icon={tabIcon(tab.id)}
              aria-selected={activeSection === tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={[
                "shrink-0 rounded-xl px-3 py-2 text-start text-sm font-medium transition md:w-full",
                activeSection === tab.id
                  ? "bg-moss text-white"
                  : "border border-line bg-fog/40 text-ink hover:bg-fog",
              ].join(" ")}
            >
              {tab.label}
            </IconButton>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-3">
        {error ? (
          <p className="shrink-0 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            {translateKnownMessage(t, error) || error}
          </p>
        ) : null}
        {sectionErrors.length ? (
          <div className="shrink-0 space-y-1 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            <p className="font-medium">{t("settings.sectionLoadFailed")}</p>
            <ul className="list-disc ps-5">
              {sectionErrors.map((failure) => (
                <li key={failure.key}>{sectionErrorMessage(failure)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FlashMessage message={status} />

      {activeSection === "status" ? <StatusLogsSection /> : null}

      {activeSection === "llm" ? (
        <form
          onSubmit={handleSaveLlm}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t("settings.tabLlm")}
            </h2>
            <IconButton
              type="button"
              icon={RefreshCw}
              onClick={() => refreshModels()}
              disabled={modelsLoading || !orForm.token_configured}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              {t("settings.refreshModels")}
            </IconButton>
          </div>
          <p className="text-sm text-muted">{t("settings.llmIntro")}</p>

          <Field label={t("settings.api")} id="llm_api">
            <select
              id="llm_api"
              value={provider}
              onChange={(e) => handleApiChange(e.target.value)}
              className={inputClass}
            >
              {apiOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("settings.baseUrl")} id="llm_base_url">
            <input
              id="llm_base_url"
              value={orForm.base_url || ""}
              onChange={(e) => updateOrField("base_url", e.target.value)}
              className={inputClass}
              placeholder={
                provider === "openrouter"
                  ? OPENROUTER_BASE_URL
                  : t("settings.baseUrlPlaceholder")
              }
              spellCheck={false}
            />
          </Field>

          <Field label={t("settings.apiKey")} id="llm_token">
            <input
              id="llm_token"
              type="password"
              autoComplete="off"
              value={orForm.token || ""}
              onChange={(e) => updateOrField("token", e.target.value)}
              className={inputClass}
              placeholder={
                orForm.token_configured
                  ? t("settings.apiKeySavedPlaceholder")
                  : t("settings.apiKeyPastePlaceholder")
              }
              spellCheck={false}
            />
          </Field>
          <p className="text-xs text-muted">
            {orForm.token_configured
              ? t("settings.apiKeySavedHint")
              : t("settings.apiKeyPasteHint")}
          </p>

          {modelsError ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
              {t("settings.modelsError", {
                message: translateKnownMessage(t, modelsError),
              })}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.defaultModel")} id="default_model">
              <ModelCombobox
                id="default_model"
                value={orForm.default_model}
                onChange={(v) => updateOrField("default_model", v)}
                models={models}
                loading={modelsLoading}
                placeholder={modelPlaceholder}
              />
            </Field>
            <Field label={t("settings.appName")} id="app_name">
              <input
                id="app_name"
                value={orForm.app_name}
                onChange={(e) => updateOrField("app_name", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">{t("settings.perAgent")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {agentIds.map((agentId) => (
                <Field
                  key={agentId}
                  label={agentLabel(agentId)}
                  id={`agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`agent-${agentId}`}
                    value={orForm.agents?.[agentId]?.model || "auto"}
                    onChange={(v) => updateAgentModel(agentId, v)}
                    models={models}
                    loading={modelsLoading}
                    placeholder={modelPlaceholder}
                  />
                </Field>
              ))}
            </div>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveLlm")}
          </IconButton>
        </form>
      ) : null}

      {activeSection === "database" ? (
        <form
          onSubmit={handleSaveDatabase}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("settings.tabDatabase")}
          </h2>

          <Field label={t("settings.dbEngine")} id="engine">
            <select
              id="engine"
              value={dbForm.engine || "sqlite"}
              onChange={(e) => updateDbField("engine", e.target.value)}
              className={inputClass}
            >
              {dbEngines.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {engineLabel(t, opt.value)}
                </option>
              ))}
            </select>
          </Field>

          {dbForm.engine === "sqlite" ? (
            <p className="text-sm text-muted">{t("settings.sqliteHint")}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("settings.host")} id="host">
                  <input
                    id="host"
                    value={dbForm.host}
                    onChange={(e) => updateDbField("host", e.target.value)}
                    className={inputClass}
                    placeholder={
                      dbForm.engine === "postgresql"
                        ? "127.0.0.1"
                        : "sql.example.com"
                    }
                  />
                </Field>
                <Field label={t("settings.port")} id="port">
                  <input
                    id="port"
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => updateDbField("port", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("settings.name")} id="name">
                  <input
                    id="name"
                    value={dbForm.name}
                    onChange={(e) => updateDbField("name", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {dbForm.engine === "postgresql" ? (
                  <Field label={t("settings.sslMode")} id="sslmode">
                    <select
                      id="sslmode"
                      value={dbForm.sslmode || "prefer"}
                      onChange={(e) => updateDbField("sslmode", e.target.value)}
                      className={inputClass}
                    >
                      {sslModes.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={t("settings.driver")} id="driver">
                    <input
                      id="driver"
                      value={dbForm.driver}
                      onChange={(e) => updateDbField("driver", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
                <Field label={t("settings.user")} id="user">
                  <input
                    id="user"
                    value={dbForm.user}
                    onChange={(e) => updateDbField("user", e.target.value)}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t("settings.password")} id="password">
                  <input
                    id="password"
                    type="password"
                    value={dbForm.password}
                    onChange={(e) => updateDbField("password", e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </Field>
              </div>

              {dbForm.engine === "sqlserver" ? (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.encrypt)}
                      onChange={(e) => updateDbField("encrypt", e.target.checked)}
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.encrypt")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(dbForm.trust_server_certificate)}
                      onChange={(e) =>
                        updateDbField("trust_server_certificate", e.target.checked)
                      }
                      className="size-4 rounded border-line text-moss"
                    />
                    {t("settings.trustCert")}
                  </label>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label htmlFor="conn" className="block text-sm font-medium text-ink">
              {t("settings.connectionString")}
            </label>
            <textarea
              id="conn"
              rows={3}
              value={connectionString}
              onChange={(e) => {
                setConnectionString(e.target.value);
                setConnectionStringDirty(true);
              }}
              className="mt-1 w-full resize-y rounded-xl border border-line bg-fog/40 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-moss focus:ring-2 focus:ring-moss/30"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted">{t("settings.connectionHint")}</p>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            {t("settings.saveDatabase")}
          </IconButton>
        </form>
      ) : null}
      </div>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/30";

function Field({ label, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
