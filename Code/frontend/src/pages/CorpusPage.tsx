import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LineChart,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"

import {
  addCorpusPaper,
  clearCorpus,
  deleteCorpusPaper,
  deleteSweep,
  getPipelines,
  getSweep,
  listBenchmarks,
  listCorpusPapers,
  listSweeps,
  startSweep,
} from "@/api/client"
import type {
  BenchmarkSummary,
  CorpusPaper,
  JobStatusLiteral,
  PipelineInfo,
  SweepResult,
  SweepSummary,
} from "@/types"
import { DEFAULT_PIPELINES } from "@/lib/stages"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Dropzone } from "@/components/Dropzone"
import { PipelineSelector } from "@/components/PipelineSelector"
import { ProgressTracker } from "@/components/ProgressTracker"
import {
  METRICS,
  formatScore,
  pipelineColor,
  shortPipelineName,
} from "@/lib/metrics"
import type { MetricKey } from "@/lib/metrics"

const SweepTrendChart = lazy(() =>
  import("@/components/SweepTrendChart").then((m) => ({
    default: m.SweepTrendChart,
  }))
)

const SWEEP_DEFAULT_IDS = ["naive", "mmr", "rerank", "crag"]

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function computeSteps(nAvailable: number, nPoints: number): number[] {
  if (nAvailable <= 0) return [0]
  const steps = new Set<number>()
  for (let i = 0; i < nPoints; i++) {
    steps.add(Math.round((i * nAvailable) / (nPoints - 1)))
  }
  return [...steps].sort((a, b) => a - b)
}

export function CorpusPage() {
  const [papers, setPapers] = useState<CorpusPaper[]>([])
  const [totalWords, setTotalWords] = useState(0)
  const [corpusState, setCorpusState] = useState<"loading" | "ok" | "error">(
    "loading"
  )
  const [corpusError, setCorpusError] = useState<string | null>(null)

  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([])

  const [pipelines, setPipelines] = useState<PipelineInfo[]>(DEFAULT_PIPELINES)
  const [runSelected, setRunSelected] = useState<Set<string>>(
    () => new Set(SWEEP_DEFAULT_IDS)
  )

  const [targetId, setTargetId] = useState<string | null>(null)
  const [nPoints, setNPoints] = useState(7)

  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedName, setAddedName] = useState<string | null>(null)

  const [confirmDeletePaper, setConfirmDeletePaper] = useState<string | null>(
    null
  )
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [activeJob, setActiveJob] = useState<{
    jobId: string
    total: number
  } | null>(null)
  const [jobDoneStatus, setJobDoneStatus] = useState<JobStatusLiteral | null>(
    null
  )

  const [sweeps, setSweeps] = useState<SweepSummary[]>([])
  const [confirmDeleteSweep, setConfirmDeleteSweep] = useState<string | null>(
    null
  )
  const [deletingSweepId, setDeletingSweepId] = useState<string | null>(null)

  const [selectedSweepId, setSelectedSweepId] = useState<string | null>(null)
  const [loadedSweep, setLoadedSweep] = useState<SweepResult | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepError, setSweepError] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<MetricKey>("faithfulness")

  const loadCorpus = useCallback(async () => {
    setCorpusState("loading")
    setCorpusError(null)
    try {
      const res = await listCorpusPapers()
      setPapers(res.papers)
      setTotalWords(res.total_word_count)
      setCorpusState("ok")
    } catch (err) {
      setCorpusError(err instanceof Error ? err.message : "Failed to load.")
      setCorpusState("error")
    }
  }, [])

  const loadBenchmarks = useCallback(async () => {
    try {
      setBenchmarks(await listBenchmarks())
    } catch {
    }
  }, [])

  const loadSweeps = useCallback(async () => {
    try {
      setSweeps(await listSweeps())
    } catch {
    }
  }, [])

  useEffect(() => {
    void loadCorpus()
    void loadBenchmarks()
    void loadSweeps()
  }, [loadCorpus, loadBenchmarks, loadSweeps])

  useEffect(() => {
    let active = true
    getPipelines()
      .then((list) => {
        if (!active || list.length === 0) return
        setPipelines(list)
        setRunSelected(
          new Set(
            list
              .filter((p) => SWEEP_DEFAULT_IDS.includes(p.pipeline_id))
              .map((p) => p.pipeline_id)
          )
        )
      })
      .catch(() => {
      })
    return () => {
      active = false
    }
  }, [])

  const benchmarkIds = useMemo(
    () => new Set(benchmarks.map((b) => b.paper_id)),
    [benchmarks]
  )
  const validTargets = useMemo(
    () => papers.filter((p) => benchmarkIds.has(p.paper_id)),
    [papers, benchmarkIds]
  )

  useEffect(() => {
    if (targetId && validTargets.some((p) => p.paper_id === targetId)) return
    setTargetId(validTargets[0]?.paper_id ?? null)
  }, [validTargets, targetId])

  useEffect(() => {
    if (sweeps.length === 0) {
      setSelectedSweepId(null)
      return
    }
    setSelectedSweepId((prev) =>
      prev && sweeps.some((s) => s.sweep_id === prev) ? prev : sweeps[0].sweep_id
    )
  }, [sweeps])

  useEffect(() => {
    if (!selectedSweepId) {
      setLoadedSweep(null)
      return
    }
    let active = true
    setSweepLoading(true)
    setSweepError(null)
    getSweep(selectedSweepId)
      .then((res) => {
        if (active) setLoadedSweep(res)
      })
      .catch((err) => {
        if (active)
          setSweepError(
            err instanceof Error ? err.message : "Failed to load the sweep."
          )
      })
      .finally(() => {
        if (active) setSweepLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedSweepId])

  const runOrderedIds = useMemo(
    () =>
      pipelines
        .filter((p) => runSelected.has(p.pipeline_id))
        .map((p) => p.pipeline_id),
    [pipelines, runSelected]
  )

  const targetBenchmark = benchmarks.find((b) => b.paper_id === targetId)
  const questionCount = targetBenchmark?.question_count ?? 15
  const nDistractors = Math.max(0, papers.length - 1)
  const steps = useMemo(
    () => computeSteps(nDistractors, nPoints),
    [nDistractors, nPoints]
  )
  const unitsEstimate = steps.length * questionCount * runOrderedIds.length
  const runInProgress = activeJob !== null && jobDoneStatus === null
  const canStart =
    !!targetId && runOrderedIds.length > 0 && !starting && !activeJob

  const onAddFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setAddError("Please choose a .pdf file.")
      return
    }
    setAdding(true)
    setAddError(null)
    setAddedName(null)
    try {
      const entry = await addCorpusPaper(file)
      setAddedName(entry.filename)
      await loadCorpus()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add the PDF.")
    } finally {
      setAdding(false)
    }
  }

  const doDeletePaper = async (paperId: string) => {
    setDeletingPaperId(paperId)
    try {
      await deleteCorpusPaper(paperId)
      setConfirmDeletePaper(null)
      await loadCorpus()
    } catch (err) {
      setCorpusError(err instanceof Error ? err.message : "Delete failed.")
    } finally {
      setDeletingPaperId(null)
    }
  }

  const doClear = async () => {
    setClearing(true)
    try {
      await clearCorpus()
      setConfirmClear(false)
      await loadCorpus()
    } catch (err) {
      setCorpusError(err instanceof Error ? err.message : "Clear failed.")
    } finally {
      setClearing(false)
    }
  }

  const startRun = async () => {
    if (!targetId || runOrderedIds.length === 0) return
    setStarting(true)
    setStartError(null)
    setJobDoneStatus(null)
    try {
      const job = await startSweep({
        target_paper_id: targetId,
        pipeline_ids: runOrderedIds,
        n_points: nPoints,
      })
      setActiveJob({ jobId: job.job_id, total: job.total_units })
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Failed to start the sweep."
      )
    } finally {
      setStarting(false)
    }
  }

  const resetRun = () => {
    setActiveJob(null)
    setJobDoneStatus(null)
    setStartError(null)
  }

  const doDeleteSweep = async (sweepId: string) => {
    setDeletingSweepId(sweepId)
    try {
      await deleteSweep(sweepId)
      setConfirmDeleteSweep(null)
      await loadSweeps()
    } catch {
    } finally {
      setDeletingSweepId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Corpus experiment
        </h1>
        <p className="text-muted-foreground">
          Measure how RAGAS scores shift as the document corpus grows. One target
          paper’s benchmark is re-run against a widening set of distractor PDFs —
          the trend’s x-axis is cumulative word count.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run sweep</CardTitle>
          <CardDescription>
            Re-runs the target benchmark at a series of growing corpus sizes
            (target + first k distractors). Heavy — sizes × questions × pipelines
            RAGAS units, run serially, using OpenAI credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {papers.length === 0
                ? "Add one or more PDFs to the corpus below, then upload a benchmark (Batch page) for the PDF you want as the target."
                : "None of your corpus PDFs has a matching benchmark yet. Upload a benchmark whose paper_id matches one of the PDFs below (Batch page) to use it as the sweep target."}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Target paper</label>
                <select
                  value={targetId ?? ""}
                  onChange={(e) => setTargetId(e.target.value)}
                  disabled={runInProgress}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {validTargets.map((p) => (
                    <option key={p.paper_id} value={p.paper_id}>
                      {p.paper_id} ({p.word_count.toLocaleString()} words)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  The target’s benchmark is the fixed ground truth; every other
                  corpus PDF is a distractor.
                </p>
              </div>

              <PipelineSelector
                pipelines={pipelines}
                value={runSelected}
                onChange={setRunSelected}
                disabled={runInProgress}
              />

              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sample points</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={nPoints}
                    disabled={runInProgress}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setNPoints(
                        Number.isFinite(n)
                          ? Math.min(20, Math.max(2, Math.round(n)))
                          : 7
                      )
                    }}
                    className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {nDistractors} distractor{nDistractors === 1 ? "" : "s"}{" "}
                  available · corpus sizes (distractors): {steps.join(", ")}
                </p>
              </div>

              {!activeJob && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void startRun()} disabled={!canStart}>
                    {starting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Start sweep
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {steps.length} × {questionCount} × {runOrderedIds.length} ={" "}
                    {unitsEstimate} units
                  </span>
                </div>
              )}

              {startError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {startError}
                </p>
              )}

              {activeJob && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <ProgressTracker
                    jobId={activeJob.jobId}
                    total={activeJob.total}
                    onDone={(status) => {
                      setJobDoneStatus(status)
                      if (status === "completed") {
                        void loadSweeps()
                        if (activeJob) setSelectedSweepId(activeJob.jobId)
                      }
                    }}
                  />
                  {jobDoneStatus && (
                    <Button variant="ghost" size="sm" onClick={resetRun}>
                      {jobDoneStatus === "completed"
                        ? "Run another sweep"
                        : "Dismiss"}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Word-count trend</CardTitle>
          <CardDescription>
            How each pipeline’s RAGAS score moves as the corpus grows — x is
            cumulative word count, one line per pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sweeps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Run a sweep to see the trend.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sweep</label>
                  <select
                    value={selectedSweepId ?? ""}
                    onChange={(e) => setSelectedSweepId(e.target.value)}
                    className="h-9 w-full min-w-64 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {sweeps.map((s) => (
                      <option key={s.sweep_id} value={s.sweep_id}>
                        {s.target_paper_id} · {s.n_points} sizes ·{" "}
                        {formatDateTime(s.created_at)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Metric</label>
                  <div className="flex flex-wrap gap-1.5">
                    {METRICS.map((m) => (
                      <Button
                        key={m.key}
                        variant={chartMetric === m.key ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setChartMetric(m.key)}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {sweepLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading sweep…
                </div>
              )}
              {sweepError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {sweepError}
                </p>
              )}

              {loadedSweep &&
                !sweepLoading &&
                (loadedSweep.points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This sweep has no data points.
                  </p>
                ) : (
                  <>
                    <Suspense
                      fallback={
                        <div className="h-[340px] w-full animate-pulse rounded-lg bg-muted" />
                      }
                    >
                      <SweepTrendChart
                        points={loadedSweep.points}
                        pipelineIds={loadedSweep.pipeline_ids}
                        metric={chartMetric}
                      />
                    </Suspense>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Words</th>
                            <th className="py-2 pr-3 font-medium">Papers</th>
                            {loadedSweep.pipeline_ids.map((pid, i) => (
                              <th key={pid} className="py-2 pr-3 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className="inline-block size-2 rounded-full"
                                    style={{ background: pipelineColor(pid, i) }}
                                  />
                                  {shortPipelineName(pid, pid)}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadedSweep.points.map((pt) => (
                            <tr
                              key={pt.n_distractors}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-3 tabular-nums">
                                {pt.cumulative_word_count.toLocaleString()}
                              </td>
                              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                                {pt.n_papers}
                              </td>
                              {loadedSweep.pipeline_ids.map((pid) => {
                                const pm = pt.by_pipeline[pid]
                                const v = pm
                                  ? pm[`${chartMetric}_mean` as `${MetricKey}_mean`]
                                  : null
                                return (
                                  <td key={pid} className="py-2 pr-3 tabular-nums">
                                    {formatScore(v)}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-medium">
                        {METRICS.find((m) => m.key === chartMetric)?.label}
                      </span>{" "}
                      means across {loadedSweep.points.length} corpus size
                      {loadedSweep.points.length === 1 ? "" : "s"}.
                      {loadedSweep.total_errors > 0 &&
                        ` ${loadedSweep.total_errors} unit(s) errored and are excluded from the means.`}
                    </p>
                  </>
                ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corpus</CardTitle>
          <CardDescription>
            PDFs in the dedicated <code>corpus</code> namespace. {papers.length}{" "}
            paper{papers.length === 1 ? "" : "s"} ·{" "}
            {totalWords.toLocaleString()} words total.
          </CardDescription>
          {corpusState === "ok" && papers.length > 0 && (
            <CardAction className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadCorpus()}
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
              {confirmClear ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmClear(false)}
                    disabled={clearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void doClear()}
                    disabled={clearing}
                  >
                    {clearing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Clear all
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="size-3.5" />
                  Clear all
                </Button>
              )}
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {corpusState === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          )}

          {corpusState === "error" && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{corpusError}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => void loadCorpus()}
              >
                Retry
              </Button>
            </div>
          )}

          {corpusState === "ok" && papers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No corpus PDFs yet. Add one below.
            </p>
          )}

          {corpusState === "ok" && papers.length > 0 && (
            <ul className="space-y-2">
              {papers.map((p) => (
                <li
                  key={p.paper_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      <code>{p.paper_id}</code> ·{" "}
                      {p.word_count.toLocaleString()} words · {p.pages} pages ·{" "}
                      {p.n_chunks} chunks
                      {benchmarkIds.has(p.paper_id) && (
                        <span className="text-stage-during">
                          {" "}
                          · benchmark ✓ (eligible target)
                        </span>
                      )}
                    </p>
                  </div>
                  {confirmDeletePaper === p.paper_id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeletePaper(null)}
                        disabled={deletingPaperId === p.paper_id}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void doDeletePaper(p.paper_id)}
                        disabled={deletingPaperId === p.paper_id}
                      >
                        {deletingPaperId === p.paper_id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Confirm
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeletePaper(p.paper_id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete corpus PDF</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a PDF</CardTitle>
          <CardDescription>
            Added additively — existing corpus papers are kept. Chunked (naive) +
            embedded into the <code>corpus</code> namespace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dropzone
            accept=".pdf"
            disabled={adding}
            onFile={(f) => void onAddFile(f)}
          >
            {adding ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <div>
                  <p className="font-medium">Adding &amp; embedding…</p>
                  <p className="text-sm text-muted-foreground">
                    Chunking + embedding the PDF — this can take ~10–60s.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Drop a PDF here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The filename (minus <code>.pdf</code>) becomes its paper_id.
                  </p>
                </div>
              </>
            )}
          </Dropzone>

          {addError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {addError}
            </p>
          )}
          {addedName && !adding && (
            <p className="flex items-center gap-2 text-sm text-stage-during">
              <CheckCircle2 className="size-4" />
              Added <code>{addedName}</code> to the corpus.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past sweeps</CardTitle>
          <CardDescription>
            Saved sweep results in <code>data/corpus/sweeps/</code>. The
            word-count trend chart loads these.
          </CardDescription>
          {sweeps.length > 0 && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSweeps()}
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {sweeps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sweeps yet. Run one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {sweeps.map((s) => (
                <li
                  key={s.sweep_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <LineChart className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.target_paper_title}{" "}
                      <span className="text-muted-foreground">
                        ({s.target_paper_id})
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {s.n_points} sizes · {s.n_questions} Q ·{" "}
                      {s.pipeline_ids.length} pipelines · {s.total_units} units
                      {s.total_errors > 0 ? ` · ${s.total_errors} errors` : ""} ·{" "}
                      {formatDateTime(s.created_at)}
                    </p>
                  </div>
                  {confirmDeleteSweep === s.sweep_id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteSweep(null)}
                        disabled={deletingSweepId === s.sweep_id}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void doDeleteSweep(s.sweep_id)}
                        disabled={deletingSweepId === s.sweep_id}
                      >
                        {deletingSweepId === s.sweep_id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Confirm
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeleteSweep(s.sweep_id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete sweep</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
