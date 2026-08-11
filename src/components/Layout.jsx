import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useApiStatus } from "../context/ApiStatusContext.jsx";

const NAV_STORAGE_KEY = "helix-nav-collapsed";
const THEME_STORAGE_KEY = "helix-theme";

const LINKS = [
  { to: "/", label: "Analysis", short: "A", end: true },
  { to: "/results", label: "Results", short: "▶" },
  { to: "/rules", label: "Rules", short: "R" },
  { to: "/skills", label: "Skills", short: "S" },
  { to: "/agents", label: "Agents", short: "Ag" },
  { to: "/docs", label: "Docs", short: "D" },
  { to: "/db-explorer", label: "DB Explorer", short: "DB" },
  { to: "/settings", label: "Settings", short: "⚙" },
  { to: "/about-me", label: "About Me", short: "✎" },
];

function statusDotClass(status) {
  if (status === "connected" || status === "configured") return "bg-moss";
  if (status === "not_configured" || status === "missing_token") return "bg-ink/50";
  if (!status) return "bg-muted";
  return "bg-warn";
}

function formatServiceStatus(status, checking) {
  if (checking && !status) return "Checking…";
  if (!status) return "Unknown";
  return status.replace(/_/g, " ");
}

function StatusDot({ status, label, checking }) {
  const title = `${label}: ${formatServiceStatus(status, checking)}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span className="text-muted">{label}</span>
      <span
        className={`inline-block size-2 shrink-0 rounded-full ${statusDotClass(status)}`}
        aria-label={title}
      />
    </span>
  );
}

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
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
  const [theme, setTheme] = useState(readTheme);

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

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const apiStatus = health?.api?.status;
  const dbStatus = health?.database?.status;

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

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mb-1 rounded-lg border border-line/80 bg-fog/40 px-2 py-1.5 text-xs font-medium text-ink hover:bg-fog"
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? "»" : "« Menu"}
        </button>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            title={link.label}
            className={({ isActive }) =>
              [
                "rounded-xl text-sm font-medium transition",
                collapsed ? "px-0 py-2 text-center" : "px-3 py-2",
                isActive
                  ? "bg-moss text-white"
                  : "border border-line/80 bg-paper/80 text-ink hover:bg-fog",
              ].join(" ")
            }
          >
            {collapsed ? link.short : link.label}
          </NavLink>
        ))}

        <div className="mt-auto space-y-1 pt-2">
          <Link
            to="/settings?tab=connection"
            title="Open Settings → Connection"
            className={[
              "block w-full rounded-xl border border-line/80 bg-fog/40 text-left text-[11px] font-medium transition hover:bg-fog",
              collapsed ? "px-0 py-2 text-center" : "px-3 py-2",
            ].join(" ")}
          >
            {collapsed ? (
              <span className="inline-flex flex-col items-center gap-1.5 leading-none">
                <span
                  className={`inline-block size-2 rounded-full ${statusDotClass(apiStatus)}`}
                  title={`API: ${formatServiceStatus(apiStatus, checking)}`}
                  aria-label={`API: ${formatServiceStatus(apiStatus, checking)}`}
                />
                <span
                  className={`inline-block size-2 rounded-full ${statusDotClass(dbStatus)}`}
                  title={`DB: ${formatServiceStatus(dbStatus, checking)}`}
                  aria-label={`DB: ${formatServiceStatus(dbStatus, checking)}`}
                />
              </span>
            ) : (
              <span className="flex items-center gap-4">
                <StatusDot status={apiStatus} label="API" checking={checking} />
                <StatusDot status={dbStatus} label="DB" checking={checking} />
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              "w-full rounded-xl border border-line/80 bg-fog/40 text-xs font-medium text-ink hover:bg-fog",
              collapsed ? "px-0 py-2" : "px-3 py-2",
            ].join(" ")}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {collapsed ? (theme === "dark" ? "☀" : "☾") : theme === "dark" ? "Light theme" : "Dark theme"}
          </button>
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
