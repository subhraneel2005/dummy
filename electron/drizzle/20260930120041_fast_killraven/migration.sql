CREATE TABLE `chat_attachments` (
	`id` text PRIMARY KEY,
	`message_id` integer NOT NULL,
	`position` integer NOT NULL,
	`session_id` text NOT NULL,
	`media_type` text NOT NULL,
	`file_name` text NOT NULL,
	`path` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_attachments_message_idx` ON `chat_attachments` (`message_id`);--> statement-breakpoint
CREATE INDEX `chat_attachments_session_idx` ON `chat_attachments` (`session_id`);