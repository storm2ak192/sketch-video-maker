// Authorization: private paths, per-member ownership, admin-only actions, no sign-in page.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fileForm, json, landscapePng } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/api/projects"]);

  const upload = async (role, name) => {
    const res = await runtime.fetch("/api/projects", {
      role,
      method: "POST",
      body: fileForm("file", name, "image/png", landscapePng(200, 125)),
    });
    expect(res.status).toBe(201);
    return (await json(res)).project;
  };
  const mine = await upload("owner", "owner-private-plan.png");
  const theirs = await upload("member", "member-sketch.png");
  const video = Buffer.from("\x1aE\xdf\xa3 video bytes");
  const exp = await runtime.fetch(`/api/projects/${mine.id}/exports`, {
    role: "owner",
    method: "POST",
    body: fileForm("file", "r.webm", "video/webm", video, {
      quality: "1080p",
      durationSeconds: 17,
    }),
  });
  expect(exp.status).toBe(201);
  const ownerExport = (await json(exp)).export;

  // Anonymous and outsider are refused on every private path, the files included.
  const privatePaths = [
    `/api/projects/${mine.id}`,
    `/api/projects/${mine.id}/image`,
    `/api/exports/${ownerExport.id}/file`,
    `/projects/${mine.id}`,
  ];
  for (const role of [undefined, "outsider"]) {
    for (const path of privatePaths) {
      const res = await runtime.fetch(path, role ? { role } : {});
      expect([401, 403]).toContain(res.status);
    }
    const write = await runtime.fetch("/api/projects", {
      ...(role ? { role } : {}),
      method: "POST",
      body: fileForm("file", "x.png", "image/png", landscapePng(20, 20)),
    });
    expect([401, 403]).toContain(write.status);
  }

  // One member can't see, read, change or delete another's project or exports.
  const memberList = await json(
    await runtime.fetch("/api/projects", { role: "member" }),
  );
  expect(memberList.projects.map((p) => p.id)).toEqual([theirs.id]);
  expect(
    (await runtime.fetch(`/api/projects/${mine.id}`, { role: "member" }))
      .status,
  ).toBe(404);
  expect(
    (await runtime.fetch(`/api/projects/${mine.id}/image`, { role: "member" }))
      .status,
  ).toBe(404);
  const patch = await runtime.fetch(`/api/projects/${mine.id}`, {
    role: "member",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "taken over" }),
  });
  expect(patch.status).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/projects/${mine.id}`, {
        role: "member",
        method: "DELETE",
      })
    ).status,
  ).toBe(404);
  const foreignExport = await runtime.fetch(
    `/api/projects/${mine.id}/exports`,
    {
      role: "member",
      method: "POST",
      body: fileForm("file", "r.webm", "video/webm", video, {
        quality: "720p",
        durationSeconds: 5,
      }),
    },
  );
  expect(foreignExport.status).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/exports/${ownerExport.id}/file`, {
        role: "member",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/exports/${ownerExport.id}`, {
        role: "member",
        method: "DELETE",
      })
    ).status,
  ).toBe(404);

  const still = await json(
    await runtime.fetch(`/api/projects/${mine.id}`, { role: "owner" }),
  );
  expect(still.project.name).toBe("owner-private-plan");
  expect(still.exports).toHaveLength(1);

  // In the browser the member sees only their own work, and no page for another's.
  const ctx = await runtime.context("member");
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(
    page.getByTestId("project-card").filter({ hasText: "member-sketch" }),
  ).toBeVisible();
  await expect(page.getByText("owner-private-plan")).toHaveCount(0);
  await page.goto(`/projects/${mine.id}`);
  await expect(page.getByText("Project not found")).toBeVisible();
  await expect(page.getByText("owner-private-plan")).toHaveCount(0);
  await ctx.close();

  // Admin-only: listing and deleting everyone's projects.
  expect(
    (await runtime.fetch("/api/projects?all=1", { role: "member" })).status,
  ).toBe(403);
  const all = await runtime.fetch("/api/projects?all=1", { role: "owner" });
  expect(all.status).toBe(200);
  expect((await json(all)).projects.map((p) => p.id).sort()).toEqual(
    [mine.id, theirs.id].sort(),
  );
  expect(
    (
      await runtime.fetch(`/api/projects/${theirs.id}`, {
        role: "owner",
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(
    (await json(await runtime.fetch("/api/projects", { role: "member" })))
      .projects,
  ).toEqual([]);

  // The app serves no sign-in page of its own.
  for (const path of [
    "/login",
    "/signin",
    "/signup",
    "/register",
    "/logout",
    "/auth/login",
  ]) {
    const res = await runtime.fetch(path, { role: "owner" });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/type="password"/);
  }
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
