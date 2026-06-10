import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const metrics = [
  { label: "Faithfulness", color: "text-metric-faithfulness" },
  { label: "Answer relevancy", color: "text-metric-answer-relevancy" },
  { label: "Context precision", color: "text-metric-context-precision" },
  { label: "Context recall", color: "text-metric-context-recall" },
];

export function ResultsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          Per-stage means across the four RAGAS metrics, with CSV download.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
          <CardDescription>Tables and grouped-bar charts .</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {metrics.map((m) => (
            <span key={m.label} className={m.color}>
              {m.label}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
