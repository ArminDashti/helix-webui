/**
 * API helpers. In dev, Vite proxies /api → Django :8000.
 * Absolute VITE_API_BASE_URL still supported when set.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const errorListeners = new Set();

export function subscribeApiErrors(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function emitApiError(err) {
  for (const listener of errorListeners) {
    try {
      listener(err);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export class ApiError extends Error {
  /**
   * @param {{ kind: string, title: string, message: string, status?: number, detail?: string, path?: string }} opts
   */
  constructor({ kind, title, message, status, detail, path }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.title = title;
    this.status = status ?? null;
    this.detail = detail || "";
    this.path = path || "";
  }
}

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

function httpTitle(status) {
  if (status === 400) return "Request rejected";
  if (status === 401 || status === 403) return "Not authorized";
  if (status === 404) return "Not found";
  if (status === 502 || status === 503) return "Upstream provider error";
  if (status >= 500) return "Server error";
  return "API error";
}

function toApiError(err, path) {
  if (err instanceof ApiError) return err;
  return new ApiError({
    kind: "network",
    title: "Cannot reach helix-api",
    message: "API host unreachable — is the server running?",
    detail: err instanceof Error ? err.message : String(err || "Failed to fetch"),
    path,
  });
}

/**
 * @param {string} path
 * @param {RequestInit & { silent?: boolean }} [options]
 */
async function apiFetch(path, options = {}) {
  const { silent = false, ...fetchOpts } = options;
  const url = apiUrl(path);
  let response;
  try {
    response = await fetch(url, fetchOpts);
  } catch (err) {
    const apiErr = toApiError(err, path);
    if (!silent) emitApiError(apiErr);
    throw apiErr;
  }
  return response;
}

async function parseJson(response, path, { silent = false } = {}) {
  const text = await response.text();
  let data = null;
  if (text) {
    const trimmed = text.trim();
    const looksLikeHtml =
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<HTML") ||
      /<head>[\s\S]*<title>\s*404/i.test(trimmed);
    if (looksLikeHtml) {
      const apiErr = new ApiError({
        kind: "parse",
        status: response.status,
        title: "API misconfigured",
        message: "Got HTML instead of JSON — check the API proxy or base URL.",
        detail: `HTTP ${response.status}`,
        path,
      });
      if (!silent) emitApiError(apiErr);
      throw apiErr;
    }
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    const serverMsg =
      (data && typeof data.error === "string" && data.error) ||
      `API error ${response.status}`;
    const kind =
      response.status === 502 || response.status === 503 ? "server" : "http";
    const apiErr = new ApiError({
      kind,
      status: response.status,
      title: httpTitle(response.status),
      message: serverMsg,
      detail: `HTTP ${response.status}`,
      path,
    });
    if (!silent) emitApiError(apiErr);
    throw apiErr;
  }
  return data;
}

async function requestJson(path, options = {}) {
  const { silent = false, ...fetchOpts } = options;
  const response = await apiFetch(path, { ...fetchOpts, silent });
  return parseJson(response, path, { silent });
}

export async function fetchHealth({ silent = false } = {}) {
  return requestJson("/api/health/", { silent });
}

export async function fetchAgents() {
  const data = await requestJson("/api/agents/");
  return data.agents;
}

export async function createAgent({ id, name, description = "", instruction = "" }) {
  return requestJson("/api/agents/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, description, instruction }),
  });
}

export async function deleteAgent(agentId) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "DELETE",
  });
}

export async function renameAgent(agentId, name) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function setAgentDisabled(agentId, disabled) {
  return requestJson(`/api/agents/${encodeURIComponent(agentId)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
}

export async function updateAgentInstruction(agentId, instruction) {
  return requestJson(
    `/api/agents/${encodeURIComponent(agentId)}/instruction/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    },
  );
}

export async function fetchReferences() {
  const data = await requestJson("/api/references/");
  return data.references;
}

export async function createReference(name, content = "") {
  return requestJson("/api/references/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
}

export async function updateReference(name, content) {
  return requestJson(`/api/references/${encodeURIComponent(name)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deleteReference(name) {
  const path = `/api/references/${encodeURIComponent(name)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function fetchRules() {
  const data = await requestJson("/api/rules/");
  return data.rules;
}

export async function createRule(id, { content = "", agents = [], name = "", disabled = false } = {}) {
  return requestJson("/api/rules/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, content, agents, name, disabled }),
  });
}

export async function updateRule(id, { content, agents, name, disabled }) {
  return requestJson(`/api/rules/${encodeURIComponent(id)}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, agents, name, disabled }),
  });
}

export async function renameRule(id, newId) {
  return requestJson(`/api/rules/${encodeURIComponent(id)}/rename/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_id: newId }),
  });
}

export async function deleteRule(id) {
  const path = `/api/rules/${encodeURIComponent(id)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function fetchSkills(scope) {
  const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const data = await requestJson(`/api/skills/${qs}`);
  return data.skills;
}

export async function createSkill({
  id,
  scope,
  content = "",
  agents = [],
  name = "",
  disabled = false,
}) {
  return requestJson("/api/skills/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, scope, content, agents, name, disabled }),
  });
}

export async function updateSkill(scope, id, { content, agents, name, disabled }) {
  return requestJson(
    `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, agents, name, disabled }),
    },
  );
}

export async function renameSkill(scope, id, newId) {
  return requestJson(
    `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/rename/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_id: newId }),
    },
  );
}

export async function deleteSkill(scope, id) {
  const path = `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`;
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseJson(res, path);
  }
}

export async function saveRuleAssignments(assignments) {
  return requestJson("/api/rules/assignments/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
}

export async function fetchDatabaseSettings() {
  return requestJson("/api/admin/database/");
}

export async function saveDatabaseSettings(database) {
  return requestJson("/api/admin/database/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database }),
  });
}

export async function fetchProviderSettings() {
  return requestJson("/api/admin/provider/");
}

export async function saveProvider(provider) {
  return requestJson("/api/admin/provider/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
}

export async function fetchOpenRouterSettings() {
  return requestJson("/api/admin/openrouter/");
}

export async function saveOpenRouterSettings(openrouter) {
  return requestJson("/api/admin/openrouter/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openrouter }),
  });
}

export async function fetchOpenRouterModels({ force = false } = {}) {
  const qs = force ? "?force=1" : "";
  return requestJson(`/api/admin/openrouter/models/${qs}`);
}

export async function fetchCursorSettings() {
  return requestJson("/api/admin/cursor/");
}

export async function saveCursorSettings(cursor) {
  return requestJson("/api/admin/cursor/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cursor }),
  });
}

export async function fetchCursorModels({ force = false } = {}) {
  const qs = force ? "?force=1" : "";
  return requestJson(`/api/admin/cursor/models/${qs}`);
}

export async function fetchPipelineGraph() {
  const data = await requestJson("/api/admin/pipeline-graph/");
  return data.pipeline_graph;
}

export async function savePipelineGraph(pipeline_graph) {
  const data = await requestJson("/api/admin/pipeline-graph/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline_graph }),
  });
  return data.pipeline_graph;
}

export async function resetPipelineGraph() {
  const data = await requestJson("/api/admin/pipeline-graph/", {
    method: "DELETE",
  });
  return data.pipeline_graph;
}

export async function fetchDocsTables() {
  return requestJson("/api/docs/tables/");
}

export async function fetchDocsTable(table) {
  return requestJson(`/api/docs/tables/${encodeURIComponent(table)}/`);
}

export async function saveDocsTableOverview(table, overview) {
  return requestJson(`/api/docs/tables/${encodeURIComponent(table)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overview }),
  });
}

export async function fetchResults() {
  const data = await requestJson("/api/results/");
  return data.results || [];
}

export async function fetchResult(resultId) {
  return requestJson(`/api/results/${encodeURIComponent(resultId)}/`);
}

export async function createResult(payload) {
  return requestJson("/api/results/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function setResultArchived(resultId, archived) {
  return requestJson(`/api/results/${encodeURIComponent(resultId)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
}

export async function fetchDbExplorerTables() {
  return requestJson("/api/db-explorer/tables/");
}

export async function fetchDbExplorerColumns(table) {
  const qs = `?table=${encodeURIComponent(table)}`;
  return requestJson(`/api/db-explorer/columns/${qs}`);
}

export async function runDbExplorerQuery(payload) {
  return requestJson("/api/db-explorer/query/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Stream a run via SSE (POST). Calls onEvent for each parsed JSON payload.
 * @returns {Promise<{mode: string, text_report: string|null, echarts_option: object|null, grid?: object|null, used_demo?: boolean}>}
 */
export async function streamRun(
  {
    prompt,
    mode,
    language = "en",
    report_type,
    chart_type,
    columns,
  },
  onEvent,
  signal,
) {
  const path = "/api/runs/stream";
  const body = { prompt, mode, language };
  if (report_type) body.report_type = report_type;
  if (chart_type) body.chart_type = chart_type;
  if (columns?.length) body.columns = columns;

  let response;
  try {
    response = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw toApiError(err, path);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.error || text;
    } catch {
      /* keep text */
    }
    const apiErr = new ApiError({
      kind: "stream",
      status: response.status,
      title: httpTitle(response.status),
      message: message || `API error ${response.status}`,
      detail: `HTTP ${response.status}`,
      path,
    });
    emitApiError(apiErr);
    throw apiErr;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const chunk of parts) {
      const line = chunk
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      onEvent?.(payload);
      if (payload.event === "result") {
        result = payload;
      }
      if (payload.event === "error") {
        const apiErr = new ApiError({
          kind: "stream",
          title: "Run stream failed",
          message: payload.message || "Run failed",
          path,
        });
        emitApiError(apiErr);
        throw apiErr;
      }
    }
  }

  if (!result) {
    const apiErr = new ApiError({
      kind: "stream",
      title: "Run stream failed",
      message: "Stream ended without a result",
      path,
    });
    emitApiError(apiErr);
    throw apiErr;
  }
  return result;
}

/** Sample payload so the UI can be reviewed without a running backend. */
export function getDemoResult(
  mode,
  { language = "en", report_type = "summary", chart_type = "bar", columns } = {},
) {
  const normalized =
    mode === "analysis"
      ? "analytical_report"
      : mode === "both"
        ? "analytical_report_chart"
        : mode || "auto";

  const title = language === "fa" ? "درآمد بر اساس منطقه" : "Revenue by region";
  const cats =
    language === "fa"
      ? ["شمال", "جنوب", "شرق", "غرب"]
      : ["North", "South", "East", "West"];
  const values = [420, 310, 510, 280];

  const echarts_option = {
    color: ["#3d9b82", "#5cb89a", "#7ab89f"],
    backgroundColor: "transparent",
    title: {
      text: title,
      left: "center",
      textStyle: { color: "#e6ebe9", fontWeight: 600, fontSize: 16 },
    },
    tooltip: {
      trigger: chart_type === "pie" || chart_type === "donut" ? "item" : "axis",
      backgroundColor: "#24302d",
      borderColor: "#3a4a45",
      textStyle: { color: "#e6ebe9" },
    },
    grid: { left: 48, right: 24, top: 56, bottom: 40 },
    xAxis: {
      type: "category",
      data: cats,
      axisLabel: { color: "#9aada6" },
      axisLine: { lineStyle: { color: "#3a4a45" } },
    },
    yAxis: {
      type: "value",
      name: language === "fa" ? "واحد" : "USD",
      nameTextStyle: { color: "#9aada6" },
      axisLabel: { color: "#9aada6" },
      splitLine: { lineStyle: { color: "#3a4a45" } },
      axisLine: { lineStyle: { color: "#3a4a45" } },
    },
    series: [
      {
        name: language === "fa" ? "درآمد" : "Revenue",
        type: chart_type === "line" || chart_type === "area" ? "line" : "bar",
        data: values,
        ...(chart_type === "area" ? { areaStyle: {} } : {}),
        barWidth: "48%",
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };

  const text_report =
    language === "fa"
      ? "شرق بیشترین درآمد را دارد. غرب نیاز به بهبود دارد. (نمونه دمو)"
      : "North and East lead revenue this period. East is highest at 510; West trails at 280. (Demo sample — backend not connected.)";

  const cols = columns?.length
    ? columns
    : language === "fa"
      ? ["منطقه", "درآمد", "واحد"]
      : ["Region", "Revenue", "Units"];
  const grid = {
    columns: cols,
    rows: cats.map((region, i) => ({
      [cols[0]]: region,
      [cols[1]]: values[i],
      [cols[2]]: [12, 9, 15, 7][i],
    })),
  };

  if (normalized === "analytical_report") {
    return {
      mode: normalized,
      language,
      text_report,
      echarts_option: null,
      grid: null,
      report_type,
    };
  }
  if (normalized === "chart") {
    return {
      mode: normalized,
      language,
      text_report: null,
      echarts_option,
      grid: null,
      chart_type,
    };
  }
  if (normalized === "grid") {
    return {
      mode: normalized,
      language,
      text_report: null,
      echarts_option: null,
      grid,
    };
  }
  return {
    mode: normalized === "auto" ? "auto" : "analytical_report_chart",
    language,
    text_report,
    echarts_option,
    grid: null,
    report_type,
    chart_type,
  };
}
