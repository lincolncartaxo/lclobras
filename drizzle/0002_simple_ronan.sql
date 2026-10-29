CREATE TABLE `record_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`settlementDate` varchar(10) NOT NULL,
	`reference` varchar(240),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `record_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `business_records` ADD `costCenterId` int;--> statement-breakpoint
ALTER TABLE `business_records` ADD `sourceModule` varchar(48);--> statement-breakpoint
ALTER TABLE `business_records` ADD `sourceRecordId` int;--> statement-breakpoint
ALTER TABLE `record_attachments` ADD `stablePath` varchar(600) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `business_records` ADD CONSTRAINT `business_records_source_uq` UNIQUE(`sourceModule`,`sourceRecordId`);--> statement-breakpoint
ALTER TABLE `record_settlements` ADD CONSTRAINT `record_settlements_recordId_business_records_id_fk` FOREIGN KEY (`recordId`) REFERENCES `business_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `record_settlements_record_idx` ON `record_settlements` (`recordId`);--> statement-breakpoint
CREATE INDEX `business_records_cost_center_idx` ON `business_records` (`costCenterId`);
