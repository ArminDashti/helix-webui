import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Database,
  Monitor,
  Moon,
  Play,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Table2,
  User,
} from "lucide-react";
import { useApiStatus } from "../context/ApiStatusContext.jsx";

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
  { to: "/admin", label: "Admin", icon: Shield },
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

function NavItem({ link }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      title={link.label}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-moss text-white"
            : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
        ].join(" ")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{link.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { health, checking } = useApiStatus();
  const [theme, setTheme] = useState(readThemePreference);

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
        className="flex w-[20%] min-w-[10rem] max-w-[14rem] shrink-0 flex-col gap-1 border-r border-line/80 bg-paper/60 px-2 py-2 sm:px-3"
        aria-label="Main"
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-line/80 bg-fog/30 px-2 py-2">
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
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tracking-wide text-ink">
              Helix
            </p>
            <p className="truncate text-[11px] text-muted">Analytics agents</p>
          </div>
        </div>

        {MAIN_LINKS.map((link) => (
          <NavItem key={link.to} link={link} />
        ))}

        <div className="mt-auto space-y-1 pt-2">
          {FOOTER_LINKS.map((link) => (
            <NavItem key={link.to} link={link} />
          ))}

          <NavLink
            to="/settings?tab=status"
            title="Open status logs"
            className="block w-full rounded-xl border border-line/80 bg-fog/40 px-3 py-2 text-left text-[11px] font-medium hover:bg-fog"
            aria-label="LLM, Engine, and Database status. Open status logs."
          >
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
          </NavLink>

          <div
            className="flex flex-row gap-1 rounded-xl border border-line/80 bg-fog/40 p-1"
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
                    "px-2",
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
          <p className="rounded-xl border border-line/80 bg-fog/40 px-2 py-1.5 text-center text-sm leading-snug text-muted">
            Created by Armin and Cursor
          </p>
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
