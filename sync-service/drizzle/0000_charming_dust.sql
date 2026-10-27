CREATE TABLE `pairings` (
	`id` text PRIMARY KEY NOT NULL,
	`vault_id` text NOT NULL,
	`auth_hash` text NOT NULL,
	`packet` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`vault_id` text NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`vault_id`, `revision`),
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_hash` text NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
