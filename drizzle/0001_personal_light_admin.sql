CREATE TABLE `personal_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_code` text NOT NULL,
	`applicant_name` text NOT NULL,
	`applicant_email` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`plan` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_bookings_code_unique` ON `personal_bookings` (`booking_code`);
--> statement-breakpoint
CREATE INDEX `personal_bookings_slot_idx` ON `personal_bookings` (`date`,`start_time`);
--> statement-breakpoint
CREATE INDEX `personal_bookings_status_idx` ON `personal_bookings` (`status`);
--> statement-breakpoint
CREATE TABLE `personal_slot_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_slot_blocks_unique` ON `personal_slot_blocks` (`date`,`start_time`);
