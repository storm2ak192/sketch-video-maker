import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { removeProject, renameProject } from "@/serverFunctions/projects";

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function RenameDialog({
  project,
  onClose,
  onDone,
}: {
  project: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = name.trim();
    if (!next) {
      setError("Give it a name.");
      return;
    }
    setPending(true);
    try {
      await renameProject({ data: { id: project.id, name: next } });
      onDone();
      onClose();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              maxLength={120}
              autoFocus
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProjectDialog({
  project,
  onClose,
  onDone,
}: {
  project: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmDialog
      title={`Delete “${project.name}”?`}
      confirmLabel="Delete"
      destructive
      pending={pending}
      onClose={onClose}
      onConfirm={async () => {
        setPending(true);
        try {
          await removeProject({ data: { id: project.id } });
          onClose();
          onDone();
        } catch (cause) {
          toast.error(messageOf(cause));
          setPending(false);
        }
      }}
    >
      The image and all its exports are deleted too.
    </ConfirmDialog>
  );
}
