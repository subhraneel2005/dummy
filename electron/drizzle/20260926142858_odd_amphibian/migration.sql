CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Adopt the pre-sidebar conversation. `chat_messages` predates `chat_sessions`
-- and its only session is the hardcoded id "default", so without this row that
-- history would be invisible in the sidebar. HAVING keeps it a no-op when there
-- is nothing to adopt.
INSERT INTO `chat_sessions` (`id`, `title`, `created_at`, `updated_at`)
SELECT 'default', 'Previous chat', MIN(`created_at`), MAX(`created_at`)
FROM `chat_messages`
WHERE `session_id` = 'default'
HAVING COUNT(*) > 0;
