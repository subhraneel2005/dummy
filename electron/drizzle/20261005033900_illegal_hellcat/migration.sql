CREATE TABLE `chat_tool_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`session_id` text NOT NULL,
	`message_id` integer NOT NULL,
	`position` integer NOT NULL,
	`tool_call_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`input` text,
	`output` text,
	`status` text NOT NULL,
	`approved` integer,
	`duration_ms` integer,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_tool_calls_message_idx` ON `chat_tool_calls` (`message_id`);--> statement-breakpoint
CREATE INDEX `chat_tool_calls_session_idx` ON `chat_tool_calls` (`session_id`);