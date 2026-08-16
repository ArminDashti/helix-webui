import { useEffect, useState } from "react";
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
  fetchCursorModels,
  fetchCursorSettings,
  fetchDatabaseSettings,
  fetchOpenRouterModels,
  fetchOpenRouterSettings,
  fetchProviderSettings,
  saveCursorSettings,
  saveDatabaseSettings,
  saveOpenRouterSettings,
  saveProvider,
} from "../api/client.js";
import FlashMessage from "../components/FlashMessage.jsx";
import IconButton from "../components/IconButton.jsx";
import ModelCombobox from "../components/ModelCombobox.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
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

const DB_ENGINES = sortByLabel([
  { value: "sqlite", label: "AdventureWorks" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlserver", label: "SQL Server" },
]);

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

const SSL_MODES = sortStrings([
  "disable",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
]);

const EMPTY_OPENROUTER = {
  token: "",
  app_name: "Helix",
  default_model: "auto",
  agents: {},
  token_configured: false,
};

const EMPTY_CURSOR = {
  token: "",
  app_name: "Helix",
  default_model: "auto",
  agents: {},
  token_configured: false,
};

const TABS = [
  { id: "llm", label: "LLM" },
  { id: "database", label: "Database" },
  { id: "status", label: "Status logs" },
];

const TAB_ALIASES = {
  general: "llm",
  provider: "llm",
  openrouter: "llm",
  cursor: "llm",
  sql: "database",
  connection: "llm",
  logs: "status",
};

function tabIcon(tabId) {
  if (tabId === "database") return Database;
  if (tabId === "status") return Activity;
  return SettingsIcon;
}

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function formatClock(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function StatusLogsSection() {
  const { health, checking, lastFetchError, statusLog, checkConnection } =
    useApiStatus();
  const providerKey = health?.provider === "cursor" ? "cursor" : "openrouter";
  const current = {
    llm: {
      status: health?.[providerKey]?.status,
      detail: health
        ? health[providerKey]?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .join(" — ")
          : "Cannot reach the API",
      checked_at: health?.[providerKey]?.checked_at,
    },
    engine: {
      status: health?.api?.status,
      detail: health
        ? health.api?.detail || ""
        : lastFetchError
          ? [lastFetchError.message, lastFetchError.detail]
              .filter(Boolean)
              .join(" — ")
          : "Cannot reach the API",
      checked_at: health?.api?.checked_at,
    },
    database: {
      status: health?.database?.status,
      detail: health
        ? health.database?.detail || ""
        : "Engine unreachable; database status unknown",
      checked_at: health?.database?.checked_at,
    },
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Status logs
          </h2>
          <p className="mt-1 text-sm text-muted">
            Why LLM, Engine, and Database show disconnected. Events stay in this
            browser tab until you reload.
          </p>
        </div>
        <IconButton
          type="button"
          icon={RefreshCw}
          onClick={() => checkConnection({ silent: false })}
          className="rounded-xl border border-line bg-fog/40 px-3 py-2 text-sm font-medium text-ink hover:bg-fog"
        >
          {checking ? "Checking…" : "Check now"}
        </IconButton>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { id: "llm", label: "LLM" },
          { id: "engine", label: "Engine" },
          { id: "database", label: "Database" },
        ].map((svc) => {
          const block = current[svc.id];
          const connected = isConnectedStatus(block.status);
          const state =
            checking && !block.status
              ? "Checking…"
              : connected
                ? "Connected"
                : "Disconnected";
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
                {state}
                {block.status && !connected ? ` (${block.status})` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                Checked {formatClock(block.checked_at)}
              </p>
              <p className="mt-2 text-sm text-ink">
                {block.detail || "No disconnect reason."}
              </p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {events.length === 0 ? (
                  <li className="text-muted">No events yet.</li>
                ) : (
                  events.map((evt, index) => (
                    <li
                      key={`${evt.at}-${evt.status}-${index}`}
                      className="rounded-lg border border-line/70 bg-paper/80 px-2 py-1.5"
                    >
                      <p className="text-muted">{formatClock(evt.at)}</p>
                      <p className="font-medium text-ink">{evt.status}</p>
                      {evt.detail ? (
                        <p className="mt-0.5 break-words text-ink">{evt.detail}</p>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_ALIASES[tabParam] || tabParam;
  const activeSection = TABS.some((t) => t.id === requestedTab)
    ? requestedTab
    : "llm";

  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [connectionStringDirty, setConnectionStringDirty] = useState(false);
  const [provider, setProvider] = useState("openrouter");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [cursorForm, setCursorForm] = useState(EMPTY_CURSOR);
  const [models, setModels] = useState([]);
  const [cursorModels, setCursorModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [cursorModelsLoading, setCursorModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [cursorModelsError, setCursorModelsError] = useState(null);
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
          failures.push(
            `Agents: ${err instanceof Error ? err.message : "Failed to load"}`,
          );
        }

        try {
          const dbData = await fetchDatabaseSettings();
          setDbForm({ ...EMPTY_DB, ...dbData.database });
          setConnectionString(dbData.connection_string || "");
          anyOk = true;
        } catch (err) {
          failures.push(
            `Database: ${err instanceof Error ? err.message : "Failed to load"}`,
          );
        }

        try {
          const orData = await fetchOpenRouterSettings();
          setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter, token: "" });
          anyOk = true;
        } catch (err) {
          failures.push(`OpenRouter: ${err instanceof Error ? err.message : "Failed to load"}`);
        }

        try {
          const cursorData = await fetchCursorSettings();
          setCursorForm({ ...EMPTY_CURSOR, ...cursorData.cursor, token: "" });
          anyOk = true;
        } catch (err) {
          failures.push(`Cursor: ${err instanceof Error ? err.message : "Failed to load"}`);
        }

        try {
          const providerData = await fetchProviderSettings();
          setProvider(providerData.provider || "openrouter");
          anyOk = true;
        } catch (err) {
          failures.push(`LLM: ${err instanceof Error ? err.message : "Failed to load"}`);
        }

        setSectionErrors(failures);
        if (!anyOk && failures.length) {
          setError("API unreachable — could not load any settings section.");
        } else if (failures.length) {
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const data = await fetchOpenRouterModels();
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        if (!cancelled) {
          setModelsError(
            err instanceof Error ? err.message : "Failed to load models",
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
  }, [loading, orForm.token_configured]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setCursorModelsLoading(true);
      setCursorModelsError(null);
      try {
        const data = await fetchCursorModels();
        if (!cancelled) setCursorModels(data.models || []);
      } catch (err) {
        if (!cancelled) {
          setCursorModelsError(
            err instanceof Error ? err.message : "Failed to load models",
          );
          setCursorModels([]);
        }
      } finally {
        if (!cancelled) setCursorModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, cursorForm.token_configured]);

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

  async function handleProviderChange(next) {
    setError(null);
    setStatus(null);
    try {
      const data = await saveProvider(next);
      setProvider(data.provider || next);
      setStatus(`Active provider: ${data.provider || next}`);
      checkConnection({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set provider");
    }
  }

  async function handleSaveCursor(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        app_name: cursorForm.app_name,
        default_model: cursorForm.default_model,
        agents: cursorForm.agents,
      };
      if (cursorForm.token?.trim()) {
        payload.token = cursorForm.token.trim();
      }
      const data = await saveCursorSettings(payload);
      setCursorForm({ ...EMPTY_CURSOR, ...data.cursor, token: "" });
      setStatus("Cursor API settings saved.");
      checkConnection({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
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
      setStatus("Database settings saved to helix.config.yaml.");
      checkConnection({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleSaveOpenRouter(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        app_name: orForm.app_name,
        default_model: orForm.default_model,
        agents: orForm.agents,
      };
      if (orForm.token?.trim()) {
        payload.token = orForm.token.trim();
      }
      const data = await saveOpenRouterSettings(payload);
      setOrForm({ ...EMPTY_OPENROUTER, ...data.openrouter, token: "" });
      setStatus("OpenRouter settings saved to helix.config.yaml.");
      checkConnection({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function refreshModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchOpenRouterModels({ force: true });
      setModels(data.models || []);
    } catch (err) {
      setModelsError(
        err instanceof Error ? err.message : "Failed to load models",
      );
    } finally {
      setModelsLoading(false);
    }
  }

  if (tabParam === "agents") {
    return <Navigate to="/agents" replace />;
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading settings…</p>;
  }

  const agentIds = sortStrings(
    Object.keys(orForm.agents || {}).length
      ? Object.keys(orForm.agents)
      : Object.keys(agentNameById),
  ).sort((a, b) => compareAz(agentLabel(a), agentLabel(b)));

  const cursorAgentIds = sortStrings(
    Object.keys(cursorForm.agents || {}).length
      ? Object.keys(cursorForm.agents)
      : Object.keys(agentNameById),
  ).sort((a, b) => compareAz(agentLabel(a), agentLabel(b)));

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PageHeader icon={SettingsIcon} title="Settings" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-r">
        <nav
          className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label="Settings categories"
        >
          {TABS.map((tab) => (
            <IconButton
              key={tab.id}
              type="button"
              role="tab"
              icon={tabIcon(tab.id)}
              aria-selected={activeSection === tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={[
                "shrink-0 rounded-xl px-3 py-2 text-left text-sm font-medium transition md:w-full",
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
            {error}
          </p>
        ) : null}
        {sectionErrors.length ? (
          <div className="shrink-0 space-y-1 rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
            <p className="font-medium">Some settings sections failed to load:</p>
            <ul className="list-disc pl-5">
              {sectionErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FlashMessage message={status} />

      {activeSection === "status" ? <StatusLogsSection /> : null}

      {activeSection === "llm" ? (
        <>
        <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            LLM
          </h2>
          <p className="text-sm text-muted">
            Analysis runs call an OpenAI-compatible chat API. Use OpenRouter
            for that. Cursor Cloud API can list models but has no
            chat-completions route.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "openrouter", label: "OpenRouter" },
              { value: "cursor", label: "Cursor API" },
            ].map((opt) => (
              <IconButton
                key={opt.value}
                type="button"
                icon={SettingsIcon}
                onClick={() => handleProviderChange(opt.value)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  provider === opt.value
                    ? "bg-moss text-white"
                    : "border border-line bg-fog/40 text-ink hover:bg-fog",
                ].join(" ")}
              >
                {opt.label}
              </IconButton>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleSaveOpenRouter}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              OpenRouter
            </h2>
            <IconButton
              type="button"
              icon={RefreshCw}
              onClick={refreshModels}
              disabled={modelsLoading || !orForm.token_configured}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              Refresh models
            </IconButton>
          </div>

          <Field label="API key" id="openrouter_token">
            <input
              id="openrouter_token"
              type="password"
              autoComplete="off"
              value={orForm.token || ""}
              onChange={(e) => updateOrField("token", e.target.value)}
              className={inputClass}
              placeholder={orForm.token_configured ? "Saved on the API host" : "Paste API key"}
              spellCheck={false}
            />
          </Field>
          <p className="text-xs text-muted">
            {orForm.token_configured
              ? "An API key is saved on the API host. Paste a new key to replace it."
              : "Paste the OpenRouter API key here. It is saved on the API host, not in the browser."}
          </p>

          {modelsError ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
              Models: {modelsError}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default model" id="default_model">
              <ModelCombobox
                id="default_model"
                value={orForm.default_model}
                onChange={(v) => updateOrField("default_model", v)}
                models={models}
                loading={modelsLoading}
                placeholder="Search OpenRouter models…"
              />
            </Field>
            <Field label="App name" id="app_name">
              <input
                id="app_name"
                value={orForm.app_name}
                onChange={(e) => updateOrField("app_name", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Per-agent models</h3>
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
                    placeholder="Search OpenRouter models…"
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
            Save OpenRouter
          </IconButton>
        </form>

        <form
          onSubmit={handleSaveCursor}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Cursor API (SDK)
            </h2>
            <IconButton
              type="button"
              icon={RefreshCw}
              onClick={async () => {
                setCursorModelsLoading(true);
                setCursorModelsError(null);
                try {
                  const data = await fetchCursorModels({ force: true });
                  setCursorModels(data.models || []);
                } catch (err) {
                  setCursorModelsError(
                    err instanceof Error ? err.message : "Failed to load models",
                  );
                } finally {
                  setCursorModelsLoading(false);
                }
              }}
              disabled={cursorModelsLoading || !cursorForm.token_configured}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              Refresh models
            </IconButton>
          </div>

          <Field label="API key" id="cursor_token">
            <input
              id="cursor_token"
              type="password"
              autoComplete="off"
              value={cursorForm.token || ""}
              onChange={(e) =>
                setCursorForm((prev) => ({ ...prev, token: e.target.value }))
              }
              className={inputClass}
              placeholder={
                cursorForm.token_configured ? "Saved on the API host" : "Paste API key"
              }
              spellCheck={false}
            />
          </Field>
          <p className="text-xs text-muted">
            {cursorForm.token_configured
              ? "An API key is saved on the API host. Paste a new key to replace it."
              : "Paste the Cursor API key here. It is saved on the API host, not in the browser."}
          </p>

          {cursorModelsError ? (
            <p className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
              Models: {cursorModelsError}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default model" id="cursor_default_model">
              <ModelCombobox
                id="cursor_default_model"
                value={cursorForm.default_model}
                onChange={(v) =>
                  setCursorForm((prev) => ({ ...prev, default_model: v }))
                }
                models={cursorModels}
                loading={cursorModelsLoading}
                placeholder="Search Cursor models…"
              />
            </Field>
            <Field label="App name" id="cursor_app_name">
              <input
                id="cursor_app_name"
                value={cursorForm.app_name}
                onChange={(e) =>
                  setCursorForm((prev) => ({ ...prev, app_name: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Per-agent models</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {cursorAgentIds.map((agentId) => (
                <Field
                  key={agentId}
                  label={agentLabel(agentId)}
                  id={`cursor-agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`cursor-agent-${agentId}`}
                    value={cursorForm.agents?.[agentId]?.model || "auto"}
                    onChange={(v) =>
                      setCursorForm((prev) => ({
                        ...prev,
                        agents: {
                          ...prev.agents,
                          [agentId]: {
                            ...(prev.agents?.[agentId] || {}),
                            model: v,
                          },
                        },
                      }))
                    }
                    models={cursorModels}
                    loading={cursorModelsLoading}
                    placeholder="Search Cursor models…"
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
            Save Cursor API
          </IconButton>
        </form>
        </>
      ) : null}

      {activeSection === "database" ? (
        <form
          onSubmit={handleSaveDatabase}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Database
          </h2>

          <Field label="Engine" id="engine">
            <select
              id="engine"
              value={dbForm.engine || "sqlite"}
              onChange={(e) => updateDbField("engine", e.target.value)}
              className={inputClass}
            >
              {DB_ENGINES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          {dbForm.engine === "sqlite" ? (
            <p className="text-sm text-muted">
              AdventureWorks LT is the default database and is loaded automatically.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Host" id="host">
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
                <Field label="Port" id="port">
                  <input
                    id="port"
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => updateDbField("port", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label={dbForm.engine === "postgresql" ? "Database" : "Database"}
                  id="name"
                >
                  <input
                    id="name"
                    value={dbForm.name}
                    onChange={(e) => updateDbField("name", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {dbForm.engine === "postgresql" ? (
                  <Field label="SSL mode" id="sslmode">
                    <select
                      id="sslmode"
                      value={dbForm.sslmode || "prefer"}
                      onChange={(e) => updateDbField("sslmode", e.target.value)}
                      className={inputClass}
                    >
                      {SSL_MODES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Driver" id="driver">
                    <input
                      id="driver"
                      value={dbForm.driver}
                      onChange={(e) => updateDbField("driver", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                )}
                <Field label="User" id="user">
                  <input
                    id="user"
                    value={dbForm.user}
                    onChange={(e) => updateDbField("user", e.target.value)}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Password" id="password">
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
                    Encrypt
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
                    Trust server certificate
                  </label>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label htmlFor="conn" className="block text-sm font-medium text-ink">
              Connection string
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
            <p className="mt-1 text-xs text-muted">
              Edit and save to update host, port, database, user, and password fields.
            </p>
          </div>

          <IconButton
            type="submit"
            icon={Save}
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            Save Database
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
