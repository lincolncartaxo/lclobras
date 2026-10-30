ALTER TABLE `users`
  ADD COLUMN `passwordHash` varchar(128) NULL,
  ADD COLUMN `passwordSalt` varchar(64) NULL;
