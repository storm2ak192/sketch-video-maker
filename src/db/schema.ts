import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A member as the Gateway identifies them, recorded the first time they use the app.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    // The Gateway's user id; every query filters by it.
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    imageKey: text("image_key").notNull(),
    imageType: text("image_type").notNull(),
    imageBytes: integer("image_bytes").notNull(),
    hand: text("hand").notNull(),
    sketchStyle: text("sketch_style").notNull(),
    sketchSeconds: integer("sketch_seconds").notNull(),
    fillSeconds: integer("fill_seconds").notNull(),
    quality: text("quality").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("projects_owner_idx").on(t.ownerId, t.updatedAt)],
);

export const exports = sqliteTable(
  "exports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    fileKey: text("file_key").notNull(),
    contentType: text("content_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("exports_project_idx").on(t.projectId, t.createdAt)],
);
