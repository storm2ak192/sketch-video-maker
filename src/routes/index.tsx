import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ImagePlus, MoreHorizontal, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  DeleteProjectDialog,
  RenameDialog,
  messageOf,
} from "@/client/projects/dialogs";
import { uploadImage } from "@/client/projects/upload";
import { formatDate } from "@/client/lib/format";
import { getProjects } from "@/serverFunctions/projects";

export const Route = createFileRoute("/")({
  loader: () => getProjects(),
  head: () => ({ meta: [{ title: "Projects · Sketch Video Maker" }] }),
  component: Projects,
});

type ProjectItem = Awaited<ReturnType<typeof getProjects>>[number];

function Projects() {
  const projects = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<ProjectItem | null>(null);
  const [deleting, setDeleting] = useState<ProjectItem | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const id = await uploadImage(file);
      await navigate({ to: "/projects/$id", params: { id } });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  return (
    <AppShell>
      <PageHeader
        title="Projects"
        description="Drop a JPG or PNG up to 10 MB anywhere here."
        actions={
          <Button pending={uploading} onClick={() => input.current?.click()}>
            {uploading ? null : <Upload data-icon="inline-start" />}
            Upload image
          </Button>
        }
      />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="upload-input"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <div
        className={
          dragging
            ? "-m-2 space-y-4 rounded-xl p-2 ring-2 ring-primary"
            : "-m-2 space-y-4 p-2"
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setDragging(false);
          }
        }}
        onDrop={onDrop}
      >
        {error ? (
          <Alert variant="destructive" data-testid="upload-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {projects.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            size="lg"
            title="No projects yet"
            description="Upload a picture to make your first drawing video."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard
                  project={project}
                  onRename={() => setRenaming(project)}
                  onDelete={() => setDeleting(project)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {renaming ? (
        <RenameDialog
          project={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => void router.invalidate()}
        />
      ) : null}
      {deleting ? (
        <DeleteProjectDialog
          project={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => void router.invalidate()}
        />
      ) : null}
    </AppShell>
  );
}

function ProjectCard({
  project,
  onRename,
  onDelete,
}: {
  project: ProjectItem;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="project-card">
      <Link
        to="/projects/$id"
        params={{ id: project.id }}
        className="block aspect-video bg-muted"
      >
        <img
          src={`/api/projects/${project.id}/image`}
          alt=""
          loading="lazy"
          className="size-full object-contain"
        />
      </Link>
      <div className="flex items-start justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <Link
            to="/projects/$id"
            params={{ id: project.id }}
            className="block truncate font-medium hover:underline"
          >
            {project.name}
          </Link>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Updated {formatDate(project.updatedAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${project.name}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
