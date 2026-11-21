import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { callTool, listTools } from "@every-app/sdk/testing";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// The tools called the way the Gateway calls them for an AI client: each
// with an identity minted for the one call, through the SDK's tools
// endpoint, which checks the caller's scopes and the input. The same
// in-memory SQLite as projects.test.ts stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { tools } = await import("./tools");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

const { createProject, ensureUser } = await import("./server/projects");

describe("tools", () => {
  it("lists each tool with its risk", async () => {
    const { tools: listed } = await listTools(tools);
    expect(listed.map(({ name, risk }) => [name, risk])).toEqual([
      ["list_projects", "read"],
      ["rename_project", "write"],
      ["set_animation_options", "write"],
    ]);
  });

  it("acts for the person calling, and only on their projects", async () => {
    await ensureUser({ id: "ana", email: "ana@example.com" });
    const id = crypto.randomUUID();
    await createProject("ana", {
      id,
      name: "Ana's",
      imageKey: "k",
      imageType: "image/png",
      imageBytes: 1,
    });
    const bo = await callTool(
      tools,
      "list_projects",
      {},
      { user: { id: "bo" } },
    );
    expect(bo).toMatchObject({ result: { content: [{ text: "[]" }] } });
    const renamed = await callTool(
      tools,
      "rename_project",
      { id, name: "Bo's now" },
      { user: { id: "bo" } },
    );
    expect(JSON.stringify(renamed)).toContain("No project with that id");
  });

  it("refuses a caller whose connection may only read", async () => {
    const response = await callTool(
      tools,
      "rename_project",
      { id: crypto.randomUUID(), name: "Nope" },
      { scopes: ["mcp:read"] },
    );
    expect(response).toMatchObject({ error: { code: "forbidden" } });
  });
});
