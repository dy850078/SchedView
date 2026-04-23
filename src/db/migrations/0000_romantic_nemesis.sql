CREATE TABLE `baremetal` (
	`id` text PRIMARY KEY NOT NULL,
	`site` text NOT NULL,
	`phase` text NOT NULL,
	`datacenter` text NOT NULL,
	`rack` text NOT NULL,
	`unit` integer NOT NULL,
	`rack_height` integer NOT NULL,
	`ag` text NOT NULL,
	`total_cpu_cores` integer NOT NULL,
	`total_memory_mb` integer NOT NULL,
	`total_disk_gb` integer NOT NULL,
	`total_gpu_count` integer DEFAULT 0 NOT NULL,
	`used_cpu_cores` integer NOT NULL,
	`used_memory_mb` integer NOT NULL,
	`used_disk_gb` integer NOT NULL,
	`used_gpu_count` integer DEFAULT 0 NOT NULL,
	`bm_role` text NOT NULL,
	`max_vm_count` integer NOT NULL,
	`current_vm_count` integer NOT NULL,
	`ip_types` text NOT NULL,
	`snapshot_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bm_ag` ON `baremetal` (`ag`);--> statement-breakpoint
CREATE INDEX `idx_bm_rack` ON `baremetal` (`rack`);--> statement-breakpoint
CREATE TABLE `schedule_placement` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_request_id` text NOT NULL,
	`vm_id` text NOT NULL,
	`vm_cpu_cores` integer NOT NULL,
	`vm_memory_mb` integer NOT NULL,
	`vm_disk_gb` integer NOT NULL,
	`vm_gpu_count` integer DEFAULT 0 NOT NULL,
	`node_role` text NOT NULL,
	`assigned_bm_id` text,
	FOREIGN KEY (`schedule_request_id`) REFERENCES `schedule_request`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pl_request_vm` ON `schedule_placement` (`schedule_request_id`,`vm_id`);--> statement-breakpoint
CREATE INDEX `idx_pl_request` ON `schedule_placement` (`schedule_request_id`);--> statement-breakpoint
CREATE INDEX `idx_pl_bm` ON `schedule_placement` (`assigned_bm_id`);--> statement-breakpoint
CREATE TABLE `schedule_request` (
	`id` text PRIMARY KEY NOT NULL,
	`cluster_id` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`status` text NOT NULL,
	`solver_status` text NOT NULL,
	`solve_time_seconds` real NOT NULL,
	`unplaced_count` integer NOT NULL,
	`requested_by` text NOT NULL,
	`reason` text,
	`synced_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sr_cluster` ON `schedule_request` (`cluster_id`);--> statement-breakpoint
CREATE INDEX `idx_sr_submitted` ON `schedule_request` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_sr_status` ON `schedule_request` (`status`);--> statement-breakpoint
CREATE TABLE `sync_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`error_message` text,
	`records_upserted` integer DEFAULT 0 NOT NULL,
	`records_skipped` integer DEFAULT 0 NOT NULL
);
