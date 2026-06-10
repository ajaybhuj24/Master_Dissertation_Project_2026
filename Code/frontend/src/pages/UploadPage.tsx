import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"

import { deletePaper, getCurrentPaper, uploadPdf } from "@/api/client"
import type { CurrentPaperResponse, UploadResponse } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Dropzone } from "@/components/Dropzone"

type Phase =
  | "idle"
  | "selected"
  | "uploading"
  | "processing"
  | "success"
  | "error"

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function pdfError(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "Only PDF files are accepted."
  if (file.size === 0) return "That file is empty."
  return null
}

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [uploadPct, setUploadPct] = useState(0)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  const [current, setCurrent] = useState<CurrentPaperResponse | null>(null)
  const [currentLoading, setCurrentLoading] = useState(true)
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  const busy = phase === "uploading" || phase === "processing"

  const refreshCurrent = useCallback(async () => {
    setCurrentLoading(true)
    setCurrentError(null)
    try {
      const paper = await getCurrentPaper()
      setCurrent(paper.paper_id ? paper : null)
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Failed to load.")
      setCurrent(null)
    } finally {
      setCurrentLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCurrent()
  }, [refreshCurrent])

  const onSelectFile = (picked: File) => {
    const err = pdfError(picked)
    if (err) {
      setSelectError(err)
      return
    }
    setSelectError(null)
    setUploadError(null)
    setResult(null)
    setFile(picked)
    setPhase("selected")
  }

  const reset = () => {
    setFile(null)
    setPhase("idle")
    setUploadPct(0)
    setResult(null)
    setUploadError(null)
    setSelectError(null)
  }

  const startUpload = async () => {
    if (!file) return
    setPhase("uploading")
    setUploadPct(0)
    setUploadError(null)
    try {
      const res = await uploadPdf(file, (pct) => {
        setUploadPct(pct)
        if (pct >= 100) setPhase("processing")
      })
      setResult(res)
      setPhase("success")
      void refreshCurrent()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.")
      setPhase("error")
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setCurrentError(null)
    try {
      await deletePaper()
      setCurrent(null)
      setConfirmRemove(false)
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Failed to remove.")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Upload paper</h1>
        <p className="text-muted-foreground">
          Ingest a PDF into the <code>naive</code> and <code>semantic</code>{" "}
          Pinecone namespaces. Single-PDF mode — a new upload replaces the
          resident paper.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Current paper
          </CardTitle>
          <CardDescription>
            The paper currently resident in the vector store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking…
            </div>
          ) : currentError ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{currentError}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => void refreshCurrent()}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : current ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{current.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    Loaded {formatDateTime(current.uploaded_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{current.pages ?? "?"} pages</Badge>
                <Badge variant="secondary">
                  naive: {current.naive_chunks ?? "?"}
                </Badge>
                <Badge variant="secondary">
                  semantic: {current.semantic_chunks ?? "?"}
                </Badge>
              </div>

              {confirmRemove ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <AlertTriangle className="size-4 shrink-0 text-destructive" />
                  <span className="text-sm">
                    Remove this paper and clear both namespaces?
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRemove(false)}
                      disabled={removing}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleRemove()}
                      disabled={removing}
                    >
                      {removing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Confirm remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 className="size-3.5" />
                  Remove paper
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No paper loaded yet. Upload one below to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {phase === "success" ? "Upload complete" : "Upload a PDF"}
          </CardTitle>
          <CardDescription>
            {phase === "success"
              ? "The paper has been chunked and embedded into both namespaces."
              : "Drag a PDF here or click to browse."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === "idle" && (
            <>
              <Dropzone accept=".pdf,application/pdf" onFile={onSelectFile}>
                <UploadCloud className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">
                    Drop your PDF here, or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF only · processed locally against your backend
                  </p>
                </div>
              </Dropzone>
              {selectError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {selectError}
                </p>
              )}
            </>
          )}

          {phase === "selected" && file && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={reset}>
                  <X className="size-4" />
                  <span className="sr-only">Clear selection</span>
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void startUpload()}>
                  <UploadCloud className="size-4" />
                  Upload &amp; ingest
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Choose a different file
                </Button>
              </div>
            </div>
          )}

          {busy && file && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate font-medium">
                  {file.name}
                </p>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {phase === "uploading" ? `${uploadPct}%` : "processing"}
                </span>
              </div>

              {phase === "uploading" ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  <span>
                    Chunking &amp; embedding on the server (naive +
                    semantic)… this can take 30–90s for a large paper.
                  </span>
                </div>
              )}
            </div>
          )}

          {phase === "success" && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-stage-during/40 bg-stage-during/5 p-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-stage-during" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{result.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    Ingested {formatDateTime(result.uploaded_at)} · paper_id{" "}
                    <code>{result.paper_id}</code>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{result.pages} pages</Badge>
                <Badge variant="secondary">
                  naive: {result.naive_chunks} chunks
                </Badge>
                <Badge variant="secondary">
                  semantic: {result.semantic_chunks} chunks
                </Badge>
                {result.namespaces_cleared.map((ns) => (
                  <Badge key={ns} variant="outline">
                    cleared: {ns}
                  </Badge>
                ))}
              </div>
              <Button onClick={reset}>
                <UploadCloud className="size-4" />
                Upload another
              </Button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Upload failed</p>
                  <p className="text-sm text-muted-foreground">{uploadError}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {file && (
                  <Button onClick={() => void startUpload()}>
                    <RefreshCw className="size-4" />
                    Try again
                  </Button>
                )}
                <Button variant="ghost" onClick={reset}>
                  Choose another file
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
