import { createFileRoute } from "@tanstack/react-router";
import { UploadError, checkVideo, putFile } from "@/server/files";
import { badRequest, memberOf, notFound } from "@/server/http";
import { createExport, createExportInput, getProject } from "@/server/projects";

// Saves a video the page rendered: multipart `file`, `quality`, `durationSeconds`.
export const Route = createFileRoute("/api/projects/$id/exports")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const project = await getProject(user.id, params.id);
        if (!project) return notFound();
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!form || !(file instanceof File)) return badRequest("No video.");
        const meta = createExportInput.safeParse({
          quality: form.get("quality"),
          durationSeconds: form.get("durationSeconds"),
        });
        if (!meta.success) return badRequest("Invalid export details.");
        try {
          const contentType = checkVideo(file);
          const id = crypto.randomUUID();
          const fileKey = `projects/${project.id}/exports/${id}`;
          await putFile(fileKey, file, contentType);
          const saved = await createExport(user.id, project.id, {
            ...meta.data,
            id,
            fileKey,
            contentType,
            sizeBytes: file.size,
          });
          return Response.json({ export: saved }, { status: 201 });
        } catch (error) {
          if (error instanceof UploadError) return badRequest(error.message);
          throw error;
        }
      },
    },
  },
});
