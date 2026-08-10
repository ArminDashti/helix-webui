import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
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
import ModelCombobox from "../components/ModelCombobox.jsx";
import { useApiStatus } from "../context/ApiStatusContext.jsx";

const EMPTY_DB = {
  host: "",
  port: 1433,
  name: "",
  user: "",
  password: "",
  driver: "ODBC Driver 18 for SQL Server",
  trust_server_certificate: true,
  encrypt: true,
};

const EMPTY_OPENROUTER = {
  site_url: "",
  app_name: "Helix",
  default_model: "openai/gpt-4o-mini",
  agents: {},
  token_configured: false,
};

const EMPTY_CURSOR = {
  app_name: "Helix",
  default_model: "composer-2",
  agents: {},
  token_configured: false,
};

const AGENT_LABELS = {
  task_validator: "Task Validator",
  solution_strategist: "Solution Strategist",
  technical_architect: "Technical Architect",
  code_builder: "Code Builder",
  sql_guardian: "SQL Guardian",
  implementation_auditor: "Implementation Auditor",
  response_publisher: "Response Publisher",
};

const TABS = [
  { id: "provider", label: "Provider" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "cursor", label: "Cursor" },
  { id: "sql", label: "SQL" },
  { id: "connection", label: "Connection" },
];

const SERVICE_LABELS = {
  api: "helix-api",
  database: "Database",
  openrouter: "OpenRouter",
  cursor: "Cursor",
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeSection = TABS.some((t) => t.id === tabParam)
    ? tabParam
    : "provider";

  const { health, summary, checking, checkConnection } = useApiStatus();

  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [provider, setProvider] = useState("openrouter");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [cursorForm, setCursorForm] = useState(EMPTY_CURSOR);
  const [models, setModels] = useState([]);
  const [cursorModels, setCursorModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [cursorModelsLoading, setCursorModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [cursorModelsError, setCursorModelsError] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  function setActiveSection(id) {
    setSearchParams(id === "provider" ? {} : { tab: id }, { replace: true });
  }

  useEffect(() => {
    (async () => {
      const failures = [];
      let anyOk = false;

      try {
        const dbData = await fetchDatabaseSettings();
        setDbForm({ ...EMPTY_DB, ...dbData.database });
        setConnectionString(dbData.connection_string || "");
        anyOk = true;
      } catch (err) {
        failures.push(`SQL: ${err instanceof Error ? err.message : "Failed to load"}`);
      }

      try {
        const orData = await fetchOpenRouterSettings();
        setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter });
        anyOk = true;
      } catch (err) {
        failures.push(`OpenRouter: ${err instanceof Error ? err.message : "Failed to load"}`);
      }

      try {
        const cursorData = await fetchCursorSettings();
        setCursorForm({ ...EMPTY_CURSOR, ...cursorData.cursor });
        anyOk = true;
      } catch (err) {
        failures.push(`Cursor: ${err instanceof Error ? err.message : "Failed to load"}`);
      }

      try {
        const providerData = await fetchProviderSettings();
        setProvider(providerData.provider || "openrouter");
        anyOk = true;
      } catch (err) {
        failures.push(`Provider: ${err instanceof Error ? err.message : "Failed to load"}`);
      }

      setSectionErrors(failures);
      if (!anyOk && failures.length) {
        setError("API unreachable — could not load any settings section.");
      } else if (failures.length) {
        setError(null);
      }
      setLoading(false);
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

  function updateDbField(key, value) {
    setDbForm((prev) => ({ ...prev, [key]: value }));
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
      const data = await saveCursorSettings(payload);
      setCursorForm({ ...EMPTY_CURSOR, ...data.cursor });
      setStatus("Cursor API settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleSaveDatabase(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const payload = {
        ...dbForm,
        port: Number(dbForm.port) || 1433,
      };
      const data = await saveDatabaseSettings(payload);
      setDbForm({ ...EMPTY_DB, ...data.database });
      setConnectionString(data.connection_string || "");
      setStatus("SQL settings saved to helix.config.yaml.");
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
        site_url: orForm.site_url,
        app_name: orForm.app_name,
        default_model: orForm.default_model,
        agents: orForm.agents,
      };
      const data = await saveOpenRouterSettings(payload);
      setOrForm({ ...EMPTY_OPENROUTER, ...data.openrouter });
      setStatus("OpenRouter settings saved to helix.config.yaml.");
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

  const agentIds = Object.keys(orForm.agents || {}).length
    ? Object.keys(orForm.agents)
    : Object.keys(AGENT_LABELS);

  const cursorAgentIds = Object.keys(cursorForm.agents || {}).length
    ? Object.keys(cursorForm.agents)
    : Object.keys(AGENT_LABELS);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden md:flex-row">
      <aside className="flex shrink-0 flex-col gap-2 border-b border-line/80 bg-paper/50 p-2 md:w-1/4 md:min-w-[10rem] md:max-w-[16rem] md:border-b-0 md:border-r">
        <header className="shrink-0 px-1 pt-1">
          <h1 className="font-display text-lg text-ink sm:text-xl">Settings</h1>
        </header>
        <nav
          className="flex gap-1 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden"
          role="tablist"
          aria-label="Settings categories"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
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
            </button>
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
        {status ? (
          <p className="shrink-0 rounded-xl border border-line bg-paper/80 px-4 py-2 text-sm text-moss">
            {status}
          </p>
        ) : null}

      {activeSection === "provider" ? (
        <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Active LLM provider
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "openrouter", label: "OpenRouter" },
              { value: "cursor", label: "Cursor API" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleProviderChange(opt.value)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  provider === opt.value
                    ? "bg-moss text-white"
                    : "border border-line bg-fog/40 text-ink hover:bg-fog",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "openrouter" ? (
        <form
          onSubmit={handleSaveOpenRouter}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              OpenRouter
            </h2>
            <button
              type="button"
              onClick={refreshModels}
              disabled={modelsLoading || !orForm.token_configured}
              className="rounded-lg border border-line bg-fog px-3 py-1.5 text-xs font-medium hover:bg-fog/80 disabled:opacity-50"
            >
              Refresh models
            </button>
          </div>

          <p
            className={`rounded-xl border px-4 py-2 text-sm ${
              orForm.token_configured
                ? "border-line bg-fog/40 text-moss"
                : "border-warn-border bg-warn-bg text-warn"
            }`}
          >
            {orForm.token_configured
              ? "Token: set via OPENROUTER_TOKEN"
              : "Token: missing — set the OPENROUTER_TOKEN environment variable"}
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
            <Field label="Site URL" id="site_url">
              <input
                id="site_url"
                value={orForm.site_url}
                onChange={(e) => updateOrField("site_url", e.target.value)}
                className={inputClass}
                placeholder="https://example.com"
              />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Per-agent models</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {agentIds.map((agentId) => (
                <Field
                  key={agentId}
                  label={AGENT_LABELS[agentId] || agentId}
                  id={`agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`agent-${agentId}`}
                    value={orForm.agents?.[agentId]?.model || ""}
                    onChange={(v) => updateAgentModel(agentId, v)}
                    models={models}
                    loading={modelsLoading}
                    placeholder="Search OpenRouter models…"
                  />
                </Field>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            Save OpenRouter
          </button>
        </form>
      ) : null}

      {activeSection === "cursor" ? (
        <form
          onSubmit={handleSaveCursor}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Cursor API (SDK)
            </h2>
            <button
              type="button"
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
            </button>
          </div>

          <p
            className={`rounded-xl border px-4 py-2 text-sm ${
              cursorForm.token_configured
                ? "border-line bg-fog/40 text-moss"
                : "border-warn-border bg-warn-bg text-warn"
            }`}
          >
            {cursorForm.token_configured
              ? "API key: set via CURSOR_API_KEY"
              : "API key: missing — set the CURSOR_API_KEY environment variable"}
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
                  label={AGENT_LABELS[agentId] || agentId}
                  id={`cursor-agent-${agentId}`}
                >
                  <ModelCombobox
                    id={`cursor-agent-${agentId}`}
                    value={cursorForm.agents?.[agentId]?.model || ""}
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

          <button
            type="submit"
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            Save Cursor API
          </button>
        </form>
      ) : null}

      {activeSection === "sql" ? (
        <form
          onSubmit={handleSaveDatabase}
          className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            SQL connection
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Host" id="host">
              <input
                id="host"
                value={dbForm.host}
                onChange={(e) => updateDbField("host", e.target.value)}
                className={inputClass}
                placeholder="sql.example.com"
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
            <Field label="Database" id="name">
              <input
                id="name"
                value={dbForm.name}
                onChange={(e) => updateDbField("name", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Driver" id="driver">
              <input
                id="driver"
                value={dbForm.driver}
                onChange={(e) => updateDbField("driver", e.target.value)}
                className={inputClass}
              />
            </Field>
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

          <div>
            <label htmlFor="conn" className="block text-sm font-medium text-ink">
              Connection string (read-only preview)
            </label>
            <textarea
              id="conn"
              readOnly
              rows={2}
              value={connectionString}
              className="mt-1 w-full resize-y rounded-xl border border-line bg-fog/60 px-3 py-2 font-mono text-[12px] text-muted outline-none"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white hover:bg-moss-deep"
          >
            Save SQL
          </button>
        </form>
      ) : null}

      {activeSection === "connection" ? (
        <section className="space-y-3 rounded-2xl border border-line/80 bg-paper/80 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              API connection
            </h2>
            <button
              type="button"
              onClick={() => checkConnection({ silent: false })}
              disabled={checking}
              className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-deep disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check connection"}
            </button>
          </div>

          <p className="text-sm text-ink">
            Overall:{" "}
            <span className="font-medium capitalize">
              {checking ? "checking" : summary}
            </span>
          </p>

          <ul className="space-y-2">
            {["api", "database", "openrouter", "cursor"].map((key) => {
              const entry = health?.[key] || {
                status: summary === "disconnected" ? "disconnected" : "unknown",
              };
              const okish =
                entry.status === "connected" || entry.status === "configured";
              return (
                <li
                  key={key}
                  className={[
                    "rounded-xl border px-4 py-3 text-sm",
                    okish
                      ? "border-line bg-fog/40"
                      : "border-warn-border bg-warn-bg",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">
                      {SERVICE_LABELS[key] || key}
                    </span>
                    <span
                      className={okish ? "text-moss" : "text-warn"}
                    >
                      {entry.status || "unknown"}
                    </span>
                  </div>
                  {entry.detail ? (
                    <p className="mt-1 text-xs text-muted">{entry.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
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
