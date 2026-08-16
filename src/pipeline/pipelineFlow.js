import { agentCompanyLabel } from "../utils/agentLabel.js";

export const DEFAULT_EDGE_LIMIT = 3;

export const WHEN_OPTIONS = [
  { value: "always", label: "Always (on success)" },
  { value: "on_success", label: "Succeeded" },
  { value: "on_failure", label: "Failed" },
  { value: "on_retry", label: "Retry" },
  { value: "on_status", label: "Result is" },
];

export const STAGE_ACTIONS = [
  { value: "if", label: "IF" },
  { value: "if_not", label: "IF NOT" },
  { value: "proceed", label: "Go to" },
];

export const RESULT_OPS = [
  { value: "equal", label: "Equal" },
  { value: "not_equal", label: "Not Equal" },
];

export const THEN_ACTIONS = [
  { value: "proceed", label: "Go to" },
  { value: "stop", label: "STOP" },
];

export const EDGE_KINDS = [
  { value: "if", label: "IF", fields: ["when", "limit"] },
  { value: "forward", label: "Forward to agent", fields: ["target", "limit"] },
  { value: "back", label: "Back to agent", fields: ["when", "target", "limit"] },
  { value: "result_is", label: "Result is", fields: ["status", "target", "limit"] },
];

export function fieldsForKind(kind) {
  const found = EDGE_KINDS.find((k) => k.value === kind);
  return found ? found.fields : ["limit"];
}

export function inferEdgeKind(edge) {
  const raw = edge?.kind;
  if (raw && EDGE_KINDS.some((k) => k.value === raw)) return raw;
  const role = edge?.role;
  const type = edge?.when?.type || "always";
  if (role === "loop" || type === "on_retry") return "back";
  if (type === "on_status") return "result_is";
  if (role === "then" || role === "else") return "if";
  return "forward";
}

let _seq = 0;
export function nextId(prefix) {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

export function emptyStages() {
  return { type: "stages", children: [] };
}

export function emptySequence() {
  return emptyStages();
}

export function newStage(agentId, nextAgentId = "") {
  return {
    type: "stage",
    agent_id: agentId,
    action: "proceed",
    then: nextAgentId ? "proceed" : "stop",
    ...(nextAgentId ? { next_agent_id: nextAgentId } : {}),
  };
}

export function collectAgentIds(block, out = []) {
  if (!block) return out;
  if (block.type === "agent" && block.id) out.push(block.id);
  if (block.type === "stage") {
    if (block.agent_id) out.push(block.agent_id);
    if (block.next_agent_id) out.push(block.next_agent_id);
  }
  if (block.type === "stages" || block.type === "sequence") {
    for (const child of block.children || []) collectAgentIds(child, out);
  }
  if (block.type === "if") {
    collectAgentIds(block.then, out);
    collectAgentIds(block.else, out);
  }
  if (block.type === "loop") collectAgentIds(block.body, out);
  return out;
}

export function firstAgentId(block) {
  if (block?.type === "stages") {
    return block.children?.[0]?.agent_id || null;
  }
  const ids = collectAgentIds(block, []);
  return ids[0] || null;
}

export function cloneFlow(flow) {
  return JSON.parse(JSON.stringify(flow || emptyStages()));
}

export function insertStage(flow, index, stage) {
  const next = cloneFlow(flow);
  if (next.type !== "stages") next.type = "stages";
  if (!Array.isArray(next.children)) next.children = [];
  const at = Math.max(0, Math.min(index, next.children.length));
  next.children.splice(at, 0, stage);
  return next;
}

export function removeStage(flow, index) {
  const next = cloneFlow(flow);
  next.children.splice(index, 1);
  return next;
}

export function patchStage(flow, index, patch) {
  const next = cloneFlow(flow);
  const stage = { ...next.children[index], ...patch };
  if (stage.action === "proceed") {
    delete stage.result_op;
    delete stage.expected;
    delete stage.result_field;
    if (stage.then !== "stop") stage.then = "proceed";
  } else {
    stage.result_field = "result";
    stage.result_op = stage.result_op || "equal";
    if (stage.then !== "stop") stage.then = stage.then || "proceed";
  }
  if (stage.then === "stop") delete stage.next_agent_id;
  next.children[index] = stage;
  return next;
}

export function insertBlock(flow, seqPath, index, block) {
  if (flow?.type === "stages") {
    const stage =
      block?.type === "stage"
        ? block
        : newStage(block.id || block.agent_id, "");
    return insertStage(flow, index, stage);
  }
  return flow;
}

export function insertAfterAgent(flow, agentId, block) {
  if (flow?.type !== "stages") {
    return insertBlock(flow, [], (flow.children || []).length, block);
  }
  const idx = (flow.children || []).findIndex((s) => s.agent_id === agentId);
  const stage =
    block?.type === "stage" ? block : newStage(block.id || block.agent_id, "");
  return insertStage(flow, idx < 0 ? (flow.children || []).length : idx + 1, stage);
}

export function validateFlow(flow) {
  const errors = [];
  if (!flow || flow.type !== "stages") {
    errors.push("Arrange uses one IF per stage.");
    return errors;
  }
  const children = flow.children || [];
  if (!children.length) errors.push("Add at least one stage.");
  children.forEach((stage, index) => {
    if (stage.type !== "stage") {
      errors.push(`Stage ${index + 1} is invalid.`);
      return;
    }
    if (!stage.agent_id) errors.push(`Stage ${index + 1} needs an agent.`);
    if (!["if", "if_not", "proceed"].includes(stage.action)) {
      errors.push(`Stage ${index + 1} action must be IF, IF NOT, or Go to.`);
    }
    if (stage.action === "if" && children.filter((s) => s.action === "if").length) {
      /* counted below */
    }
    if (stage.action === "proceed") {
      if (stage.then !== "stop" && !stage.next_agent_id) {
        errors.push(`Stage ${index + 1} Go to needs a next agent.`);
      }
    } else {
      if (!stage.expected) errors.push(`Stage ${index + 1} needs a result value.`);
      if (!["equal", "not_equal"].includes(stage.result_op || "equal")) {
        errors.push(`Stage ${index + 1} Results must be Equal or Not Equal.`);
      }
      if (!["proceed", "stop"].includes(stage.then || "proceed")) {
        errors.push(`Stage ${index + 1} THEN must be Go to or STOP.`);
      }
      if ((stage.then || "proceed") === "proceed" && !stage.next_agent_id) {
        errors.push(`Stage ${index + 1} THEN Go to needs a next agent.`);
      }
    }
  });
  return errors;
}

export function layoutPositions(flow) {
  const positions = {};
  let y = 40;
  const ids = [];
  for (const stage of flow?.children || []) {
    if (stage.agent_id && !ids.includes(stage.agent_id)) ids.push(stage.agent_id);
    if (stage.next_agent_id && !ids.includes(stage.next_agent_id)) {
      ids.push(stage.next_agent_id);
    }
  }
  for (const id of ids) {
    positions[id] = { x: 80, y };
    y += 110;
  }
  return positions;
}

function applyPositions(nodes, positions) {
  return nodes.map((n) => ({
    ...n,
    position: positions[n.id] || n.position || { x: 0, y: 0 },
  }));
}

export function compileFlow(flow, positions = {}) {
  if (flow?.type !== "stages") {
    throw new Error("pipeline_flow must be stages");
  }
  const errs = validateFlow(flow);
  if (errs.length) throw new Error(errs[0]);
  const nodeIds = [];
  for (const stage of flow.children || []) {
    for (const id of [stage.agent_id, stage.next_agent_id]) {
      if (id && !nodeIds.includes(id)) nodeIds.push(id);
    }
  }
  if (!nodeIds.length) throw new Error("pipeline_flow must include at least one agent");
  const layout = layoutPositions(flow);
  const nodes = nodeIds.map((id) => ({
    id,
    position: positions[id] || layout[id] || { x: 0, y: 0 },
  }));
  const edges = [];
  (flow.children || []).forEach((stage, i) => {
    const thenAct = stage.then || "proceed";
    const target = stage.next_agent_id;
    if (thenAct === "stop" || !target) return;
    const source = stage.agent_id;
    let when = { type: "always" };
    let kind = "forward";
    if (stage.action !== "proceed") {
      let invert = stage.action === "if_not";
      if (stage.result_op === "not_equal") invert = !invert;
      when = { type: "on_status", status: stage.expected || "" };
      if (invert) when.invert = true;
      kind = "result_is";
    }
    edges.push({
      id: `e_stage_${i}_${source}_${target}`,
      source,
      target,
      direction: "forward",
      kind,
      when,
      limit: DEFAULT_EDGE_LIMIT,
    });
  });
  return {
    entry: nodeIds[0],
    nodes: applyPositions(nodes, positions),
    edges,
  };
}

export function mergeGraphPositions(graph, positions) {
  if (!graph) return positions;
  const next = { ...positions };
  for (const n of graph.nodes || []) {
    if (n.id && n.position) next[n.id] = { x: n.position.x, y: n.position.y };
  }
  return next;
}

export function edgeLabel(edge) {
  const kind = inferEdgeKind(edge.data ? { ...edge, ...edge.data } : edge);
  const when = edge.when || edge.data?.when || {};
  const cap = edge.limit ?? edge.data?.limit;
  const capSuffix = cap ? ` ×${cap}` : "";
  if (when.invert) return `IF NOT Result ${when.status || ""}${capSuffix}`;
  if (kind === "result_is") {
    return `IF Result Equal ${when.status || ""}${capSuffix}`;
  }
  if (kind === "if") return `IF${capSuffix}`;
  if (kind === "back") return `Back${capSuffix}`;
  return `Go to${capSuffix}`;
}

export function flowToDisplayGraph(flow, agentsById, positions = {}) {
  let compiled;
  try {
    compiled = compileFlow(flow, positions);
  } catch {
    return { nodes: [], edges: [] };
  }
  const nodes = compiled.nodes.map((n) => ({
    id: n.id,
    type: "agent",
    position: n.position,
    data: {
      agentId: n.id,
      label: agentCompanyLabel(agentsById[n.id]) || n.id,
    },
  }));
  const edges = compiled.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: edgeLabel(e),
    data: { ...e },
  }));
  return { nodes, edges };
}
