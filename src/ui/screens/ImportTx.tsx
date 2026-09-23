import { LinkIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Textarea } from "../../components/ui/textarea.tsx";
import type { Session } from "../session.ts";
import { BusyIcon } from "../tx-parts.tsx";

export function ImportTx({
  session,
  busy,
  onImportFile,
  onImportLink,
}: {
  session: Session | null;
  busy: string | null;
  onImportFile: (file: File) => void;
  onImportLink: (link: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {session?.rpcUrl ? (
        <p className="text-sm text-muted-foreground">
          Signatures inside are checked against the Safe's current owners through your RPC before
          they are accepted.
        </p>
      ) : (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Not connected</AlertTitle>
          <AlertDescription>
            You can review the transaction, but its signatures are only checked once you connect.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>From a file</CardTitle>
            <CardDescription>The .locsafe.json file another owner sent you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              data-testid="import-form"
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
                const file = input.files?.[0];
                if (file) onImportFile(file);
              }}
            >
              <Input
                name="file"
                type="file"
                required
                accept=".json,.locsafe.json"
                aria-label="Transaction file"
              />
              <Button type="submit" className="w-fit" disabled={busy === "import-file"}>
                <BusyIcon busy={busy === "import-file"}>
                  <UploadIcon />
                </BusyIcon>
                Import package
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>From a link</CardTitle>
            <CardDescription>A share link that contains the transaction.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                onImportLink(String(new FormData(event.currentTarget).get("link") ?? "").trim());
              }}
            >
              <Textarea
                name="link"
                required
                rows={2}
                placeholder="https://…/#/p/…"
                aria-label="Share link"
                spellCheck={false}
                className="font-mono"
              />
              <Button type="submit" className="w-fit" disabled={busy === "import-link"}>
                <BusyIcon busy={busy === "import-link"}>
                  <LinkIcon />
                </BusyIcon>
                Open link
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
