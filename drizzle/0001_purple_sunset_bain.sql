CREATE TABLE `business_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module` varchar(48) NOT NULL,
	`code` varchar(80),
	`title` varchar(240) NOT NULL,
	`workId` int,
	`amount` decimal(14,2),
	`quantity` decimal(14,3),
	`recordDate` varchar(10),
	`status` varchar(40) NOT NULL DEFAULT 'planejado',
	`responsible` varchar(180),
	`details` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `record_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`category` enum('contrato','assinatura_recebimento','nota_fiscal_cliente','outro') NOT NULL DEFAULT 'outro',
	`contentType` varchar(120) NOT NULL,
	`size` int NOT NULL,
	`objectKey` varchar(500) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `record_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `operationalRole` enum('administrativo','almoxarife','encarregado') DEFAULT 'administrativo' NOT NULL;--> statement-breakpoint
ALTER TABLE `record_attachments` ADD CONSTRAINT `record_attachments_recordId_business_records_id_fk` FOREIGN KEY (`recordId`) REFERENCES `business_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `business_records_module_idx` ON `business_records` (`module`);--> statement-breakpoint
CREATE INDEX `business_records_work_idx` ON `business_records` (`workId`);--> statement-breakpoint
CREATE INDEX `business_records_code_idx` ON `business_records` (`code`);--> statement-breakpoint
CREATE INDEX `record_attachments_record_idx` ON `record_attachments` (`recordId`);