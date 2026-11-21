import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { exports, projects, users } from "@/db/schema";
import {
  DEFAULT_OPTIONS,
  QUALITIES,
  optionsSchema,
  type AnimationOptions,
} from "@/lib/animation";

// Every query takes the Gateway user id and only touches that member's rows.
// The one exception, `ownerId: null`, is for an admin (isAdmin) and is
// decided by the caller.

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Give it a name")
  .max(120);
const projectIdSchema = z.string().uuid();

export const updateProjectInput = z
  .object({
    name: projectNameSchema.optional(),
    options: optionsSchema.optional(),
  })
  .strict()
  .refine(
    (v) => v.name !== undefined || v.options !== undefined,
    "Nothing to change",
  );

export const createExportInput = z.object({
  quality: z.enum(["720p", "1080p"]),
  durationSeconds: z.coerce.number().int().min(1).max(200),
});

interface Project {
  id: string;
  ownerId: string;
  name: string;
  imageType: string;
  options: AnimationOptions;
  createdAt: string;
  updatedAt: string;
}

export interface VideoExport {
  id: string;
  projectId: string;
  contentType: string;
  width: number;
  height: number;
  durationSeconds: number;
  sizeBytes: number;
  createdAt: string;
}

type ProjectRow = typeof projects.$inferSelect;
type ExportRow = typeof exports.$inferSelect;

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    imageType: row.imageType,
    options: {
      hand: row.hand as AnimationOptions["hand"],
      sketchStyle: row.sketchStyle as AnimationOptions["sketchStyle"],
      sketchSeconds: row.sketchSeconds,
      fillSeconds: row.fillSeconds,
      quality: row.quality as AnimationOptions["quality"],
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toExport(row: ExportRow): VideoExport {
  return {
    id: row.id,
    projectId: row.projectId,
    contentType: row.contentType,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

const now = () => new Date().toISOString();

/** Records the member the first time they're seen; keeps their email current. */
export async function ensureUser(user: { id: string; email: string }) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}

export async function listProjects(ownerId: string | null): Promise<Project[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(ownerId === null ? undefined : eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.updatedAt), projects.id);
  return rows.map(toProject);
}

async function projectRow(ownerId: string | null, id: string) {
  if (!projectIdSchema.safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(projects)
    .where(
      ownerId === null
        ? eq(projects.id, id)
        : and(eq(projects.id, id), eq(projects.ownerId, ownerId)),
    );
  return row ?? null;
}

export async function getProject(
  ownerId: string,
  id: string,
): Promise<Project | null> {
  const row = await projectRow(ownerId, id);
  return row ? toProject(row) : null;
}

/** The stored image's key and type, or null when this member has no such project. */
export async function getProjectImage(ownerId: string, id: string) {
  const row = await projectRow(ownerId, id);
  return row ? { key: row.imageKey, type: row.imageType } : null;
}

export async function getProjectWithExports(ownerId: string, id: string) {
  const project = await getProject(ownerId, id);
  if (!project) return null;
  return { project, exports: await listExports(ownerId, id) };
}

export async function createProject(
  ownerId: string,
  input: {
    id: string;
    name: string;
    imageKey: string;
    imageType: string;
    imageBytes: number;
  },
): Promise<Project> {
  const at = now();
  const [row] = await db
    .insert(projects)
    .values({
      ...input,
      ownerId,
      ...DEFAULT_OPTIONS,
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  return toProject(row!);
}

export async function updateProject(
  ownerId: string,
  id: string,
  change: z.infer<typeof updateProjectInput>,
): Promise<Project | null> {
  if (!projectIdSchema.safeParse(id).success) return null;
  const [row] = await db
    .update(projects)
    .set({
      ...(change.name !== undefined ? { name: change.name } : {}),
      ...(change.options ?? {}),
      updatedAt: now(),
    })
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning();
  return row ? toProject(row) : null;
}

/**
 * Deletes the project and its exports in one batch; returns the storage keys
 * to remove, or null when there was no such project for this caller.
 */
export async function deleteProject(
  ownerId: string | null,
  id: string,
): Promise<string[] | null> {
  const row = await projectRow(ownerId, id);
  if (!row) return null;
  const files = await db
    .select({ key: exports.fileKey })
    .from(exports)
    .where(eq(exports.projectId, id));
  await db.batch([
    db.delete(exports).where(eq(exports.projectId, id)),
    db.delete(projects).where(eq(projects.id, id)),
  ]);
  return [row.imageKey, ...files.map((f) => f.key)];
}

async function listExports(
  ownerId: string,
  projectId: string,
): Promise<VideoExport[]> {
  const rows = await db
    .select()
    .from(exports)
    .where(and(eq(exports.projectId, projectId), eq(exports.ownerId, ownerId)))
    .orderBy(desc(exports.createdAt), exports.id);
  return rows.map(toExport);
}

/** Records an export of one of this member's projects (the caller checked ownership). */
export async function createExport(
  ownerId: string,
  projectId: string,
  input: z.infer<typeof createExportInput> & {
    id: string;
    fileKey: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<VideoExport> {
  const { width, height } = QUALITIES[input.quality];
  const at = now();
  const [inserted] = await db.batch([
    db
      .insert(exports)
      .values({
        id: input.id,
        projectId,
        ownerId,
        fileKey: input.fileKey,
        contentType: input.contentType,
        width,
        height,
        durationSeconds: input.durationSeconds,
        sizeBytes: input.sizeBytes,
        createdAt: at,
      })
      .returning(),
    db
      .update(projects)
      .set({ updatedAt: at })
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))),
  ]);
  return toExport(inserted[0]!);
}

/** The export with its project's name, or null when it isn't this member's. */
export async function getExport(ownerId: string, id: string) {
  if (!projectIdSchema.safeParse(id).success) return null;
  const [row] = await db
    .select({ exp: exports, projectName: projects.name })
    .from(exports)
    .innerJoin(projects, eq(projects.id, exports.projectId))
    .where(
      and(
        eq(exports.id, id),
        eq(exports.ownerId, ownerId),
        eq(projects.ownerId, ownerId),
      ),
    );
  return row
    ? {
        ...toExport(row.exp),
        fileKey: row.exp.fileKey,
        projectName: row.projectName,
      }
    : null;
}

/** Deletes the export; returns its storage key, or null when it isn't this member's. */
export async function deleteExport(
  ownerId: string,
  id: string,
): Promise<string | null> {
  if (!projectIdSchema.safeParse(id).success) return null;
  const [row] = await db
    .delete(exports)
    .where(and(eq(exports.id, id), eq(exports.ownerId, ownerId)))
    .returning({ key: exports.fileKey });
  return row?.key ?? null;
}
