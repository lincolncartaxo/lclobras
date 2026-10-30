ALTER TABLE `users` ADD COLUMN `sessionVersion` int NOT NULL DEFAULT 0 AFTER `localAccountStatus`;
