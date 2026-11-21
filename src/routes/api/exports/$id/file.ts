import { createFileRoute } from "@tanstack/react-router";
import { getFile } from "@/server/files";
import { memberOf, notFound } from "@/server/http";
import { getExport } from "@/server/projects";

// Downloads an export, for the project's owner only.
export const Route = createFileRoute("/api/exports/$id/file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await memberOf(request);
        if (user instanceof Response) return user;
        const found = await getExport(user.id, params.id);
        if (!found) return notFound();
        const object = await getFile(found.fileKey);
        if (!object) return notFound();
        const ext = found.contentType === "video/mp4" ? "mp4" : "webm";
        const base =
          found.projectName.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim() ||
          "video";
        const fileName = `${base} ${found.height}p.${ext}`;
        return new Response(object.body, {
          headers: {
            "content-type": found.contentType,
            "content-length": String(found.sizeBytes),
            "content-disposition": `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
