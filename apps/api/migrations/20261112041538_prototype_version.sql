CREATE TABLE `prototypeFileContent` (
	`prototypeId` text NOT NULL,
	`hash` text NOT NULL,
	`size` integer NOT NULL,
	`createdAt` text NOT NULL,
	PRIMARY KEY(`prototypeId`, `hash`),
	FOREIGN KEY (`prototypeId`) REFERENCES `prototype`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prototypeVersion` (
	`id` text PRIMARY KEY NOT NULL,
	`prototypeId` text NOT NULL,
	`number` integer NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`prototypeId`) REFERENCES `prototype`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prototypeVersion_prototypeId_number_idx` ON `prototypeVersion` (`prototypeId`,`number`);--> statement-breakpoint
CREATE TABLE `prototypeVersionFile` (
	`versionId` text NOT NULL,
	`path` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`versionId`, `path`),
	FOREIGN KEY (`versionId`) REFERENCES `prototypeVersion`(`id`) ON UPDATE no action ON DELETE cascade
);
