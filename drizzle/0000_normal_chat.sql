CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text DEFAULT 'system' NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_idx` ON `booking_events` (`booking_id`);--> statement-breakpoint
CREATE TABLE `booking_services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_minutes` integer DEFAULT 90 NOT NULL,
	`max_party_size` integer DEFAULT 6 NOT NULL,
	`advance_days` integer DEFAULT 60 NOT NULL,
	`cutoff_hours` integer DEFAULT 2 NOT NULL,
	`confirmation_mode` text DEFAULT 'instant' NOT NULL,
	`notification_email` text DEFAULT '' NOT NULL,
	`custom_fields` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_tenant_slug_unique` ON `booking_services` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `services_tenant_store_idx` ON `booking_services` (`tenant_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text NOT NULL,
	`service_id` text NOT NULL,
	`booking_code` text NOT NULL,
	`manage_token` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`customer_phone` text DEFAULT '' NOT NULL,
	`party_size` integer DEFAULT 1 NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`custom_data` text DEFAULT '{}' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`checked_in_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `booking_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_code_unique` ON `bookings` (`booking_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_manage_token_unique` ON `bookings` (`manage_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_tenant_idempotency_unique` ON `bookings` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `bookings_slot_idx` ON `bookings` (`tenant_id`,`store_id`,`service_id`,`date`,`start_time`);--> statement-breakpoint
CREATE INDEX `bookings_customer_email_idx` ON `bookings` (`tenant_id`,`customer_email`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_tenant_email_unique` ON `memberships` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `memberships_email_idx` ON `memberships` (`email`);--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`event_type` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_booking_idx` ON `notification_logs` (`booking_id`);--> statement-breakpoint
CREATE TABLE `schedule_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text NOT NULL,
	`service_id` text NOT NULL,
	`date` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	`slot_times` text DEFAULT '[]' NOT NULL,
	`max_bookings` integer,
	`max_guests` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `booking_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exception_service_store_date_unique` ON `schedule_exceptions` (`service_id`,`store_id`,`date`);--> statement-breakpoint
CREATE TABLE `schedule_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`store_id` text NOT NULL,
	`service_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text DEFAULT '09:00' NOT NULL,
	`end_time` text DEFAULT '18:00' NOT NULL,
	`interval_minutes` integer DEFAULT 60 NOT NULL,
	`slot_times` text DEFAULT '[]' NOT NULL,
	`max_bookings` integer DEFAULT 4 NOT NULL,
	`max_guests` integer DEFAULT 20 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `booking_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_service_store_weekday_unique` ON `schedule_rules` (`service_id`,`store_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `schedule_tenant_idx` ON `schedule_rules` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`arrival_guide` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stores_tenant_idx` ON `stores` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`primary_color` text DEFAULT '#315f54' NOT NULL,
	`accent_color` text DEFAULT '#b54b62' NOT NULL,
	`template` text DEFAULT 'gallery' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);
--> statement-breakpoint
INSERT INTO `tenants`
  (`id`, `slug`, `name`, `contact_email`, `timezone`, `primary_color`, `accent_color`, `template`, `status`)
VALUES
  ('tenant_qq_weekend', 'qq-weekend', '和 QQ 的周末小冒险', '18096095446@163.com', 'Asia/Shanghai', '#50705a', '#a43f55', 'wonderland', 'active');
--> statement-breakpoint
INSERT INTO `memberships`
  (`id`, `tenant_id`, `email`, `display_name`, `role`, `status`)
VALUES
  ('member_qq_owner', 'tenant_qq_weekend', '18096095446@163.com', 'QQ', 'owner', 'active');
--> statement-breakpoint
INSERT INTO `stores`
  (`id`, `tenant_id`, `name`, `address`, `phone`, `timezone`, `arrival_guide`, `active`)
VALUES
  ('store_qq_main', 'tenant_qq_weekend', 'QQ 的周末目的地', '', '', 'Asia/Shanghai', '具体地点由 QQ 和你确认。', 1);
--> statement-breakpoint
INSERT INTO `booking_services`
  (`id`, `tenant_id`, `store_id`, `slug`, `name`, `description`, `duration_minutes`, `max_party_size`,
   `advance_days`, `cutoff_hours`, `confirmation_mode`, `notification_email`, `custom_fields`, `active`)
VALUES
  ('service_qq_weekend', 'tenant_qq_weekend', 'store_qq_main', 'weekend-adventure', '周末小冒险',
   '挑一个周末，和 QQ 一起出去玩。', 120, 2, 70, 1, 'instant', '18096095446@163.com',
   '[{"key":"plan","label":"这次的冒险","type":"text","required":true}]', 1);
--> statement-breakpoint
INSERT INTO `schedule_rules`
  (`id`, `tenant_id`, `store_id`, `service_id`, `weekday`, `start_time`, `end_time`, `interval_minutes`,
   `slot_times`, `max_bookings`, `max_guests`, `enabled`)
VALUES
  ('schedule_qq_fri', 'tenant_qq_weekend', 'store_qq_main', 'service_qq_weekend', 5, '21:00', '23:30', 30,
   '["21:00","21:30","22:00","22:30","23:00"]', 1, 2, 1);
--> statement-breakpoint
INSERT INTO `schedule_rules`
  (`id`, `tenant_id`, `store_id`, `service_id`, `weekday`, `start_time`, `end_time`, `interval_minutes`,
   `slot_times`, `max_bookings`, `max_guests`, `enabled`)
VALUES
  ('schedule_qq_sat', 'tenant_qq_weekend', 'store_qq_main', 'service_qq_weekend', 6, '10:30', '22:30', 150,
   '["10:30","13:00","15:30","18:00","20:30"]', 1, 2, 1);
--> statement-breakpoint
INSERT INTO `schedule_rules`
  (`id`, `tenant_id`, `store_id`, `service_id`, `weekday`, `start_time`, `end_time`, `interval_minutes`,
   `slot_times`, `max_bookings`, `max_guests`, `enabled`)
VALUES
  ('schedule_qq_sun', 'tenant_qq_weekend', 'store_qq_main', 'service_qq_weekend', 0, '10:30', '22:30', 150,
   '["10:30","13:00","15:30","18:00","20:30"]', 1, 2, 1);
