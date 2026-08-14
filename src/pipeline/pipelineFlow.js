export const DEFAULT_EDGE_LIMIT = 3;

export const WHEN_OPTIONS = [
  { value: "always", label: "Always (on success)" },
  { value: "on_success", label: "Succeeded" },
  { value: "on_failure", label: "Failed" },
  { value: "on_retry", label: "Retry" },
  { value: "on_status", label: "Result is" },
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

export function emptySequence() {
  return { type: "sequence", children: [] };
}

export function newAgent(id) {
  return { type: "agent", id };
}

export function newIf() {
  return {
    type: "if",
    id: nextId("if"),
    when: { type: "on_failure" },
    limit: DEFAULT_EDGE_LIMIT,
    then: emptySequence(),
    else: emptySequence(),
  };
}

export function newLoop() {
  return {
    type: "loop",
    id: nextId("loop"),
    when: { type: "on_retry" },
    limit: DEFAULT_EDGE_LIMIT,
    body: emptySequence(),
  };
}

export function collectAgentIds(block, out = []) {
  if (!block) return out;
  if (block.type === "agent" && block.id) out.push(block.id);
  if (block.type === "sequence") {
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
  const ids = collectAgentIds(block, []);
  return ids[0] || null;
}

export function cloneFlow(flow) {
  return JSON.parse(JSON.stringify(flow || emptySequence()));
}

function getSequence(root, path) {
  if (!path.length) {
    if (root.type !== "sequence") {
      throw new Error("Root flow must be a sequence");
    }
    return root;
  }
  let seq = root;
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    if (typeof key === "number") {
      const child = seq.children[key];
      if (!child) throw new Error("Invalid flow path");
      if (i === path.length - 1) return seq;
      seq = child;
    } else if (key === "then" || key === "else") {
      if (seq.type !== "if") throw new Error("Invalid flow path");
      seq = seq[key];
    } else if (key === "body") {
      if (seq.type !== "loop") throw new Error("Invalid flow path");
      seq = seq.body;
    } else {
      throw new Error("Invalid flow path");
    }
  }
  if (seq.type !== "sequence") throw new Error("Path does not point at a sequence");
  return seq;
}

export function insertBlock(flow, seqPath, index, block) {
  const next = cloneFlow(flow);
  const seq = getSequence(next, seqPath);
  const at = Math.max(0, Math.min(index, seq.children.length));
  seq.children.splice(at, 0, block);
  return next;
}

export function removeAt(flow, seqPath, index) {
  const next = cloneFlow(flow);
  const seq = getSequence(next, seqPath);
  seq.children.splice(index, 1);
  return next;
}

export function moveWithin(flow, seqPath, fromIndex, toIndex) {
  const next = cloneFlow(flow);
  const seq = getSequence(next, seqPath);
  if (fromIndex < 0 || fromIndex >= seq.children.length) return next;
  const [item] = seq.children.splice(fromIndex, 1);
  const at = Math.max(0, Math.min(toIndex, seq.children.length));
  seq.children.splice(at, 0, item);
  return next;
}

export function updateAt(flow, seqPath, index, patch) {
  const next = cloneFlow(flow);
  const seq = getSequence(next, seqPath);
  seq.children[index] = { ...seq.children[index], ...patch };
  return next;
}

export function findBlockPath(flow, predicate, seqPath = []) {
  const children = flow?.children || [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (predicate(child)) return { seqPath, index };
    if (child.type === "if") {
      const t = findBlockPath(child.then, predicate, [...seqPath, index, "then"]);
      if (t) return t;
      const e = findBlockPath(child.else, predicate, [...seqPath, index, "else"]);
      if (e) return e;
    }
    if (child.type === "loop") {
      const b = findBlockPath(child.body, predicate, [...seqPath, index, "body"]);
      if (b) return b;
    }
  }
  return null;
}

export function wrapAgentInLoop(flow, agentId) {
  const found = findBlockPath(flow, (b) => b.type === "agent" && b.id === agentId);
  if (!found) return flow;
  const next = cloneFlow(flow);
  const seq = getSequence(next, found.seqPath);
  const block = seq.children[found.index];
  seq.children[found.index] = { ...newLoop(), body: { type: "sequence", children: [block] } };
  return next;
}

export function insertAfterAgent(flow, agentId, block) {
  const found = findBlockPath(flow, (b) => b.type === "agent" && b.id === agentId);
  if (!found) {
    return insertBlock(flow, [], (flow.children || []).length, block);
  }
  return insertBlock(flow, found.seqPath, found.index + 1, block);
}

export function validateFlow(flow) {
  const errors = [];
  const ids = collectAgentIds(flow, []);
  if (!ids.length) errors.push("Add at least one agent.");
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) errors.push(`Agent ${dup} is already on the flow.`);

  function walk(block, parentKind) {
    if (!block) return;
    if (block.type === "sequence") {
      (block.children || []).forEach((child, i) => {
        if (child.type === "if") {
          const before = (block.children || []).slice(0, i);
          const hasAgentBefore =
            parentKind === "root"
              ? before.some(
                  (c) =>
                    c.type === "agent" ||
                    c.type === "loop" ||
                    (c.type === "if" && collectAgentIds(c, []).length),
                )
              : true;
          if (!hasAgentBefore && parentKind === "root" && i === 0) {
            errors.push("If / Else needs an agent before it.");
          }
          const thenN = collectAgentIds(child.then, []).length;
          const elseN = collectAgentIds(child.else, []).length;
          if (thenN === 0 && elseN > 0) {
            errors.push("If / Else needs a Then branch when Else is filled.");
          }
          walk(child.then, "then");
          walk(child.else, "else");
        } else if (child.type === "loop") {
          if (!collectAgentIds(child.body, []).length) {
            errors.push("Loop needs at least one agent in its body.");
          }
          walk(child.body, "body");
        }
      });
    }
  }
  walk(flow, "root");
  return errors;
}

export function layoutPositions(flow) {
  const positions = {};
  let y = 40;
  function walk(block, depth) {
    if (!block) return;
    if (block.type === "agent") {
      positions[block.id] = { x: 80 + depth * 48, y };
      y += 110;
      return;
    }
    if (block.type === "sequence") {
      for (const child of block.children || []) walk(child, depth);
      return;
    }
    if (block.type === "if") {
      walk(block.then, depth + 1);
      walk(block.else, depth + 1);
      return;
    }
    if (block.type === "loop") walk(block.body, depth + 1);
  }
  walk(flow, 0);
  return positions;
}

function applyPositions(nodes, positions) {
  return nodes.map((n) => ({
    ...n,
    position: positions[n.id] || n.position || { x: 0, y: 0 },
  }));
}

/** Compile flow to pipeline_graph (mirrors backend kinds / first-match order). */
export function compileFlow(flow, positions = {}) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const usedEdgeIds = new Set();
  let y = 0;

  function addAgent(id, depth) {
    if (seen.has(id)) throw new Error(`Duplicate node id: ${id}`);
    seen.add(id);
    const pos = positions[id] || { x: depth * 48, y };
    y = Math.max(y, pos.y + 100);
    nodes.push({ id, position: pos });
  }

  function addEdge(source, target, when, extra = {}) {
    const role = extra.role;
    const kind =
      extra.kind ||
      inferEdgeKind({ role, when, kind: extra.kind });
    const limit = extra.limit != null ? extra.limit : DEFAULT_EDGE_LIMIT;
    let id = extra.id;
    if (!id) {
      if (kind === "forward") id = `e_fwd_${source}_${target}`;
      else if (kind === "back") id = `e_back_${extra.blockId || source}`;
      else if (kind === "result_is") {
        id = extra.blockId
          ? `e_result_${extra.blockId}_${role || "then"}`
          : `e_result_${source}_${target}`;
      } else if (kind === "if" && extra.blockId && role) {
        id = `e_if_${extra.blockId}_${role}`;
      } else id = `e_${kind}_${source}_${target}`;
    }
    if (usedEdgeIds.has(id)) id = `${id}_${usedEdgeIds.size}`;
    usedEdgeIds.add(id);
    const edge = {
      id,
      source,
      target,
      direction: kind === "back" ? "back" : "forward",
      kind,
      when: when || { type: "always" },
      limit,
    };
    if (role) edge.role = role;
    edges.push(edge);
  }

  function compileSeq(seq, incoming, depth) {
    let exits = incoming;
    for (const child of seq.children || []) {
      if (child.type === "agent") {
        addAgent(child.id, depth);
        for (const item of exits) {
          addEdge(item.source, child.id, item.when, item);
        }
        exits = [
          {
            source: child.id,
            when: { type: "always" },
            kind: "forward",
            limit: child.forward_limit ?? DEFAULT_EDGE_LIMIT,
          },
        ];
      } else if (child.type === "if") {
        if (!exits.length) throw new Error("If / Else needs an agent before it");
        const thenN = collectAgentIds(child.then, []).length;
        const elseN = collectAgentIds(child.else, []).length;
        if (!thenN && !elseN) continue;
        const ifWhen = child.when || { type: "always" };
        const ifLimit = child.limit ?? DEFAULT_EDGE_LIMIT;
        const thenKind = ifWhen.type === "on_status" ? "result_is" : "if";
        const thenIn = exits.map((item) => ({
          source: item.source,
          when: ifWhen,
          role: "then",
          kind: thenKind,
          limit: ifLimit,
          blockId: child.id,
          id:
            thenKind === "result_is"
              ? `e_result_${child.id}_then`
              : `e_if_${child.id}_then`,
        }));
        const elseIn = exits.map((item) => ({
          source: item.source,
          when: { type: "always" },
          role: "else",
          kind: "if",
          limit: ifLimit,
          blockId: child.id,
          id: `e_if_${child.id}_else`,
        }));
        const thenExits = compileSeq(child.then || emptySequence(), thenIn, depth + 1);
        const elseExits = elseN
          ? compileSeq(child.else || emptySequence(), elseIn, depth + 1)
          : [];
        exits = [...thenExits, ...elseExits];
      } else if (child.type === "loop") {
        const first = firstAgentId(child.body);
        if (!first) throw new Error("Loop needs at least one agent in its body");
        const bodyExits = compileSeq(child.body || emptySequence(), exits, depth + 1);
        const lasts = [];
        for (const item of bodyExits) {
          if (item.source && !lasts.includes(item.source)) lasts.push(item.source);
        }
        const loopLimit = child.limit ?? child.max_visits ?? DEFAULT_EDGE_LIMIT;
        for (const last of lasts) {
          addEdge(last, first, child.when || { type: "on_retry" }, {
            role: "loop",
            kind: "back",
            limit: loopLimit,
            blockId: child.id,
            id: lasts.length === 1 ? `e_back_${child.id}` : `e_back_${child.id}_${last}`,
          });
        }
        exits = bodyExits;
      }
    }
    return exits;
  }

  compileSeq(flow, [], 0);
  if (!nodes.length) throw new Error("pipeline_flow must include at least one agent");
  return {
    entry: firstAgentId(flow) || nodes[0].id,
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
  const cap = edge.limit ?? edge.data?.limit ?? edge.max_visits ?? edge.data?.max_visits;
  const capSuffix = cap ? ` ×${cap}` : "";
  if (kind === "if") {
    const role = edge.role || edge.data?.role;
    const branch = role === "else" ? "Else" : "IF";
    return `${branch} · ${when.type || "when"}${capSuffix}`;
  }
  if (kind === "back") return `Back${capSuffix}`;
  if (kind === "result_is") {
    const status = when.status || "result";
    return `Result is ${status}${capSuffix}`;
  }
  return `Forward${capSuffix}`;
}

/** React Flow nodes/edges for Graph view (control nodes are visual-only). */
export function flowToDisplayGraph(flow, agentsById, positions = {}) {
  const nodes = [];
  const edges = [];
  let absY = 40;
  let e = 0;
  const relFrames = [];

  function nextPosition(id, depth, parentId) {
    if (parentId) {
      const frame = relFrames[relFrames.length - 1];
      const p = { x: 20, y: frame.y };
      frame.y += 100;
      return p;
    }
    if (positions[id] && id.indexOf("if_") !== 0 && id.indexOf("loop_") !== 0) {
      const p = positions[id];
      absY = Math.max(absY, p.y + 110);
      return p;
    }
    const p = { x: 80 + depth * 56, y: absY };
    absY += 110;
    return p;
  }

  function link(source, target, role, when, extra, handles = {}) {
    e += 1;
    edges.push({
      id: `rf_${source}_${target}_${e}`,
      source,
      target,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      label: edgeLabel({ role, when, kind: extra.kind, limit: extra.limit, ...extra }),
      data: { role, when, kind: extra.kind, limit: extra.limit, ...extra },
    });
  }

  function walkSeq(seq, incoming, depth, parentId) {
    let exits = incoming;
    for (const child of seq.children || []) {
      if (child.type === "agent") {
        nodes.push({
          id: child.id,
          type: "agent",
          position: nextPosition(child.id, depth, parentId),
          parentId,
          extent: parentId ? "parent" : undefined,
          data: {
            agentId: child.id,
            label: agentsById[child.id]?.name || child.id,
          },
        });
        for (const item of exits) {
          link(item.source, child.id, item.role, item.when, item.extra || {}, {
            sourceHandle: item.sourceHandle,
          });
        }
        exits = [{ source: child.id, when: { type: "always" }, kind: "forward", extra: { limit: child.forward_limit } }];
      } else if (child.type === "if") {
        const thenN = collectAgentIds(child.then, []).length;
        const elseN = collectAgentIds(child.else, []).length;
        if (!thenN && !elseN) continue;
        nodes.push({
          id: child.id,
          type: "branch",
          position: nextPosition(child.id, depth, parentId),
          parentId,
          extent: parentId ? "parent" : undefined,
          data: { when: child.when, label: "If" },
        });
        for (const item of exits) {
          link(item.source, child.id, item.role, item.when, item.extra || {});
        }
        const thenFirst = firstAgentId(child.then);
        const elseFirst = firstAgentId(child.else);
        const thenExits = walkSeq(
          child.then || emptySequence(),
          thenFirst
            ? [
                {
                  source: child.id,
                  when: child.when,
                  role: "then",
                  kind: child.when?.type === "on_status" ? "result_is" : "if",
                  extra: { limit: child.limit },
                  sourceHandle: "then",
                },
              ]
            : [],
          depth + 1,
          parentId,
        );
        const elseExits = walkSeq(
          child.else || emptySequence(),
          elseFirst
            ? [
                {
                  source: child.id,
                  when: { type: "always" },
                  role: "else",
                  kind: "if",
                  extra: { limit: child.limit },
                  sourceHandle: "else",
                },
              ]
            : [],
          depth + 1,
          parentId,
        );
        exits = [...thenExits, ...elseExits];
      } else if (child.type === "loop") {
        const bodyIds = collectAgentIds(child.body, []);
        const height = Math.max(160, bodyIds.length * 100 + 56);
        const gx = 48 + depth * 24;
        const gy = absY;
        nodes.push({
          id: child.id,
          type: "loopGroup",
          position: { x: gx, y: gy },
          style: { width: 280, height },
          data: {
            when: child.when,
            limit: child.limit ?? child.max_visits,
            max_visits: child.limit ?? child.max_visits,
            label: "Loop",
          },
        });
        relFrames.push({ y: 48 });
        absY = gy + 48;
        const first = firstAgentId(child.body);
        const bodyExits = walkSeq(
          child.body || emptySequence(),
          exits,
          depth + 1,
          child.id,
        );
        relFrames.pop();
        const lasts = [];
        for (const item of bodyExits) {
          if (item.source && !lasts.includes(item.source)) lasts.push(item.source);
        }
        if (first) {
          for (const last of lasts) {
            link(last, first, "loop", child.when, {
              kind: "back",
              limit: child.limit ?? child.max_visits,
              max_visits: child.limit ?? child.max_visits,
            });
          }
        }
        absY = gy + height + 24;
        exits = bodyExits;
      }
    }
    return exits;
  }

  walkSeq(flow, [], 0, undefined);
  return { nodes, edges };
}
