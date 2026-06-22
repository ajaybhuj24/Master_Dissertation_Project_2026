import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react"

import { cancelJob } from "@/api/client"
import type { JobStatusLiteral } from "@/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Progress = {
  status: JobStatusLiteral
  completed: number
  currentQuestion: string | null
  currentPipeline: string | null
}

export function ProgressTracker({
  jobId,
  total,
  onDone,
}: {
  jobId: string
  total: number
  onDone?: (status: JobStatusLiteral) => void
}) {
  const [progress, setProgress] = useState<Progress>({
    status: "running",
    completed: 0,
    currentQuestion: null,
    currentPipeline: null,
  })
  const [streamError, setStreamError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    doneRef.current = false
    const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`)

    es.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data)
        setProgress({
          status: d.status,
          completed: d.completed,
          currentQuestion: d.current_question,
          currentPipeline: d.current_pipeline,
        })
      } catch {
      }
    })

    es.addEventListener("done", (e) => {
      doneRef.current = true
      try {
        const d = JSON.parse((e as MessageEvent).data)
        setProgress((p) => ({ ...p, status: d.status, completed: d.completed }))
        onDoneRef.current?.(d.status)
      } catch {
      }
      es.close()
    })

    es.onerror = () => {
      if (!doneRef.current)
        setStreamError("Lost connection to the progress stream.")
      es.close()
    }

    return () => es.close()
  }, [jobId])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await cancelJob(jobId)
    } catch {
    } finally {
      setCancelling(false)
    }
  }

  const pct = total > 0 ? Math.round((progress.completed / total) * 100) : 0
  const { status } = progress
  const isActive = status === "running" || status === "pending"

  const barColor =
    status === "completed"
      ? "bg-stage-during"
      : status === "failed"
        ? "bg-destructive"
        : status === "cancelled"
          ? "bg-muted-foreground"
          : "bg-primary"

  const statusBadge = (() => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-stage-during text-white">
            <CheckCircle2 className="size-3" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="size-3" />
            Failed
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="secondary">
            <Ban className="size-3" />
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Loader2 className="size-3 animate-spin" />
            {status === "pending" ? "Starting…" : "Running"}
          </Badge>
        )
    }
  })()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {statusBadge}
        <span className="text-sm tabular-nums text-muted-foreground">
          {progress.completed} / {total} units ({pct}%)
        </span>
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void handleCancel()}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Ban className="size-3.5" />
            )}
            Cancel
          </Button>
        )}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isActive && (progress.currentPipeline || progress.currentQuestion) && (
        <p className="text-sm text-muted-foreground">
          Now scoring{" "}
          {progress.currentPipeline && (
            <code>{progress.currentPipeline}</code>
          )}
          {progress.currentQuestion && (
            <>
              {" "}
              on question <code>{progress.currentQuestion}</code>
            </>
          )}
          …
        </p>
      )}

      {streamError && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {streamError}
        </p>
      )}
    </div>
  )
}
