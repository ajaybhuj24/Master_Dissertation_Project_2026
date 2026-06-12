import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, BarChart3, Loader2, RefreshCw } from "lucide-react"

import { getResultRun, listResultFiles } from "@/api/client"
import type { PipelineMetrics, ResultRunFile } from "@/types"
import { aggregateByPipeline } from "@/lib/metrics"
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
import { StageGroupedBars } from "@/components/StageGroupedBars"

type State =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "error"; message: string }
  | {
      phase: "loaded"
      run: ResultRunFile
      metrics: PipelineMetrics[]
      filename: string
    }

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function ResultsPage() {
  const [state, setState] = useState<State>({ phase: "loading" })

  const load = useCallback(async () => {
    setState({ phase: "loading" })
    try {
      const files = await listResultFiles()
      const newestJson = files.find((f) =>
        f.filename.toLowerCase().endsWith(".json")
      )
      if (!newestJson) {
        setState({ phase: "empty" })
        return
      }
      const run = await getResultRun(newestJson.filename)
      const metrics = aggregateByPipeline(run.results)
      setState({ phase: "loaded", run, metrics, filename: newestJson.filename })
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to load results.",
      })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Per-pipeline RAGAS means from the most recent batch run.
          </p>
        </div>
        {state.phase === "loaded" && (
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        )}
      </header>

      {state.phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading the latest batch results…
        </div>
      )}

      {state.phase === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Couldn’t load results</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
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
            <Badge variant="secondary">paper: {state.run.paper_id}</Badge>
            <Badge variant="secondary">{state.run.results.length} units</Badge>
            {(() => {
              const errs = state.run.results.filter((r) => r.error).length
              return (
                <Badge variant={errs ? "destructive" : "outline"}>
                  {errs} errors
                </Badge>
              )
            })()}
            <span className="text-sm text-muted-foreground">
              {formatDateTime(state.run.exported_at)} ·{" "}
              <code>{state.filename}</code>
            </span>
          </div>

          {state.run.paper_title && (
            <p className="text-sm text-muted-foreground">
              {state.run.paper_title}
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
              <StageGroupedBars metrics={state.metrics} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metric means</CardTitle>
              <CardDescription>
                Best value in each column is emphasised.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsTable metrics={state.metrics} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
