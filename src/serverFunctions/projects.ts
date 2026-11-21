import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { optionsSchema } from "@/lib/animation";
import { deleteFiles } from "@/server/files";
import * as projects from "@/server/projects";

// The pages' calls. Each runs behind ensureUserMiddleware, and every query
// takes `context.user.id`, so a member only ever reaches their own projects.

const byId = z.object({ id: z.string() }).strict();

export const getProjects = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await projects.ensureUser(user);
    return projects.listProjects(user.id);
  });

export const getProjectPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(({ data, context: { user } }) =>
    projects.getProjectWithExports(user.id, data.id),
  );

export const renameProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z
      .object({ id: z.string(), name: projects.projectNameSchema })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    const project = await projects.updateProject(user.id, data.id, {
      name: data.name,
    });
    if (!project) throw new Error("Project not found");
    return project;
  });

export const saveOptions = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string(), options: optionsSchema }).strict().parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    const project = await projects.updateProject(user.id, data.id, {
      options: data.options,
    });
    if (!project) throw new Error("Project not found");
    return project;
  });

export const removeProject = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const keys = await projects.deleteProject(user.id, data.id);
    if (!keys) throw new Error("Project not found");
    await deleteFiles(keys);
    return { deleted: data.id };
  });

export const removeExport = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => byId.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const key = await projects.deleteExport(user.id, data.id);
    if (!key) throw new Error("Export not found");
    await deleteFiles([key]);
    return { deleted: data.id };
  });
