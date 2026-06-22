import type { BenchmarkCategory, BenchmarkQuestion } from "@/types"
import { Badge } from "@/components/ui/badge"

const CATEGORY_ORDER: BenchmarkCategory[] = [
  "factual",
  "synthesis",
  "out_of_scope",
]

const CATEGORY_LABEL: Record<BenchmarkCategory, string> = {
  factual: "Factual",
  synthesis: "Synthesis",
  out_of_scope: "Out of scope",
}

export function BenchmarkPreview({
  questions,
}: {
  questions: BenchmarkQuestion[]
}) {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: questions.filter((q) => q.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      {groups.map(({ cat, items }) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{CATEGORY_LABEL[cat]}</h4>
            <Badge variant="secondary" className="text-[10px]">
              {items.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {items.map((q) => (
              <div key={q.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className="mt-0.5 shrink-0 text-[10px]"
                  >
                    {q.id}
                  </Badge>
                  <p className="text-sm font-medium">{q.question}</p>
                </div>

                {q.ground_truth ? (
                  <div className="pl-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Answer
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {q.ground_truth}
                    </p>
                  </div>
                ) : (
                  <p className="pl-1 text-sm italic text-muted-foreground">
                    Out of scope — the system should refuse to answer.
                  </p>
                )}

                {q.expected_passages.length > 0 && (
                  <details className="pl-1">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                      {q.expected_passages.length} supporting passage
                      {q.expected_passages.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {q.expected_passages.map((p, i) => (
                        <li
                          key={i}
                          className="rounded-md border bg-muted/30 p-2 text-xs leading-relaxed text-muted-foreground"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
