CREATE TABLE `budget_item_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetItemId` int NOT NULL,
	`measurementDate` varchar(10) NOT NULL,
	`physicalPercent` decimal(5,2) NOT NULL,
	`approvedAmount` decimal(14,2) NOT NULL,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_item_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_item_progress_period_uq` UNIQUE(`budgetItemId`,`measurementDate`)
);
--> statement-breakpoint
ALTER TABLE `budget_item_progress` ADD CONSTRAINT `budget_item_progress_budgetItemId_business_records_id_fk` FOREIGN KEY (`budgetItemId`) REFERENCES `business_records`(`id`) ON DELETE restrict ON UPDATE no action;