import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, BarChart3, Download, Loader2, RefreshCw } from "lucide-react"

import { getResultRun, listResultFiles } from "@/api/client"
import type {
  PipelineMetrics,
  ResultFileEntry,
  ResultRunFile,
  StageMetrics,
} from "@/types"
import { aggregateByPipeline, aggregateByStage } from "@/lib/metrics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MetricsTable } from "@/components/MetricsTable"
import { StageMeansTable } from "@/components/StageMeansTable"

const StageGroupedBars = lazy(() =>
  import("@/components/StageGroupedBars").then((m) => ({
    default: m.StageGroupedBars,
  }))
)

const API_BASE = "/api"

type Loaded = {
  run: ResultRunFile
  byPipeline: PipelineMetrics[]
  byStage: StageMetrics[]
}
type State =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; data: Loaded }

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function prettyRunLabel(filename: string): string {
  const stem = filename.replace(/\.json$/i, "")
  const m = stem.match(/^(.*)_(\d{8})T(\d{6})Z$/)
  if (!m) return filename
  const [, paper, d, t] = m
  return `${paper} · ${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}`
}

export function ResultsPage() {
  const [files, setFiles] = useState<ResultFileEntry[]>([])
  const [selected, setSelected] = useState<string>("")
  const [state, setState] = useState<State>({ phase: "loading" })

  const loadRun = useCallback(async (filename: string) => {
    setState({ phase: "loading" })
    try {
      const run = await getResultRun(filename)
      setState({
        phase: "loaded",
        data: {
          run,
          byPipeline: aggregateByPipeline(run.results),
          byStage: aggregateByStage(run.results),
        },
      })
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to load results.",
      })
    }
  }, [])

  const loadFileList = useCallback(
    async (prefer?: string) => {
      setState({ phase: "loading" })
      try {
        const all = await listResultFiles()
        const jsons = all.filter((f) =>
          f.filename.toLowerCase().endsWith(".json")
        )
        setFiles(jsons)
        if (jsons.length === 0) {
          setState({ phase: "empty" })
          return
        }
        const target =
          prefer && jsons.some((f) => f.filename === prefer)
            ? prefer
            : jsons[0].filename
        setSelected(target)
        await loadRun(target)
      } catch (err) {
        setFiles([])
        setState({
          phase: "error",
          message:
            err instanceof Error ? err.message : "Failed to load results.",
        })
      }
    },
    [loadRun]
  )

  useEffect(() => {
    void loadFileList()
  }, [loadFileList])

  const onSelect = (filename: string) => {
    setSelected(filename)
    void loadRun(filename)
  }

  const csvHref = selected
    ? `${API_BASE}/results/files/${encodeURIComponent(selected.replace(/\.json$/i, ".csv"))}`
    : "#"

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          Per-pipeline and per-stage RAGAS means for a batch run.
        </p>
      </header>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="run-select" className="text-sm text-muted-foreground">
            Run
          </label>
          <select
            id="run-select"
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="h-9 max-w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {files.map((f) => (
              <option key={f.filename} value={f.filename}>
                {prettyRunLabel(f.filename)}
              </option>
            ))}
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={csvHref} download>
                <Download className="size-3.5" />
                This run (CSV)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`${API_BASE}/results/master`} download>
                <Download className="size-3.5" />
                Master CSV
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadFileList(selected)}
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {state.phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading results…
        </div>
      )}

      {state.phase === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Couldn’t load results</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadFileList(selected)}
          >
            Retry
          </Button>
        </div>
      )}

      {state.phase === "empty" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3 className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No batch results yet</p>
              <p className="text-sm text-muted-foreground">
                Run the benchmark across the pipelines to generate scores.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/batch">Go to Batch</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {state.phase === "loaded" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">paper: {state.data.run.paper_id}</Badge>
            <Badge variant="secondary">
              {state.data.run.results.length} units
            </Badge>
            {(() => {
              const errs = state.data.run.results.filter((r) => r.error).length
              return (
                <Badge variant={errs ? "destructive" : "outline"}>
                  {errs} errors
                </Badge>
              )
            })()}
            <Badge variant="outline">
              {state.data.byPipeline.length} pipelines
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDateTime(state.data.run.exported_at)}
            </span>
          </div>

          {state.data.run.paper_title && (
            <p className="text-sm text-muted-foreground">
              {state.data.run.paper_title}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                RAGAS metrics by pipeline
              </CardTitle>
              <CardDescription>
                Mean of each metric across the benchmark questions (0–1, higher
                is better).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense
                fallback={
                  <div className="h-80 w-full animate-pulse rounded-lg bg-muted" />
                }
              >
                <StageGroupedBars metrics={state.data.byPipeline} />
              </Suspense>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-pipeline means</CardTitle>
              <CardDescription>
                Best value in each column is emphasised.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsTable metrics={state.data.byPipeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-stage means</CardTitle>
              <CardDescription>
                The same scores grouped by RAG taxonomy stage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StageMeansTable stages={state.data.byStage} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
