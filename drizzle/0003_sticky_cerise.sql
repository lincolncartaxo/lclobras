CREATE TABLE `stock_operation_locks` (
	`lockKey` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_operation_locks_lockKey` PRIMARY KEY(`lockKey`)
);
--> statement-breakpoint
ALTER TABLE `record_attachments` MODIFY COLUMN `stablePath` varchar(600) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `business_records` ADD `supplierContractId` int;--> statement-breakpoint
ALTER TABLE `business_records` ADD `orderCodeNormalized` varchar(80);--> statement-breakpoint
UPDATE `business_records` SET `orderCodeNormalized` = LOWER(TRIM(`code`)) WHERE `module` = 'pedidos' AND `code` IS NOT NULL AND TRIM(`code`) <> '';--> statement-breakpoint
ALTER TABLE `business_records` ADD CONSTRAINT `business_records_order_code_uq` UNIQUE(`orderCodeNormalized`);--> statement-breakpoint
ALTER TABLE `business_records` ADD CONSTRAINT `business_records_supplierContractId_business_records_id_fk` FOREIGN KEY (`supplierContractId`) REFERENCES `business_records`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `business_records_supplier_contract_idx` ON `business_records` (`supplierContractId`);
