import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BatchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Batch run</h1>
        <p className="text-muted-foreground">
          Run the 15-question benchmark across all 8 pipelines (120 evaluations)
          and stream live progress.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Benchmark + progress</CardTitle>
          <CardDescription>Benchmark uploader next.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Each run appends per-question RAGAS scores to the master results CSV,
          keyed by <code>paper_id</code> + <code>run_id</code>.
        </CardContent>
      </Card>
    </div>
  );
}
