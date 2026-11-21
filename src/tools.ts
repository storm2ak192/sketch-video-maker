// The app's tools for AI clients, served by the Gateway at /mcp and called
// with the signed-in user. They use the same queries as the pages.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { optionsSchema } from "@/lib/animation";
import * as projects from "@/server/projects";

export const tools = defineTools(
  {
    list_projects: {
      description:
        "List the user's image projects with their animation options, newest first.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => projects.listProjects(user.id),
    },
    rename_project: {
      description: "Rename one of the user's projects.",
      risk: "write",
      idempotent: true,
      input: z
        .object({ id: z.string(), name: projects.projectNameSchema })
        .strict(),
      handler: async ({ id, name }, { user }) =>
        (await projects.updateProject(user.id, id, { name })) ??
        raise("No project with that id"),
    },
    set_animation_options: {
      description:
        "Set a project's hand, sketch style (bw, gray, color), sketch seconds (1-50), colour seconds (0-50) and quality (720p or 1080p).",
      risk: "write",
      idempotent: true,
      input: z.object({ id: z.string(), options: optionsSchema }).strict(),
      handler: async ({ id, options }, { user }) =>
        (await projects.updateProject(user.id, id, { options })) ??
        raise("No project with that id"),
    },
  },
  {
    instructions:
      "Never guess project ids: call list_projects first. New projects are made by uploading an image in the app.",
  },
);

function raise(message: string): never {
  throw new ToolError(message);
}
