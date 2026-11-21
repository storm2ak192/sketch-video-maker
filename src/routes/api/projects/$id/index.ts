import { createFileRoute } from "@tanstack/react-router";
import { isAdmin } from "@every-app/sdk/server";
import { deleteFiles } from "@/server/files";
import { badRequest, memberOf, notFound } from "@/server/http";
import {
  deleteProject,
  getProjectWithExports,
  updateProject,
  updateProjectInput,
} from "@/server/projects";

// One project with its exports. PATCH renames it or saves its options;
// DELETE removes it, its image and every export (an admin may delete any).
export const Route = createFileRoute("/api/projects/$id/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const found = await getProjectWithExports(user.id, params.id);
        return found ? Response.json(found) : notFound();
      },
      PATCH: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const parsed = updateProjectInput.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success) {
          return badRequest(parsed.error.issues[0]?.message ?? "Invalid");
        }
        const project = await updateProject(user.id, params.id, parsed.data);
        return project ? Response.json({ project }) : notFound();
      },
      DELETE: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const keys = await deleteProject(
          isAdmin(user) ? null : user.id,
          params.id,
        );
        if (!keys) return notFound();
        await deleteFiles(keys);
        return Response.json({ deleted: params.id });
      },
    },
  },
});
