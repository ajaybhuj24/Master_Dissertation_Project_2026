import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function UploadPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Upload paper</h1>
        <p className="text-muted-foreground">
          Ingest a PDF into the <code>naive</code> and <code>semantic</code>{" "}
          Pinecone namespaces.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>PDF ingestion</CardTitle>
          <CardDescription>
            Drag-and-drop upload arrives in step F2.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Single-PDF mode: uploading a new paper deletes the previous paper's
          vectors before embedding the new one.
        </CardContent>
      </Card>
    </div>
  );
}
