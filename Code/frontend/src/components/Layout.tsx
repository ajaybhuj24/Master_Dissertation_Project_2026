import { NavLink, Outlet } from "react-router-dom"

import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"

const navItems = [
  { to: "/upload", label: "Upload" },
  { to: "/interactive", label: "Interactive" },
  { to: "/batch", label: "Batch" },
  { to: "/results", label: "Results" },
]

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <NavLink to="/interactive" className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              RAG Evaluation
            </span>
            <span className="text-[11px] text-muted-foreground">
              Naive vs Enhanced · Hallucination Mitigation
            </span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t py-4">
        <div className="mx-auto w-full max-w-6xl px-4 text-xs text-muted-foreground">
          MSc Data Science · Ajay Bhuj (25051512)
        </div>
      </footer>
    </div>
  )
}
