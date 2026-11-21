CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exports_project_idx` ON `exports` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_bytes` integer NOT NULL,
	`hand` text NOT NULL,
	`sketch_style` text NOT NULL,
	`sketch_seconds` integer NOT NULL,
	`fill_seconds` integer NOT NULL,
	`quality` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
