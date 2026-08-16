export function agentCompanyLabel(agent) {
  if (!agent) return "";
  const role = String(agent.name || agent.role || "").trim();
  const human = String(agent.human_name || "").trim();
  if (human && role) return `${human} — ${role}`;
  return human || role || agent.id || "";
}
