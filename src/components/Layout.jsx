import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Database,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Scale,
  Settings,
  Sparkles,
  Sun,
  Table2,
  User,
} from "lucide-react";
import { useApiStatus } from "../context/ApiStatusContext.jsx";
import IconButton from "./IconButton.jsx";

const NAV_STORAGE_KEY = "helix-nav-collapsed";
const THEME_STORAGE_KEY = "helix-theme";

const MAIN_LINKS = [
  { to: "/", label: "Analysis", icon: BarChart3, end: true },
  { to: "/results", label: "Results", icon: Play },
  { to: "/rules", label: "Rules", icon: Scale },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/docs", label: "Table docs", icon: Table2 },
  { to: "/db-explorer", label: "DB Explorer", icon: Database },
];

const FOOTER_LINKS = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about-me", label: "About Me", icon: User },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "System theme", icon: Monitor },
];

function isConnectedStatus(status) {
  return status === "connected" || status === "configured";
}

function formatLinkStatus(status, checking) {
  if (checking && !status) return "Checking…";
  return isConnectedStatus(status) ? "Connected" : "Disconnected";
}

function StatusLine({ status, label, checking }) {
  const state = formatLinkStatus(status, checking);
  const connected = isConnectedStatus(status);
  const title = `${label} ${state}`;
  return (
    <>
      <span className="text-start text-muted" title={title}>
        {label}
      </span>
      <span
        className={`text-start ${connected ? "text-moss" : "text-danger"}`}
        title={title}
      >
        {state}
      </span>
    </>
  );
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference) {
  if (preference === "light") return "light";
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return "dark";
}

function readThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyTheme(preference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

function NavItem({ link, collapsed }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      title={link.label}
      className={({ isActive }) =>
        [
          "flex items-center rounded-xl text-sm font-medium transition",
          collapsed ? "justify-center px-0 py-2" : "gap-2 px-3 py-2",
          isActive
            ? "bg-moss text-white"
            : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
        ].join(" ")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed ? <span>{link.label}</span> : null}
    </NavLink>
  );
}

export default function Layout() {
  const { health, checking } = useApiStatus();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(readThemePreference);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const engineStatus = health?.api?.status;
  const dbStatus = health?.database?.status;
  const providerKey = health?.provider === "cursor" ? "cursor" : "openrouter";
  const llmStatus = health?.[providerKey]?.status;

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav
        className={[
          "flex shrink-0 flex-col gap-1 border-r border-line/80 bg-paper/60 py-2 transition-[width] duration-200",
          collapsed
            ? "w-14 px-1.5"
            : "w-[20%] min-w-[10rem] max-w-[14rem] px-2 sm:px-3",
        ].join(" ")}
        aria-label="Main"
        aria-expanded={!collapsed}
      >
        <div
          className={[
            "mb-2 flex items-center gap-2 rounded-xl border border-line/80 bg-fog/30",
            collapsed ? "justify-center px-1 py-2" : "px-2 py-2",
          ].join(" ")}
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line/70 bg-paper"
            aria-label="App logo"
            title="Helix logo"
          >
            <img
              src="/logo.svg"
              alt="Helix"
              className="size-7 object-contain"
              width={28}
              height={28}
            />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold tracking-wide text-ink">
                Helix
              </p>
              <p className="truncate text-[11px] text-muted">Analytics agents</p>
            </div>
          ) : null}
        </div>

        <IconButton
          type="button"
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          onClick={() => setCollapsed((v) => !v)}
          className="mb-1 rounded-lg border border-line/80 bg-fog/40 px-2 py-1.5 text-xs font-medium text-ink hover:bg-fog"
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? null : "Menu"}
        </IconButton>

        {MAIN_LINKS.map((link) => (
          <NavItem key={link.to} link={link} collapsed={collapsed} />
        ))}

        <div className="mt-auto space-y-1 pt-2">
          {FOOTER_LINKS.map((link) => (
            <NavItem key={link.to} link={link} collapsed={collapsed} />
          ))}

          <div
            className={[
              "block w-full rounded-xl border border-line/80 bg-fog/40 text-left text-[11px] font-medium",
              collapsed ? "px-0 py-2 text-center" : "px-3 py-2",
            ].join(" ")}
            aria-label="LLM, Engine, and Database status"
          >
            {collapsed ? (
              <span className="inline-flex flex-col items-center gap-1.5 font-geek leading-none tracking-wide">
                {[
                  ["LLM", llmStatus],
                  ["Engine", engineStatus],
                  ["Database", dbStatus],
                ].map(([label, status]) => (
                  <span
                    key={label}
                    className={`inline-block size-2 rounded-full ${
                      isConnectedStatus(status) ? "bg-moss" : "bg-danger"
                    }`}
                    title={`${label} ${formatLinkStatus(status, checking)}`}
                    aria-label={`${label} ${formatLinkStatus(status, checking)}`}
                  />
                ))}
              </span>
            ) : (
              <span className="grid w-full grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 font-geek tracking-wide">
                <StatusLine status={llmStatus} label="LLM" checking={checking} />
                <StatusLine
                  status={engineStatus}
                  label="Engine"
                  checking={checking}
                />
                <StatusLine
                  status={dbStatus}
                  label="Database"
                  checking={checking}
                />
              </span>
            )}
          </div>

          <div
            className={[
              "flex gap-1 rounded-xl border border-line/80 bg-fog/40 p-1",
              collapsed ? "flex-col items-center" : "flex-row",
            ].join(" ")}
            role="group"
            aria-label="Theme"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={active}
                  className={[
                    "flex flex-1 items-center justify-center rounded-lg py-1.5 transition",
                    collapsed ? "w-full px-0" : "px-2",
                    active
                      ? "bg-moss text-white"
                      : "text-ink hover:bg-fog",
                  ].join(" ")}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {collapsed ? (
            <p
              className="rounded-xl border border-line/80 bg-fog/40 px-1 py-1.5 text-center text-[11px] font-medium leading-tight text-muted"
              title="Created by Armin and Cursor"
            >
              A+C
            </p>
          ) : (
            <p className="rounded-xl border border-line/80 bg-fog/40 px-2 py-1.5 text-center text-sm leading-snug text-muted">
              Created by Armin and Cursor
            </p>
          )}
        </div>
      </nav>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2 sm:p-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
