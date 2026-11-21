import { createFileRoute } from "@tanstack/react-router";
import { deleteFiles } from "@/server/files";
import { memberOf, notFound } from "@/server/http";
import { deleteExport } from "@/server/projects";

export const Route = createFileRoute("/api/exports/$id/")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const key = await deleteExport(user.id, params.id);
        if (!key) return notFound();
        await deleteFiles([key]);
        return Response.json({ deleted: params.id });
      },
    },
  },
});
