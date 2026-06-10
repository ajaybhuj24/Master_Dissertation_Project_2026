import { useState } from "react"
import { ChevronRight, Clock, FileText } from "lucide-react"

import type { PipelineResult } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { stageMeta } from "@/lib/stages"

function ms(n: number): string {
  return `${n.toLocaleString()} ms`
}

export function PipelineCard({ result }: { result: PipelineResult }) {
  const meta = stageMeta(result.stage)
  const [showContexts, setShowContexts] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const hasDebug = result.debug && Object.keys(result.debug).length > 0
  const nContexts = result.contexts.length

  return (
    <Card className={cn("gap-0 overflow-hidden border-l-4 py-0", meta.border)}>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate font-semibold leading-tight">
              {result.pipeline_name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  meta.text
                )}
              >
                <span className={cn("size-2 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              <Badge variant="outline" className="text-[10px]">
                ns: {result.namespace}
              </Badge>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            <Clock className="size-3" />
            {ms(result.latency_ms)}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {result.answer}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
          <span>retrieval {ms(result.retrieval_ms)}</span>
          <span>generation {ms(result.generation_ms)}</span>
        </div>
      </div>

      {nContexts === 0 ? (
        <div className="border-t px-4 py-2 text-sm text-muted-foreground">
          No contexts retrieved
        </div>
      ) : (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setShowContexts((v) => !v)}
            aria-expanded={showContexts}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                showContexts && "rotate-90"
              )}
            />
            {nContexts} retrieved context{nContexts === 1 ? "" : "s"}
          </button>
          {showContexts && (
            <ul className="space-y-2 px-4 pb-3">
              {result.contexts.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border bg-muted/30 p-2 text-xs"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="max-w-[220px] text-[10px]">
                      <FileText className="size-3" />
                      <span className="truncate">{c.source ?? "—"}</span>
                    </Badge>
                    {c.page != null && (
                      <Badge variant="outline" className="text-[10px]">
                        p.{c.page}
                      </Badge>
                    )}
                    {c.score != null && (
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        score {c.score.toFixed(3)}
                      </Badge>
                    )}
                  </div>
                  <p className="leading-relaxed text-foreground/80">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasDebug && (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            aria-expanded={showDebug}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                showDebug && "rotate-90"
              )}
            />
            Debug
          </button>
          {showDebug && (
            <pre className="max-h-64 overflow-auto px-4 pb-3 text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(result.debug, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Card>
  )
}
