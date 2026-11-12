CREATE TABLE `prototypePlayToken` (
	`token` text PRIMARY KEY NOT NULL,
	`versionId` text NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`versionId`) REFERENCES `prototypeVersion`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prototypePlayToken_expiresAt_idx` ON `prototypePlayToken` (`expiresAt`);