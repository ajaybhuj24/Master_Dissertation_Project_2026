import { useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react"

import { benchmarkValidationErrors, uploadBenchmark } from "@/api/client"
import type {
  BenchmarkCategory,
  BenchmarkQuestion,
  BenchmarkUploadResponse,
  ValidationErrorItem,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dropzone } from "@/components/Dropzone"
import { BenchmarkPreview } from "@/components/BenchmarkPreview"

type Phase = "idle" | "selected" | "uploading" | "success" | "error"

const CATEGORIES = ["factual", "synthesis", "out_of_scope"]

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function normalizeQuestions(raw: unknown): BenchmarkQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw.map((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>
    const category = CATEGORIES.includes(o.category as string)
      ? (o.category as BenchmarkCategory)
      : "factual"
    return {
      id: typeof o.id === "string" ? o.id : `q${i + 1}`,
      category,
      question: typeof o.question === "string" ? o.question : "",
      ground_truth: typeof o.ground_truth === "string" ? o.ground_truth : null,
      expected_passages: Array.isArray(o.expected_passages)
        ? o.expected_passages.filter((p): p is string => typeof p === "string")
        : [],
    }
  })
}

export function BenchmarkUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [raw, setRaw] = useState<unknown>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<BenchmarkUploadResponse | null>(null)
  const [validationErrors, setValidationErrors] = useState<
    ValidationErrorItem[] | null
  >(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const meta =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const paperId = typeof meta.paper_id === "string" ? meta.paper_id : undefined
  const paperTitle =
    typeof meta.paper_title === "string" ? meta.paper_title : undefined
  const previewQuestions = normalizeQuestions(meta.questions)

  const onSelectFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".json")) {
      setParseError("Please choose a .json file.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        setFile(f)
        setRaw(parsed)
        setParseError(null)
        setResult(null)
        setValidationErrors(null)
        setErrorMsg(null)
        setPhase("selected")
      } catch {
        setParseError("That file isn’t valid JSON.")
      }
    }
    reader.onerror = () => setParseError("Couldn’t read the file.")
    reader.readAsText(f)
  }

  const reset = () => {
    setFile(null)
    setRaw(null)
    setPhase("idle")
    setParseError(null)
    setResult(null)
    setValidationErrors(null)
    setErrorMsg(null)
  }

  const doUpload = async () => {
    if (!file) return
    setPhase("uploading")
    setErrorMsg(null)
    setValidationErrors(null)
    try {
      const res = await uploadBenchmark(file)
      setResult(res)
      setPhase("success")
      onUploaded?.()
    } catch (err) {
      const ve = benchmarkValidationErrors(err)
      if (ve) setValidationErrors(ve)
      else setErrorMsg(err instanceof Error ? err.message : "Upload failed.")
      setPhase("error")
    }
  }

  return (
    <div className="space-y-4">
      {phase === "idle" && (
        <>
          <Dropzone accept=".json,application/json" onFile={onSelectFile}>
            <UploadCloud className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">
                Drop your benchmark JSON here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                A 15-question file matching the benchmark schema
              </p>
            </div>
          </Dropzone>
          {parseError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {parseError}
            </p>
          )}
        </>
      )}

      {(phase === "selected" ||
        phase === "uploading" ||
        phase === "error") && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <FileJson className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file?.name}</p>
              <p className="text-sm text-muted-foreground">
                {file ? formatBytes(file.size) : ""}
                {paperId ? ` · paper_id: ${paperId}` : ""}
              </p>
            </div>
            {phase !== "uploading" && (
              <Button variant="ghost" size="icon" onClick={reset}>
                <X className="size-4" />
                <span className="sr-only">Clear</span>
              </Button>
            )}
          </div>

          {validationErrors && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="size-4" />
                {validationErrors.length} schema problem
                {validationErrors.length === 1 ? "" : "s"} — fix the file and
                re-upload
              </p>
              <ul className="space-y-1 text-sm">
                {validationErrors.map((e, i) => (
                  <li key={i} className="text-muted-foreground">
                    <code className="text-foreground">
                      {e.loc.length ? e.loc.join(" → ") : "(root)"}
                    </code>{" "}
                    — {e.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errorMsg && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void doUpload()}
              disabled={phase === "uploading"}
            >
              {phase === "uploading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              {phase === "uploading" ? "Validating…" : "Upload & validate"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={phase === "uploading"}>
              Choose a different file
            </Button>
            {previewQuestions.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {previewQuestions.length} questions
              </span>
            )}
          </div>

          {previewQuestions.length > 0 && (
            <div className="space-y-2">
              {paperTitle && (
                <p className="text-sm font-medium">{paperTitle}</p>
              )}
              <BenchmarkPreview questions={previewQuestions} />
            </div>
          )}
        </div>
      )}

      {phase === "success" && result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-stage-during/40 bg-stage-during/5 p-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-stage-during" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Benchmark saved</p>
              <p className="text-sm text-muted-foreground">
                {result.paper_title} · <code>{result.paper_id}</code> ·{" "}
                {result.question_count} questions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(result.category_counts).map(([cat, n]) => (
              <Badge key={cat} variant="secondary">
                {cat}: {n}
              </Badge>
            ))}
          </div>

          {result.paper_mismatch_warning && (
            <div className="flex items-start gap-2 rounded-lg border border-stage-post/40 bg-stage-post/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stage-post" />
              <span>
                This benchmark is for{" "}
                <code>{result.paper_mismatch_warning.benchmark_paper_id}</code>,
                but the loaded paper is{" "}
                <code>
                  {result.paper_mismatch_warning.loaded_paper_id ?? "none"}
                </code>
                . You can still run it once the matching paper is loaded.
              </span>
            </div>
          )}

          <Button variant="outline" onClick={reset}>
            <UploadCloud className="size-4" />
            Upload another
          </Button>
        </div>
      )}
    </div>
  )
}
