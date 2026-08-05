import { NavLink, Outlet } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/instructions", label: "Instructions" },
  { to: "/rules", label: "Rules" },
  { to: "/skills", label: "Skills" },
  { to: "/admin", label: "Admin" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <nav
        className="flex w-44 shrink-0 flex-col gap-1.5 border-r border-line/80 bg-paper/60 px-3 py-6 sm:w-52 sm:px-4 sm:py-8"
        aria-label="Main"
      >
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              [
                "rounded-xl px-3.5 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-moss text-white"
                  : "bg-paper/80 text-ink hover:bg-fog border border-line/80",
              ].join(" ")
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
