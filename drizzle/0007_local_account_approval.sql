ALTER TABLE `users`
  ADD COLUMN `normalizedEmail` varchar(320) NULL AFTER `email`;

--> statement-breakpoint
ALTER TABLE `users`
  ADD COLUMN `localAccountStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER `passwordSalt`;

--> statement-breakpoint
CREATE UNIQUE INDEX `users_normalized_email_uq` ON `users` (`normalizedEmail`);
