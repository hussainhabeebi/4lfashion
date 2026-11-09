-- Initial 4L Fashion schema only. Safe for empty and manually initialised databases.
-- Existing records are preserved. Future column/data migrations require explicit migration steps.

CREATE TABLE IF NOT EXISTS `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`variant` text NOT NULL,
	`quantity` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`owner` text,
	`created` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`size` text NOT NULL,
	`colour` text NOT NULL,
	`stock` integer NOT NULL,
	`price` integer NOT NULL,
	`barcode` text NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("variants"."stock" >= 0)
);

CREATE TABLE IF NOT EXISTS `auth_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`return_to` text NOT NULL,
	`expires` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);


-- One-time data change (2026-11): lower a saved Qatar delivery charge of QAR 20 to QAR 10.
-- Guarded by a marker record so it runs only once; later changes made in the admin are kept.
UPDATE `records` SET `data` = json_set(`data`, '$.shipping', 10)
WHERE `kind` = 'settings'
  AND CAST(json_extract(`data`, '$.shipping') AS REAL) = 20
  AND NOT EXISTS (SELECT 1 FROM `records` WHERE `id` = 'migration-delivery-charge-10');

INSERT OR IGNORE INTO `records` (`id`, `kind`, `data`, `owner`, `created`)
VALUES ('migration-delivery-charge-10', 'migration', '{"shipping":10}', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
