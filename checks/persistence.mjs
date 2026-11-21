// Persistence: projects, options, images and exports survive a restart.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fileForm, json, landscapePng } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const png = landscapePng(320, 200);
  const up = await runtime.fetch("/api/projects", {
    role: "member",
    method: "POST",
    body: fileForm("file", "garden-path.png", "image/png", png),
  });
  expect(up.status).toBe(201);
  const { project } = await json(up);
  const options = {
    hand: "pen-light",
    sketchStyle: "color",
    sketchSeconds: 12,
    fillSeconds: 8,
    quality: "720p",
  };
  const patched = await runtime.fetch(`/api/projects/${project.id}`, {
    role: "member",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Garden path", options }),
  });
  expect(patched.status).toBe(200);
  const video = Buffer.from("\x1aE\xdf\xa3 persisted video");
  const exp = await runtime.fetch(`/api/projects/${project.id}/exports`, {
    role: "member",
    method: "POST",
    body: fileForm("file", "r.webm", "video/webm", video, {
      quality: "720p",
      durationSeconds: 22,
    }),
  });
  expect(exp.status).toBe(201);
  const saved = (await json(exp)).export;

  await runtime.restart();

  const back = await json(
    await runtime.fetch(`/api/projects/${project.id}`, { role: "member" }),
  );
  expect(back.project.name).toBe("Garden path");
  expect(back.project.options).toEqual(options);
  expect(back.exports).toEqual([
    expect.objectContaining({
      id: saved.id,
      width: 1280,
      height: 720,
      durationSeconds: 22,
    }),
  ]);
  const image = await runtime.fetch(`/api/projects/${project.id}/image`, {
    role: "member",
  });
  expect(Buffer.from(await image.arrayBuffer()).equals(png)).toBe(true);
  const file = await runtime.fetch(`/api/exports/${saved.id}/file`, {
    role: "member",
  });
  expect(Buffer.from(await file.arrayBuffer()).equals(video)).toBe(true);

  const ctx = await runtime.context("member");
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(
    page.getByTestId("project-card").filter({ hasText: "Garden path" }),
  ).toBeVisible();
  await ctx.close();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
