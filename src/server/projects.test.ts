import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { DEFAULT_OPTIONS, optionsSchema, totalSeconds } from "@/lib/animation";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const p = await import("./projects");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
  await p.ensureUser({ id: "alice", email: "alice@example.com" });
  await p.ensureUser({ id: "bob", email: "bob@example.com" });
});

async function make(owner: string, name: string) {
  const id = crypto.randomUUID();
  return p.createProject(owner, {
    id,
    name,
    imageKey: `projects/${id}/image`,
    imageType: "image/png",
    imageBytes: 10,
  });
}

describe("projects", () => {
  it("start with the default options and belong to their owner", async () => {
    const mine = await make("alice", "Beach");
    expect(mine.options).toEqual(DEFAULT_OPTIONS);
    expect((await p.listProjects("bob")).map((x) => x.id)).not.toContain(
      mine.id,
    );
    expect(await p.getProject("bob", mine.id)).toBeNull();
    expect(await p.updateProject("bob", mine.id, { name: "x" })).toBeNull();
    expect(await p.deleteProject("bob", mine.id)).toBeNull();
    const options = {
      ...DEFAULT_OPTIONS,
      sketchSeconds: 30,
      hand: "none" as const,
    };
    expect(
      (await p.updateProject("alice", mine.id, { options }))?.options,
    ).toEqual(options);
  });

  it("delete with their exports and return every stored file", async () => {
    const mine = await make("alice", "Forest");
    const exp = await p.createExport("alice", mine.id, {
      id: crypto.randomUUID(),
      fileKey: "projects/f/exports/1",
      contentType: "video/webm",
      sizeBytes: 100,
      quality: "720p",
      durationSeconds: 9,
    });
    expect(exp).toMatchObject({ width: 1280, height: 720 });
    expect(await p.getExport("bob", exp.id)).toBeNull();
    expect(await p.deleteExport("bob", exp.id)).toBeNull();
    const keys = await p.deleteProject("alice", mine.id);
    expect(keys).toEqual([`projects/${mine.id}/image`, "projects/f/exports/1"]);
    expect(await p.getExport("alice", exp.id)).toBeNull();
  });
});

describe("options", () => {
  it("refuse values out of range", () => {
    expect(
      optionsSchema.safeParse({ ...DEFAULT_OPTIONS, sketchSeconds: 0 }).success,
    ).toBe(false);
    expect(
      optionsSchema.safeParse({ ...DEFAULT_OPTIONS, sketchSeconds: 51 })
        .success,
    ).toBe(false);
    expect(
      optionsSchema.safeParse({ ...DEFAULT_OPTIONS, fillSeconds: 51 }).success,
    ).toBe(false);
    expect(
      optionsSchema.safeParse({ ...DEFAULT_OPTIONS, quality: "4k" }).success,
    ).toBe(false);
    expect(optionsSchema.safeParse(DEFAULT_OPTIONS).success).toBe(true);
  });

  it("leave colour time out of black & white videos", () => {
    expect(totalSeconds({ ...DEFAULT_OPTIONS, sketchStyle: "bw" })).toBe(12);
    expect(totalSeconds(DEFAULT_OPTIONS)).toBe(17);
  });
});
