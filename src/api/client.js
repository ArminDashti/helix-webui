/**
 * API helpers. In dev, Vite proxies /api → Django :8000.
 * Absolute VITE_API_BASE_URL still supported when set.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

async function parseJson(response) {
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
      throw new Error(`API error ${response.status}`);
    }
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    throw new Error(data?.error || `API error ${response.status}`);
  }
  return data;
}

export async function fetchAgents() {
  const res = await fetch(apiUrl("/api/agents/"));
  const data = await parseJson(res);
  return data.agents;
}

export async function saveAgentInstruction(agentId, instruction) {
  const res = await fetch(apiUrl(`/api/agents/${agentId}/instruction/`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });
  return parseJson(res);
}

export async function fetchReferences() {
  const res = await fetch(apiUrl("/api/references/"));
  const data = await parseJson(res);
  return data.references;
}

export async function createReference(name, content = "") {
  const res = await fetch(apiUrl("/api/references/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  return parseJson(res);
}

export async function updateReference(name, content) {
  const res = await fetch(apiUrl(`/api/references/${encodeURIComponent(name)}/`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return parseJson(res);
}

export async function deleteReference(name) {
  const res = await fetch(apiUrl(`/api/references/${encodeURIComponent(name)}/`), {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    await parseJson(res);
  }
}

export async function fetchRules() {
  const res = await fetch(apiUrl("/api/rules/"));
  const data = await parseJson(res);
  return data.rules;
}

export async function createRule(id, content = "", agents = []) {
  const res = await fetch(apiUrl("/api/rules/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, content, agents }),
  });
  return parseJson(res);
}

export async function updateRule(id, { content, agents }) {
  const res = await fetch(apiUrl(`/api/rules/${encodeURIComponent(id)}/`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, agents }),
  });
  return parseJson(res);
}

export async function deleteRule(id) {
  const res = await fetch(apiUrl(`/api/rules/${encodeURIComponent(id)}/`), {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    await parseJson(res);
  }
}

export async function fetchSkills(scope) {
  const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  const res = await fetch(apiUrl("/api/skills/") + qs);
  const data = await parseJson(res);
  return data.skills;
}

export async function createSkill(id, scope, content = "") {
  const res = await fetch(apiUrl("/api/skills/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, scope, content }),
  });
  return parseJson(res);
}

export async function updateSkill(scope, id, content) {
  const res = await fetch(
    apiUrl(`/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  return parseJson(res);
}

export async function deleteSkill(scope, id) {
  const res = await fetch(
    apiUrl(`/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/`),
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) {
    await parseJson(res);
  }
}

export async function saveRuleAssignments(assignments) {
  const res = await fetch(apiUrl("/api/rules/assignments/"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
  return parseJson(res);
}

export async function fetchDatabaseSettings() {
  const res = await fetch(apiUrl("/api/admin/database/"));
  return parseJson(res);
}

export async function saveDatabaseSettings(database) {
  const res = await fetch(apiUrl("/api/admin/database/"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database }),
  });
  return parseJson(res);
}

export async function fetchOpenRouterSettings() {
  const res = await fetch(apiUrl("/api/admin/openrouter/"));
  return parseJson(res);
}

export async function saveOpenRouterSettings(openrouter) {
  const res = await fetch(apiUrl("/api/admin/openrouter/"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openrouter }),
  });
  return parseJson(res);
}

/**
 * Stream a run via SSE (POST). Calls onEvent for each parsed JSON payload.
 * @returns {Promise<{mode: string, text_report: string|null, echarts_option: object|null, used_demo?: boolean}>}
 */
export async function streamRun({ prompt, mode }, onEvent, signal) {
  const response = await fetch(apiUrl("/api/runs/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ prompt, mode }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.error || text;
    } catch {
      /* keep text */
    }
    throw new Error(message || `API error ${response.status}`);
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
        throw new Error(payload.message || "Run failed");
      }
    }
  }

  if (!result) {
    throw new Error("Stream ended without a result");
  }
  return result;
}

/** Sample payload so the UI can be reviewed without a running backend. */
export function getDemoResult(mode) {
  const echarts_option = {
    color: ["#3d9b82", "#5cb89a", "#7ab89f"],
    title: {
      text: "Revenue by region",
      left: "center",
      textStyle: { color: "#e6ebe9", fontWeight: 600, fontSize: 16 },
    },
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 24, top: 56, bottom: 40 },
    xAxis: {
      type: "category",
      data: ["North", "South", "East", "West"],
      axisLabel: { color: "#9aada6" },
    },
    yAxis: {
      type: "value",
      name: "USD",
      axisLabel: { color: "#9aada6" },
      splitLine: { lineStyle: { color: "#3a4a45" } },
    },
    series: [
      {
        name: "Revenue",
        type: "bar",
        data: [420, 310, 510, 280],
        barWidth: "48%",
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
    backgroundColor: "transparent",
  };

  const text_report =
    "North and East lead revenue this period. East is highest at 510; West trails at 280. " +
    "Focus follow-up on West conversion and East capacity. (Demo sample — backend not connected.)";

  if (mode === "analysis") {
    return { mode, text_report, echarts_option: null };
  }
  if (mode === "chart") {
    return { mode, text_report: null, echarts_option };
  }
  return { mode: "both", text_report, echarts_option };
}
