import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, FileText, Loader2, Send } from "lucide-react"

import { ask, getCurrentPaper, getPipelines } from "@/api/client"
import type { CurrentPaperResponse, PipelineInfo, PipelineResult } from "@/types"
import {
  DEFAULT_PIPELINES,
  STAGE_ORDER,
  stageIndex,
  stageMeta,
} from "@/lib/stages"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PipelineCard } from "@/components/PipelineCard"

type Phase = "idle" | "running" | "done" | "error"

export function InteractivePage() {
  const [question, setQuestion] = useState("")
  const [pipelines, setPipelines] = useState<PipelineInfo[]>(DEFAULT_PIPELINES)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_PIPELINES.map((p) => p.pipeline_id))
  )

  const [phase, setPhase] = useState<Phase>("idle")
  const [results, setResults] = useState<PipelineResult[]>([])
  const [ranQuestion, setRanQuestion] = useState("")
  const [ranPaperId, setRanPaperId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [paper, setPaper] = useState<CurrentPaperResponse | null>(null)
  const [paperKnown, setPaperKnown] = useState(false)

  useEffect(() => {
    let active = true
    getPipelines()
      .then((list) => {
        if (!active || list.length === 0) return
        setPipelines(list)
        setSelected(new Set(list.map((p) => p.pipeline_id)))
      })
      .catch(() => {
      })
    getCurrentPaper()
      .then((p) => {
        if (!active) return
        setPaper(p.paper_id ? p : null)
        setPaperKnown(true)
      })
      .catch(() => {
        if (active) setPaperKnown(false)
      })
    return () => {
      active = false
    }
  }, [])

  const grouped = useMemo(() => {
    const g: Record<string, PipelineInfo[]> = {}
    for (const p of pipelines) (g[p.stage] ??= []).push(p)
    return g
  }, [pipelines])

  const orderedSelectedIds = useMemo(
    () =>
      pipelines
        .filter((p) => selected.has(p.pipeline_id))
        .map((p) => p.pipeline_id),
    [pipelines, selected]
  )

  const noPaper = paperKnown && !paper
  const running = phase === "running"
  const canRun =
    question.trim().length > 0 &&
    orderedSelectedIds.length > 0 &&
    !running &&
    !noPaper

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleStage = (stage: string) => {
    const ids = (grouped[stage] ?? []).map((p) => p.pipeline_id)
    const allOn = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const run = async () => {
    if (!canRun) return
    setPhase("running")
    setErrorMsg(null)
    setResults([])
    try {
      const res = await ask(question.trim(), orderedSelectedIds)
      const sorted = [...res.results].sort(
        (a, b) => stageIndex(a.stage) - stageIndex(b.stage)
      )
      setResults(sorted)
      setRanQuestion(res.question)
      setRanPaperId(res.paper_id)
      setPhase("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Request failed.")
      setPhase("error")
    }
  }

  const runningNames = pipelines
    .filter((p) => selected.has(p.pipeline_id))
    .map((p) => p.pipeline_name)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Interactive query
        </h1>
        <p className="text-muted-foreground">
          Ask one question and compare answers across the selected pipelines
          side-by-side.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask a question</CardTitle>
          <CardDescription>
            {paper
              ? <>Active paper: <code>{paper.filename}</code></>
              : "The question is answered against the currently-loaded paper."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void run()
              }
            }}
            placeholder="e.g. What dataset does the paper use, and how is it preprocessed?"
            className="flex min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          {noPaper && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stage-post/40 bg-stage-post/5 p-3 text-sm">
              <AlertCircle className="size-4 shrink-0 text-stage-post" />
              <span>No paper is loaded yet.</span>
              <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link to="/upload">
                  <FileText className="size-3.5" />
                  Go to Upload
                </Link>
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void run()} disabled={!canRun}>
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {running ? "Running…" : "Run"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {orderedSelectedIds.length} pipeline
              {orderedSelectedIds.length === 1 ? "" : "s"} selected
              <span className="hidden sm:inline">
                {" "}
                · ⌘/Ctrl + Enter to run
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipelines</CardTitle>
          <CardDescription>
            Choose which pipelines to run. They execute serially, so all 8 can
            take ~1–2 minutes.
          </CardDescription>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set(pipelines.map((p) => p.pipeline_id)))}
              disabled={orderedSelectedIds.length === pipelines.length}
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={orderedSelectedIds.length === 0}
            >
              None
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGE_ORDER.filter((s) => grouped[s]?.length).map((stage) => {
            const meta = stageMeta(stage)
            const items = grouped[stage] ?? []
            const onCount = items.filter((p) => selected.has(p.pipeline_id)).length
            return (
              <div key={stage} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleStage(stage)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className={cn("size-2.5 rounded-full", meta.dot)} />
                  <span className={cn("text-sm font-medium", meta.text)}>
                    {meta.label}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {onCount}/{items.length}
                  </span>
                </button>
                <div className="space-y-1.5">
                  {items.map((p) => (
                    <label
                      key={p.pipeline_id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.has(p.pipeline_id)}
                        onChange={() => toggleOne(p.pipeline_id)}
                      />
                      <span>{p.pipeline_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {phase === "idle" && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Enter a question and press Run to compare pipelines.
        </p>
      )}

      {phase === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Couldn’t run the query</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void run()}>
            Retry
          </Button>
        </div>
      )}

      {running && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">
                Running {runningNames.length} pipeline
                {runningNames.length === 1 ? "" : "s"}…
              </p>
              <p className="text-sm text-muted-foreground">
                The backend runs them one at a time — this can take a minute or
                two for the full set.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {runningNames.map((n) => (
                <Badge key={n} variant="secondary">
                  {n}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "done" && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold">Results</h2>
            <span className="text-sm text-muted-foreground">
              “{ranQuestion}”
            </span>
            {ranPaperId && (
              <Badge variant="outline" className="ml-auto">
                paper: {ranPaperId}
              </Badge>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {results.map((r) => (
              <PipelineCard key={r.pipeline_id} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
