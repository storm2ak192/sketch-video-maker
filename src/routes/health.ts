import { createFileRoute } from "@tanstack/react-router";

// A JSON endpoint for an uptime monitor (with a personal access token).
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
