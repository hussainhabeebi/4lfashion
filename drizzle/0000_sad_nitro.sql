CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`variant` text NOT NULL,
	`quantity` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`owner` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`size` text NOT NULL,
	`colour` text NOT NULL,
	`stock` integer NOT NULL,
	`price` integer NOT NULL,
	`barcode` text NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("variants"."stock" >= 0)
);
