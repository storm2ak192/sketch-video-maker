import { createFileRoute } from "@tanstack/react-router";
import { getFile } from "@/server/files";
import { memberOf, notFound } from "@/server/http";
import { getProjectImage } from "@/server/projects";

// The project's image, for its owner only.
export const Route = createFileRoute("/api/projects/$id/image")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const image = await getProjectImage(user.id, params.id);
        if (!image) return notFound();
        const object = await getFile(image.key);
        if (!object) return notFound();
        return new Response(object.body, {
          headers: {
            "content-type": image.type,
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
