import { useMemo } from "react";
import {
  collectAgentIds,
  DEFAULT_EDGE_LIMIT,
  insertBlock,
  moveWithin,
  newAgent,
  newIf,
  newLoop,
  removeAt,
  updateAt,
  validateFlow,
  WHEN_OPTIONS,
} from "../pipeline/pipelineFlow.js";

const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-moss";

function pickToBlock(pick) {
  if (pick.kind === "agent") return newAgent(pick.id);
  if (pick.kind === "if") return newIf();
  return newLoop();
}

function WhenFields({ when, idPrefix, onChange }) {
  const type = when?.type || "always";
  return (
    <>
      <label className="block min-w-[10rem] flex-1 text-xs">
        <span className="font-medium text-ink">When</span>
        <select
          id={`${idPrefix}-when`}
          value={type}
          onChange={(e) =>
            onChange({
              type: e.target.value,
              ...(e.target.value === "on_status"
                ? { status: when?.status || "" }
                : {}),
            })
          }
          className={fieldClass}
        >
          {WHEN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {type === "on_status" ? (
        <label className="block min-w-[8rem] flex-1 text-xs">
          <span className="font-medium text-ink">Result is</span>
          <input
            id={`${idPrefix}-status`}
            value={when?.status || ""}
            onChange={(e) =>
              onChange({ type: "on_status", status: e.target.value })
            }
            className={fieldClass}
            placeholder="done"
          />
        </label>
      ) : null}
    </>
  );
}

function LimitField({ id, value, onChange }) {
  const cap = value != null ? value : DEFAULT_EDGE_LIMIT;
  return (
    <label className="block w-24 shrink-0 text-xs">
      <span className="font-medium text-ink">Limit</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={String(cap)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d]/g, ""));
          onChange(Math.max(1, n || 1));
        }}
        className={fieldClass}
      />
    </label>
  );
}

function AddSelect({ agents, usedIds, onPick, id }) {
  const available = agents.filter((a) => !usedIds.has(a.id));
  return (
    <label className="block max-w-sm text-xs">
      <span className="font-medium text-ink">Add</span>
      <select
        id={id}
        value=""
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          if (value === "if") onPick({ kind: "if" });
          else if (value === "loop") onPick({ kind: "loop" });
          else onPick({ kind: "agent", id: value });
        }}
        className={fieldClass}
      >
        <option value="">Choose…</option>
        {available.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name || a.id}
          </option>
        ))}
        <option value="if">If / Else</option>
        <option value="loop">Back to agent</option>
      </select>
    </label>
  );
}

function ActionSelect({ index, count, onMove, onRemove, id }) {
  return (
    <label className="block w-36 shrink-0 text-xs">
      <span className="font-medium text-ink">Action</span>
      <select
        id={id}
        value=""
        onChange={(e) => {
          const value = e.target.value;
          if (value === "up") onMove(index - 1);
          if (value === "down") onMove(index + 1);
          if (value === "remove") onRemove();
        }}
        className={fieldClass}
      >
        <option value="">Choose…</option>
        {index > 0 ? <option value="up">Move up</option> : null}
        {index < count - 1 ? <option value="down">Move down</option> : null}
        <option value="remove">Remove</option>
      </select>
    </label>
  );
}

function SequenceStack({
  seq,
  seqPath,
  agents,
  usedIds,
  onInsert,
  onRemove,
  onMove,
  onPatch,
  rail,
  title,
}) {
  const children = seq?.children || [];
  const addId = `add-${seqPath.join("-") || "root"}`;
  return (
    <div
      className={[
        "flex min-w-0 flex-col gap-3",
        rail === "then"
          ? "border-l-2 border-moss pl-3"
          : rail === "else"
            ? "border-l-2 border-warn pl-3"
            : rail === "loop"
              ? "border-l-2 border-dashed border-moss pl-3"
              : "",
      ].join(" ")}
    >
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </p>
      ) : null}
      {children.map((child, index) => (
        <BlockForm
          key={child.id || child.type + index}
          block={child}
          seqPath={seqPath}
          index={index}
          count={children.length}
          agents={agents}
          usedIds={usedIds}
          onInsert={onInsert}
          onRemove={onRemove}
          onMove={onMove}
          onPatch={onPatch}
        />
      ))}
      <AddSelect
        id={addId}
        agents={agents}
        usedIds={usedIds}
        onPick={(pick) => onInsert(seqPath, children.length, pick)}
      />
    </div>
  );
}

function BlockForm({
  block,
  seqPath,
  index,
  count,
  agents,
  usedIds,
  onInsert,
  onRemove,
  onMove,
  onPatch,
}) {
  const action = (
    <ActionSelect
      id={`act-${seqPath.join("-")}-${index}`}
      index={index}
      count={count}
      onMove={(to) => onMove(seqPath, index, to)}
      onRemove={() => onRemove(seqPath, index)}
    />
  );

  if (block.type === "agent") {
    const choices = agents.filter((a) => a.id === block.id || !usedIds.has(a.id));
    return (
      <div className="rounded-xl border border-line bg-paper p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[12rem] flex-1 text-xs">
            <span className="font-medium text-ink">Agent</span>
            <select
              id={`${block.id}-agent`}
              value={block.id}
              onChange={(e) => onPatch(seqPath, index, { id: e.target.value })}
              className={fieldClass}
            >
              {choices.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </label>
          <LimitField
            id={`${block.id}-limit`}
            value={block.forward_limit}
            onChange={(limit) => onPatch(seqPath, index, { forward_limit: limit })}
          />
          {action}
        </div>
      </div>
    );
  }

  if (block.type === "if") {
    return (
      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moss">
          If / Else
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <WhenFields
            when={block.when}
            idPrefix={block.id}
            onChange={(when) => onPatch(seqPath, index, { when })}
          />
          <LimitField
            id={`${block.id}-limit`}
            value={block.limit}
            onChange={(limit) => onPatch(seqPath, index, { limit })}
          />
          {action}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SequenceStack
            seq={block.then}
            seqPath={[...seqPath, index, "then"]}
            agents={agents}
            usedIds={usedIds}
            onInsert={onInsert}
            onRemove={onRemove}
            onMove={onMove}
            onPatch={onPatch}
            rail="then"
            title="Then"
          />
          <SequenceStack
            seq={block.else}
            seqPath={[...seqPath, index, "else"]}
            agents={agents}
            usedIds={usedIds}
            onInsert={onInsert}
            onRemove={onRemove}
            onMove={onMove}
            onPatch={onPatch}
            rail="else"
            title="Else"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-line bg-paper p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moss">
        Back to agent
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <WhenFields
          when={block.when}
          idPrefix={block.id}
          onChange={(when) => onPatch(seqPath, index, { when })}
        />
        <LimitField
          id={`${block.id}-limit`}
          value={block.limit ?? block.max_visits}
          onChange={(limit) => onPatch(seqPath, index, { limit })}
        />
        {action}
      </div>
      <SequenceStack
        seq={block.body}
        seqPath={[...seqPath, index, "body"]}
        agents={agents}
        usedIds={usedIds}
        onInsert={onInsert}
        onRemove={onRemove}
        onMove={onMove}
        onPatch={onPatch}
        rail="loop"
        title="Repeat"
      />
    </div>
  );
}

export default function AgentArrangeDesigner({ agents, flow, onFlowChange }) {
  const usedIds = useMemo(() => new Set(collectAgentIds(flow, [])), [flow]);
  const errors = validateFlow(flow);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line/80 bg-fog/20 p-3">
      {errors.length ? (
        <ul className="mb-3 list-disc rounded-xl border border-warn-border bg-warn-bg px-4 py-2 text-sm text-warn">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <SequenceStack
        seq={flow}
        seqPath={[]}
        agents={agents}
        usedIds={usedIds}
        onInsert={(seqPath, index, pick) =>
          onFlowChange(insertBlock(flow, seqPath, index, pickToBlock(pick)))
        }
        onRemove={(seqPath, index) => onFlowChange(removeAt(flow, seqPath, index))}
        onMove={(seqPath, from, to) =>
          onFlowChange(moveWithin(flow, seqPath, from, to))
        }
        onPatch={(seqPath, index, patch) =>
          onFlowChange(updateAt(flow, seqPath, index, patch))
        }
      />
    </div>
  );
}
