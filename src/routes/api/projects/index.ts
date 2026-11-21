import { createFileRoute } from "@tanstack/react-router";
import { isAdmin } from "@every-app/sdk/server";
import { UploadError, checkImage, nameFromFile, putFile } from "@/server/files";
import { badRequest, memberOf } from "@/server/http";
import { createProject, listProjects } from "@/server/projects";

// The member's projects; `?all=1` lists everyone's, for an admin only.
// POST takes a multipart `file` (JPG or PNG) and makes a project named after it.
export const Route = createFileRoute("/api/projects/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const all = new URL(request.url).searchParams.get("all") === "1";
        if (all && !isAdmin(user)) {
          return Response.json({ error: "Admins only." }, { status: 403 });
        }
        return Response.json({
          projects: await listProjects(all ? null : user.id),
        });
      },
      POST: async ({ request }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return badRequest("Choose a JPG or PNG image.");
        }
        const file = form.get("file");
        if (!(file instanceof File)) {
          return badRequest("Choose a JPG or PNG image.");
        }
        try {
          const imageType = await checkImage(file);
          const id = crypto.randomUUID();
          const imageKey = `projects/${id}/image`;
          await putFile(imageKey, file, imageType);
          const project = await createProject(user.id, {
            id,
            name: nameFromFile(file.name),
            imageKey,
            imageType,
            imageBytes: file.size,
          });
          return Response.json({ project }, { status: 201 });
        } catch (error) {
          if (error instanceof UploadError) return badRequest(error.message);
          throw error;
        }
      },
    },
  },
});
