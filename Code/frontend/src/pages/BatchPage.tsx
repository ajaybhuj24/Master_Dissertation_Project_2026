import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Eye,
  FileJson,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteBenchmark,
  getBenchmark,
  getPipelines,
  listBenchmarks,
  startBatch,
} from "@/api/client";
import type {
  BenchmarkFile,
  BenchmarkSummary,
  JobStatusLiteral,
  PipelineInfo,
} from "@/types";
import { DEFAULT_PIPELINES } from "@/lib/stages";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BenchmarkUploader } from "@/components/BenchmarkUploader";
import { BenchmarkPreview } from "@/components/BenchmarkPreview";
import { PipelineSelector } from "@/components/PipelineSelector";
import { ProgressTracker } from "@/components/ProgressTracker";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function BatchPage() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [listState, setListState] = useState<"loading" | "ok" | "error">(
    "loading",
  );
  const [listError, setListError] = useState<string | null>(null);

  const [preview, setPreview] = useState<BenchmarkFile | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<PipelineInfo[]>(DEFAULT_PIPELINES);
  const [runSelected, setRunSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_PIPELINES.map((p) => p.pipeline_id)),
  );
  const [runPaperId, setRunPaperId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    total: number;
  } | null>(null);
  const [jobDoneStatus, setJobDoneStatus] = useState<JobStatusLiteral | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setListState("loading");
    setListError(null);
    try {
      const list = await listBenchmarks();
      setBenchmarks(list);
      setRunPaperId((prev) => prev ?? list[0]?.paper_id ?? null);
      setListState("ok");
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load.");
      setListState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    getPipelines()
      .then((list) => {
        if (!active || list.length === 0) return;
        setPipelines(list);
        setRunSelected(new Set(list.map((p) => p.pipeline_id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const openPreview = async (paperId: string) => {
    setPreviewLoadingId(paperId);
    setPreviewError(null);
    try {
      setPreview(await getBenchmark(paperId));
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to load preview.",
      );
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const doDelete = async (paperId: string) => {
    setDeletingId(paperId);
    try {
      await deleteBenchmark(paperId);
      setConfirmDelete(null);
      if (preview?.paper_id === paperId) setPreview(null);
      await refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const runOrderedIds = useMemo(
    () =>
      pipelines
        .filter((p) => runSelected.has(p.pipeline_id))
        .map((p) => p.pipeline_id),
    [pipelines, runSelected],
  );
  const selectedBenchmark = benchmarks.find((b) => b.paper_id === runPaperId);
  const questionCount = selectedBenchmark?.question_count ?? 15;
  const runInProgress = activeJob !== null && jobDoneStatus === null;
  const canStart =
    !!runPaperId && runOrderedIds.length > 0 && !starting && !activeJob;

  const startRun = async () => {
    if (!runPaperId || runOrderedIds.length === 0) return;
    setStarting(true);
    setStartError(null);
    setJobDoneStatus(null);
    try {
      const job = await startBatch(runPaperId, runOrderedIds);
      setActiveJob({ jobId: job.job_id, total: job.total_units });
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Failed to start the run.",
      );
    } finally {
      setStarting(false);
    }
  };

  const resetRun = () => {
    setActiveJob(null);
    setJobDoneStatus(null);
    setStartError(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Batch run</h1>
        <p className="text-muted-foreground">
          Score a benchmark across the pipelines
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run evaluation</CardTitle>
          <CardDescription>
            Scores a benchmark across the selected pipelines with RAGAS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {benchmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No benchmark to run yet — upload one below first.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Benchmark</label>
                <select
                  value={runPaperId ?? ""}
                  onChange={(e) => setRunPaperId(e.target.value)}
                  disabled={runInProgress}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {benchmarks.map((b) => (
                    <option key={b.paper_id} value={b.paper_id}>
                      {b.paper_title} ({b.paper_id} · {b.question_count} Q)
                    </option>
                  ))}
                </select>
              </div>

              <PipelineSelector
                pipelines={pipelines}
                value={runSelected}
                onChange={setRunSelected}
                disabled={runInProgress}
              />

              {!activeJob && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void startRun()} disabled={!canStart}>
                    {starting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Start run
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {runOrderedIds.length} × {questionCount} ={" "}
                    {runOrderedIds.length * questionCount} units
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
                    onDone={(status) => setJobDoneStatus(status)}
                  />
                  {jobDoneStatus === "completed" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm">
                        <Link to="/results">
                          <BarChart3 className="size-3.5" />
                          View results
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetRun}>
                        Run another
                      </Button>
                    </div>
                  )}
                  {jobDoneStatus && jobDoneStatus !== "completed" && (
                    <Button variant="ghost" size="sm" onClick={resetRun}>
                      Dismiss
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
          <CardTitle className="text-base">Saved benchmarks</CardTitle>
          <CardDescription>
            One 15-question benchmark per paper, stored in{" "}
            <code>data/benchmarks/</code>.
          </CardDescription>
          {listState === "ok" && (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {listState === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          )}

          {listState === "error" && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{listError}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => void refresh()}
              >
                Retry
              </Button>
            </div>
          )}

          {listState === "ok" && benchmarks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No benchmarks yet. Upload one below.
            </p>
          )}

          {listState === "ok" && benchmarks.length > 0 && (
            <ul className="space-y-2">
              {benchmarks.map((b) => (
                <li
                  key={b.paper_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <FileJson className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.paper_title}</p>
                    <p className="text-sm text-muted-foreground">
                      <code>{b.paper_id}</code> · {b.question_count} questions
                      {b.created_at ? ` · ${formatDateTime(b.created_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void openPreview(b.paper_id)}
                      disabled={previewLoadingId === b.paper_id}
                    >
                      {previewLoadingId === b.paper_id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      Preview
                    </Button>
                    {confirmDelete === b.paper_id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(null)}
                          disabled={deletingId === b.paper_id}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void doDelete(b.paper_id)}
                          disabled={deletingId === b.paper_id}
                        >
                          {deletingId === b.paper_id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Confirm delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(b.paper_id)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete benchmark</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {previewError && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {previewError}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Preview: <code>{preview.paper_id}</code>
            </CardTitle>
            <CardDescription>{preview.paper_title}</CardDescription>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              <X className="size-3.5" />
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <BenchmarkPreview questions={preview.questions} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a benchmark</CardTitle>
          <CardDescription>
            Drag-drop your prepared 15-question JSON. It’s validated against the
            schema before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BenchmarkUploader onUploaded={() => void refresh()} />
        </CardContent>
      </Card>
    </div>
  );
}
