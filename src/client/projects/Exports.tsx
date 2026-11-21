import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button, buttonVariants } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/format";
import { formatBytes, formatSeconds } from "@/lib/animation";
import type { VideoExport } from "@/server/projects";
import { removeExport } from "@/serverFunctions/projects";
import { messageOf } from "./dialogs";

export function ExportList({
  exports,
  onChange,
}: {
  exports: VideoExport[];
  onChange: () => void;
}) {
  const [deleting, setDeleting] = useState<VideoExport | null>(null);
  const [pending, setPending] = useState(false);

  if (exports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No exports yet. Exported videos appear here.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Exported</TableHead>
              <TableHead>Resolution</TableHead>
              <TableHead>Length</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exports.map((item) => (
              <TableRow key={item.id} data-testid="export-row">
                <TableCell className="pl-4" suppressHydrationWarning>
                  {formatDate(item.createdAt)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {item.width}×{item.height}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatSeconds(item.durationSeconds)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatBytes(item.sizeBytes)}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <a
                      href={`/api/exports/${item.id}/file`}
                      download
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Download data-icon="inline-start" />
                      Download
                    </a>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete export"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {deleting ? (
        <ConfirmDialog
          title="Delete this export?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await removeExport({ data: { id: deleting.id } });
              setDeleting(null);
              onChange();
            } catch (cause) {
              toast.error(messageOf(cause));
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
