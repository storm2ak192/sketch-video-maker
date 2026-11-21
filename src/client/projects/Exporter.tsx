import { Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/client/components/ui/progress";
import type { Scene } from "@/client/sketch/player";
import { recordVideo, recordingSupported } from "@/client/sketch/record";
import { totalSeconds, type AnimationOptions } from "@/lib/animation";
import { messageOf } from "./dialogs";

/** Records the animation at the chosen quality and saves it to the project. */
export function useExporter({
  projectId,
  scene,
  options,
  onSaved,
}: {
  projectId: string;
  scene: Scene | null;
  options: AnimationOptions | null;
  onSaved: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupported(recordingSupported());
    return () => abort.current?.abort();
  }, []);

  async function run() {
    if (!scene || !options) return;
    setError(null);
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const file = await recordVideo(
        scene,
        options,
        setProgress,
        controller.signal,
      );
      setSaving(true);
      const form = new FormData();
      form.set("file", file);
      form.set("quality", options.quality);
      form.set("durationSeconds", String(totalSeconds(options)));
      const response = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "The video couldn't be saved.");
      }
      toast.success("Video exported");
      onSaved();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(messageOf(cause));
      }
    } finally {
      abort.current = null;
      setProgress(null);
      setSaving(false);
    }
  }

  const button = supported ? (
    <Button onClick={run} disabled={!scene || !options || progress !== null}>
      <Film data-icon="inline-start" />
      Export video
    </Button>
  ) : null;

  const status = !supported ? (
    <Alert>
      <AlertDescription>
        This browser can't record video. Try a recent Chrome, Edge or Firefox.
      </AlertDescription>
    </Alert>
  ) : progress !== null || error ? (
    <div className="space-y-3">
      {progress !== null ? (
        <div className="flex items-end gap-3">
          <Progress
            value={saving ? 100 : Math.round(progress * 100)}
            className="flex-1"
            data-testid="export-progress"
          >
            <ProgressLabel>{saving ? "Saving…" : "Rendering…"}</ProgressLabel>
            <ProgressValue />
          </Progress>
          {saving ? null : (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          )}
        </div>
      ) : null}
      {progress !== null && !saving ? (
        <p className="text-sm text-muted-foreground">
          Keep this tab open until rendering finishes.
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  ) : null;

  return { button, status };
}
