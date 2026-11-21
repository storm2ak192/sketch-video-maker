import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/animation";

/** Checks the file, uploads it, and returns the new project's id. */
export async function uploadImage(file: File): Promise<string> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Choose a JPG or PNG image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 10 MB or smaller.");
  }
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/projects", { method: "POST", body: form });
  const body = (await response.json().catch(() => null)) as {
    project?: { id: string };
    error?: string;
  } | null;
  if (!response.ok || !body?.project) {
    throw new Error(body?.error ?? "The upload didn't go through. Try again.");
  }
  return body.project.id;
}
