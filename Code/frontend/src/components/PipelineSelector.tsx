import type { PipelineInfo } from "@/types"
import { STAGE_ORDER, stageMeta } from "@/lib/stages"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function PipelineSelector({
  pipelines,
  value,
  onChange,
  disabled,
}: {
  pipelines: PipelineInfo[]
  value: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
}) {
  const grouped: Record<string, PipelineInfo[]> = {}
  for (const p of pipelines) (grouped[p.stage] ??= []).push(p)

  const selectedCount = pipelines.filter((p) => value.has(p.pipeline_id)).length

  const toggleOne = (id: string) => {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const toggleStage = (stage: string) => {
    const ids = (grouped[stage] ?? []).map((p) => p.pipeline_id)
    const allOn = ids.every((id) => value.has(id))
    const next = new Set(value)
    for (const id of ids) {
      if (allOn) next.delete(id)
      else next.add(id)
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || selectedCount === pipelines.length}
          onClick={() => onChange(new Set(pipelines.map((p) => p.pipeline_id)))}
        >
          All
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || selectedCount === 0}
          onClick={() => onChange(new Set())}
        >
          None
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {selectedCount}/{pipelines.length} selected
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGE_ORDER.filter((s) => grouped[s]?.length).map((stage) => {
          const meta = stageMeta(stage)
          const items = grouped[stage] ?? []
          const onCount = items.filter((p) => value.has(p.pipeline_id)).length
          return (
            <div key={stage} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleStage(stage)}
                disabled={disabled}
                className="flex w-full items-center gap-2 text-left disabled:opacity-60"
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
                    className={cn(
                      "flex items-center gap-2 text-sm",
                      disabled ? "cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={value.has(p.pipeline_id)}
                      disabled={disabled}
                      onChange={() => toggleOne(p.pipeline_id)}
                    />
                    <span>{p.pipeline_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
