import { useEffect, useState } from "react";
import {
  fetchDatabaseSettings,
  fetchOpenRouterSettings,
  saveDatabaseSettings,
  saveOpenRouterSettings,
} from "../api/client.js";

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

const AGENT_LABELS = {
  task_validator: "Task Validator",
  solution_strategist: "Solution Strategist",
  technical_architect: "Technical Architect",
  code_builder: "Code Builder",
  sql_guardian: "SQL Guardian",
  implementation_auditor: "Implementation Auditor",
  response_publisher: "Response Publisher",
};

export default function AdminPage() {
  const [dbForm, setDbForm] = useState(EMPTY_DB);
  const [connectionString, setConnectionString] = useState("");
  const [orForm, setOrForm] = useState(EMPTY_OPENROUTER);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dbData, orData] = await Promise.all([
          fetchDatabaseSettings(),
          fetchOpenRouterSettings(),
        ]);
        setDbForm({ ...EMPTY_DB, ...dbData.database });
        setConnectionString(dbData.connection_string || "");
        setOrForm({ ...EMPTY_OPENROUTER, ...orData.openrouter });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (loading) {
    return <p className="text-sm text-muted">Loading admin…</p>;
  }

  const agentIds = Object.keys(orForm.agents || {}).length
    ? Object.keys(orForm.agents)
    : Object.keys(AGENT_LABELS);

  return (
    <div className="max-w-6xl space-y-6">
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

      <form
        onSubmit={handleSaveOpenRouter}
        className="space-y-4 rounded-2xl border border-line/80 bg-paper/80 p-5 backdrop-blur-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          OpenRouter
        </h2>

        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            orForm.token_configured
              ? "border-line bg-fog/40 text-moss"
              : "border-warn-border bg-warn-bg text-warn"
          }`}
        >
          {orForm.token_configured
            ? "Token: set via OPENROUTER_TOKEN"
            : "Token: missing — set the OPENROUTER_TOKEN environment variable"}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default model" id="default_model">
            <input
              id="default_model"
              value={orForm.default_model}
              onChange={(e) => updateOrField("default_model", e.target.value)}
              className={inputClass}
              placeholder="openai/gpt-4o-mini"
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
          <h3 className="mb-3 text-sm font-medium text-ink">Per-agent models</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {agentIds.map((agentId) => (
              <Field
                key={agentId}
                label={AGENT_LABELS[agentId] || agentId}
                id={`agent-${agentId}`}
              >
                <input
                  id={`agent-${agentId}`}
                  value={orForm.agents?.[agentId]?.model || ""}
                  onChange={(e) => updateAgentModel(agentId, e.target.value)}
                  className={inputClass}
                  placeholder="provider/model-id"
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

      <form
        onSubmit={handleSaveDatabase}
        className="space-y-4 rounded-2xl border border-line/80 bg-paper/80 p-5 backdrop-blur-sm"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          SQL connection
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
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
            rows={3}
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
