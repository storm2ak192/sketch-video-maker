// Behavior: every frozen feature's main path, at the request level and in a browser.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { fileForm, json, landscapePng, makePng } from "./lib.mjs";

const runtime = await startRuntime();
try {
  // ---- F001 at the request level: upload, list, image, rename, refusals.
  const png = landscapePng();
  const up = await runtime.fetch("/api/projects", {
    role: "owner",
    method: "POST",
    body: fileForm("file", "harbour-at-dusk.png", "image/png", png),
  });
  expect(up.status).toBe(201);
  const { project } = await json(up);
  expect(project.name).toBe("harbour-at-dusk");
  expect(project.options).toEqual({
    hand: expect.any(String),
    sketchStyle: expect.any(String),
    sketchSeconds: 10,
    fillSeconds: 5,
    quality: "1080p",
  });

  const list = await json(
    await runtime.fetch("/api/projects", { role: "owner" }),
  );
  expect(list.projects.map((p) => p.id)).toContain(project.id);
  expect(list.projects[0]).toHaveProperty("updatedAt");

  const wrongType = await runtime.fetch("/api/projects", {
    role: "owner",
    method: "POST",
    body: fileForm(
      "file",
      "notes.txt",
      "text/plain",
      Buffer.from("just some text"),
    ),
  });
  expect(wrongType.status).toBe(400);
  expect((await json(wrongType)).error).toMatch(/JPG or PNG/);

  const big = Buffer.alloc(10 * 1024 * 1024 + 10, 1);
  png.copy(big, 0, 0, 64);
  const tooBig = await runtime.fetch("/api/projects", {
    role: "owner",
    method: "POST",
    body: fileForm("file", "huge.png", "image/png", big),
  });
  expect(tooBig.status).toBeGreaterThanOrEqual(400);
  expect(tooBig.status).toBeLessThan(500);
  const afterRefusals = await json(
    await runtime.fetch("/api/projects", { role: "owner" }),
  );
  expect(afterRefusals.projects).toHaveLength(1);

  const image = await runtime.fetch(`/api/projects/${project.id}/image`, {
    role: "owner",
  });
  expect(image.status).toBe(200);
  expect(image.headers.get("content-type")).toBe("image/png");
  expect(Buffer.from(await image.arrayBuffer()).equals(png)).toBe(true);

  const patch = (body) =>
    runtime.fetch(`/api/projects/${project.id}`, {
      role: "owner",
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const renamed = await patch({ name: "Harbour at dusk" });
  expect(renamed.status).toBe(200);
  expect((await json(renamed)).project.name).toBe("Harbour at dusk");

  // ---- F002 at the request level: saved, restored, out-of-range refused.
  const good = {
    hand: "marker-dark",
    sketchStyle: "gray",
    sketchSeconds: 25,
    fillSeconds: 0,
    quality: "720p",
  };
  expect((await patch({ options: good })).status).toBe(200);
  for (const bad of [
    { ...good, sketchSeconds: 0 },
    { ...good, sketchSeconds: 51 },
    { ...good, fillSeconds: -1 },
    { ...good, fillSeconds: 51 },
    { ...good, hand: "claw" },
    { ...good, sketchStyle: "neon" },
    { ...good, quality: "4k" },
  ]) {
    expect((await patch({ options: bad })).status).toBe(400);
  }
  const reread = await json(
    await runtime.fetch(`/api/projects/${project.id}`, { role: "owner" }),
  );
  expect(reread.project.options).toEqual(good);
  expect((await patch({ options: { ...good, hand: "none" } })).status).toBe(
    200,
  );

  // ---- F004 at the request level: save an export, download it, delete it.
  const video = Buffer.from("\x1aE\xdf\xa3 a small video body for the check");
  const exp = await runtime.fetch(`/api/projects/${project.id}/exports`, {
    role: "owner",
    method: "POST",
    body: fileForm("file", "render.webm", "video/webm", video, {
      quality: "720p",
      durationSeconds: 27,
    }),
  });
  expect(exp.status).toBe(201);
  const { export: saved } = await json(exp);
  expect(saved).toMatchObject({
    width: 1280,
    height: 720,
    durationSeconds: 27,
    sizeBytes: video.length,
  });
  const file = await runtime.fetch(`/api/exports/${saved.id}/file`, {
    role: "owner",
  });
  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toMatch(/^video\//);
  expect(file.headers.get("content-disposition")).toMatch(/attachment/);
  expect(Buffer.from(await file.arrayBuffer()).equals(video)).toBe(true);
  const listed = await json(
    await runtime.fetch(`/api/projects/${project.id}`, { role: "owner" }),
  );
  expect(listed.exports.map((e) => e.id)).toEqual([saved.id]);
  expect(
    (
      await runtime.fetch(`/api/exports/${saved.id}`, {
        role: "owner",
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(
    (await runtime.fetch(`/api/exports/${saved.id}/file`, { role: "owner" }))
      .status,
  ).toBe(404);

  // Deleting a project removes its image and every export.
  const second = await json(
    await runtime.fetch(`/api/projects/${project.id}/exports`, {
      role: "owner",
      method: "POST",
      body: fileForm("file", "render.webm", "video/webm", video, {
        quality: "1080p",
        durationSeconds: 12,
      }),
    }),
  );
  expect(
    (
      await runtime.fetch(`/api/projects/${project.id}`, {
        role: "owner",
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await runtime.fetch(`/api/projects/${project.id}/image`, {
        role: "owner",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/exports/${second.export.id}/file`, {
        role: "owner",
      })
    ).status,
  ).toBe(404);
  const db = await runtime.database();
  const orphans = await db
    .prepare("select count(*) as n from exports where project_id = ?")
    .bind(project.id)
    .first();
  expect(orphans.n).toBe(0);

  // ---- Browser journey (member): F001 → F002 → F003 → F004.
  const context = await runtime.context("member", {
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Projects" }),
  ).toBeVisible();
  await runtime.assertBackLink(page);
  await expect(page.getByText("No projects yet")).toBeVisible();

  const input = page.getByTestId("upload-input");
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByTestId("upload-error")).toContainText("JPG or PNG");

  const cabin = landscapePng(960, 600);
  await Promise.all([
    page.waitForURL(/\/projects\/[^/]+$/),
    input.setInputFiles({
      name: "mountain-cabin.png",
      mimeType: "image/png",
      buffer: cabin,
    }),
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "mountain-cabin" }),
  ).toBeVisible();

  // Rename.
  await page.getByRole("button", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog");
  await renameDialog.getByLabel("Name").fill("Cabin in the hills");
  await renameDialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Cabin in the hills" }),
  ).toBeVisible();

  // Grid shows it with a thumbnail and name.
  await page.getByRole("link", { name: "Projects" }).first().click();
  const card = page
    .getByTestId("project-card")
    .filter({ hasText: "Cabin in the hills" });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toBeVisible();
  await card.getByRole("link").first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Cabin in the hills" }),
  ).toBeVisible();

  // F002: options.
  await page.getByTestId("hand-select").click();
  await page.getByRole("option", { name: "Marker, medium skin" }).click();
  await page.getByRole("radio", { name: "Colour" }).click();
  await page.getByRole("radio", { name: "720p" }).click();
  const sketch = page.getByLabel("Sketch duration");
  await sketch.fill("60");
  await expect(page.getByText("Between 1 and 50 seconds")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save options" }),
  ).toBeDisabled();
  await sketch.fill("3");
  await page.getByLabel("Colour duration").fill("2");
  await page.getByRole("button", { name: "Save options" }).click();
  await expect(page.getByText("Options saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sketch duration")).toHaveValue("3");
  await expect(page.getByLabel("Colour duration")).toHaveValue("2");
  await expect(page.getByRole("radio", { name: "720p" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Colour" })).toBeChecked();
  await expect(page.getByTestId("hand-select")).toContainText(
    "Marker, medium skin",
  );

  // F003: preview plays, pauses, restarts and finishes.
  const preview = page.getByTestId("preview");
  await expect(preview).toHaveAttribute("data-phase", "ready");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(preview).toHaveAttribute("data-phase", "sketch");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(preview).toHaveAttribute("data-phase", /sketch|fill|hold|done/);
  await expect(preview).toHaveAttribute("data-phase", "done", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("preview-time")).toContainText("0:07");

  // F004: export, download, delete, export again.
  await page.getByRole("button", { name: "Export video" }).click();
  await expect(page.getByTestId("export-progress")).toBeVisible();
  const row = page.getByTestId("export-row");
  await expect(row).toHaveCount(1, { timeout: 40_000 });
  await expect(row).toContainText("1280×720");
  await expect(row).toContainText("0:07");
  await expect(row).toContainText(/\d+(\.\d+)? (KB|MB)/);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("link", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^Cabin in the hills.*\.(webm|mp4)$/,
  );
  await row.getByRole("button", { name: "Delete export" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(row).toHaveCount(0);

  await page.getByRole("radio", { name: "1080p HD" }).click();
  await page.getByRole("button", { name: "Save options" }).click();
  await expect(page.getByText("Options saved")).toBeVisible();
  await page.getByRole("button", { name: "Export video" }).click();
  await expect(row).toHaveCount(1, { timeout: 40_000 });
  await expect(row).toContainText("1920×1080");
  // A new quality rebuilds the preview, which shows the finished picture until played.
  await expect(preview).toHaveAttribute("data-phase", "ready");
  await expect(preview).toHaveAttribute("width", "1920");
  await expect(page.getByText("Video exported")).toBeHidden({
    timeout: 10_000,
  });
  await preview.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect(row).toBeInViewport();
  await page.mouse.move(0, 0);
  await runtime.screenshot(page);

  // F001: delete asks first, then the grid is empty again.
  await page.getByRole("button", { name: "Delete project" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("exports");
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    confirm.getByRole("button", { name: "Delete" }).click(),
  ]);
  await expect(page.getByText("No projects yet")).toBeVisible();
  await context.close();

  // ---- Phone-sized smoke.
  const phone = await runtime.context("member", {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  await mobile.goto("/");
  await expect(
    mobile.getByRole("heading", { level: 1, name: "Projects" }),
  ).toBeVisible();
  await expect(
    mobile.getByRole("button", { name: "Upload image" }),
  ).toBeVisible();
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await phone.close();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
