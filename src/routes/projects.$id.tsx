import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { formatDate } from "@/client/lib/format";
import {
  DeleteProjectDialog,
  RenameDialog,
  messageOf,
} from "@/client/projects/dialogs";
import { ExportList } from "@/client/projects/Exports";
import { useExporter } from "@/client/projects/Exporter";
import {
  OptionsForm,
  draftOf,
  readDraft,
  type Draft,
} from "@/client/projects/OptionsForm";
import { Preview } from "@/client/projects/Preview";
import { buildScene, loadImage, type Scene } from "@/client/sketch/player";
import type { AnimationOptions } from "@/lib/animation";
import { getProjectPage, saveOptions } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/$id")({
  loader: ({ params }) => getProjectPage({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.project.name} · Sketch Video Maker`
          : "Sketch Video Maker",
      },
    ],
  }),
  component: ProjectPage,
});

const backLink = (
  <Link
    to="/"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
  >
    <ChevronLeft className="size-4" aria-hidden />
    Projects
  </Link>
);

function ProjectPage() {
  const data = Route.useLoaderData();
  if (!data) {
    return (
      <AppShell>
        <PageHeader
          title="Project not found"
          description="It was deleted, or it belongs to someone else."
          backLink={backLink}
        />
      </AppShell>
    );
  }
  return <Project key={data.project.id} {...data} />;
}

type PageData = NonNullable<Awaited<ReturnType<typeof getProjectPage>>>;

function Project({ project, exports }: PageData) {
  const router = useRouter();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => draftOf(project.options));
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);

  const { options: parsed } = readDraft(draft);
  const key = parsed ? JSON.stringify(parsed) : null;
  // One object per distinct set of options, so the preview resets only on a change.
  const options: AnimationOptions = useMemo(
    () => (key ? (JSON.parse(key) as AnimationOptions) : project.options),
    [key, project.options],
  );
  const changed = key !== null && key !== JSON.stringify(project.options);

  useEffect(() => {
    let live = true;
    loadImage(`/api/projects/${project.id}/image`)
      .then((img) => live && setImage(img))
      .catch(() => live && setImageError(true));
    return () => {
      live = false;
    };
  }, [project.id]);

  const scene: Scene | null = useMemo(
    () => (image ? buildScene(image, options.quality) : null),
    [image, options.quality],
  );

  const exporter = useExporter({
    projectId: project.id,
    scene,
    options: parsed,
    onSaved: () => void router.invalidate(),
  });

  async function save() {
    if (!parsed) return;
    setSaving(true);
    try {
      await saveOptions({ data: { id: project.id, options: parsed } });
      toast.success("Options saved");
      await router.invalidate();
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        backLink={backLink}
        title={project.name}
        description={
          <span suppressHydrationWarning>
            Updated {formatDate(project.updatedAt)}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("rename")}>
              <Pencil data-icon="inline-start" />
              Rename
            </Button>
            <Button variant="outline" onClick={() => setDialog("delete")}>
              <Trash2 data-icon="inline-start" />
              Delete project
            </Button>
          </>
        }
      />

      <Section title="Preview">
        {imageError ? (
          <Alert variant="destructive">
            <AlertDescription>
              The image couldn't be loaded. Reload the page to try again.
            </AlertDescription>
          </Alert>
        ) : (
          <Preview scene={scene} options={options} actions={exporter.button} />
        )}
        {exporter.status}
      </Section>

      <Section title="Exports">
        <ExportList
          exports={exports}
          onChange={() => void router.invalidate()}
        />
      </Section>

      <Section
        title="Options"
        action={
          <Button onClick={save} pending={saving} disabled={!changed}>
            Save options
          </Button>
        }
      >
        <div className="rounded-xl border border-border bg-card p-5">
          <OptionsForm draft={draft} onChange={setDraft} />
        </div>
      </Section>

      {dialog === "rename" ? (
        <RenameDialog
          project={project}
          onClose={() => setDialog(null)}
          onDone={() => void router.invalidate()}
        />
      ) : null}
      {dialog === "delete" ? (
        <DeleteProjectDialog
          project={project}
          onClose={() => setDialog(null)}
          onDone={() => void navigate({ to: "/" })}
        />
      ) : null}
    </AppShell>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
