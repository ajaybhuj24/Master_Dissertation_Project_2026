import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stages = [
  {
    label: "Baseline",
    color: "bg-stage-baseline",
    pipelines: ["naive"],
  },
  {
    label: "Pre-retrieval",
    color: "bg-stage-pre",
    pipelines: ["semantic_chunking", "multi_query"],
  },
  {
    label: "During-retrieval",
    color: "bg-stage-during",
    pipelines: ["mmr", "rerank", "crag"],
  },
  {
    label: "Post-retrieval",
    color: "bg-stage-post",
    pipelines: ["compression", "selfcheck"],
  },
];

export function InteractivePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Interactive query
        </h1>
        <p className="text-muted-foreground">
          Ask one question and compare answers across the 8 pipelines
          side-by-side.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
          <CardDescription>Per-pipeline cards.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${stage.color}`}
                  aria-hidden
                />
                <span className="text-sm font-medium">{stage.label}</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {stage.pipelines.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
