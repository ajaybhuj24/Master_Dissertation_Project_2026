import { useCallback, useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { AlertTriangle } from "lucide-react"

import { checkHealth } from "@/api/client"
import { cn } from "@/lib/utils"
import { ModeToggle } from "@/components/mode-toggle"

const navItems = [
  { to: "/upload", label: "Upload" },
  { to: "/interactive", label: "Interactive" },
  { to: "/batch", label: "Batch" },
  { to: "/results", label: "Results" },
]

function BackendBanner() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking")

  const check = useCallback(async () => {
    setStatus("checking")
    setStatus((await checkHealth()) ? "ok" : "down")
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  if (status !== "down") return null

  return (
    <div className="border-b border-stage-post/40 bg-stage-post/10">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-stage-post" />
        <span>
          Can’t reach the backend API on <code>:8000</code>. Start it, then
          retry.
        </span>
        <button
          type="button"
          onClick={() => void check()}
          className="ml-auto font-medium underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <NavLink
            to="/interactive"
            className="flex shrink-0 flex-col leading-tight"
          >
            <span className="text-sm font-semibold tracking-tight">
              RAG Evaluation
            </span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
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

      <BackendBanner />

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
