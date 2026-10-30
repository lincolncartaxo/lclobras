ALTER TABLE `business_records` ADD `systemKey` varchar(80);--> statement-breakpoint
ALTER TABLE `record_settlements` ADD `paidByCentral` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `business_records` ADD CONSTRAINT `business_records_system_key_uq` UNIQUE(`systemKey`);