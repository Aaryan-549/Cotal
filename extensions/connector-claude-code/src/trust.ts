import type { StartupReply } from "@cotal-ai/core";

/** An authorized managed launch accepts its workspace through Claude's own dialog, which Claude
 * draws in one of two layouts. A numbered list with Yes first and selected is confirmed with Enter.
 * A list with No first and selected gets Down, then Enter only once Yes shows selected, rather than
 * a blind answer to the default No choice. Claude persists its own trust state; Cotal never edits
 * the operator's config file. */
export const CLAUDE_WORKSPACE_TRUST_REPLIES: readonly StartupReply[] = Object.freeze([
  Object.freeze({ prompt: "❯ 1. Yes, I trust this folder\n2. No, exit", key: "Enter" as const, optional: true }),
  Object.freeze({ prompt: "❯ No, exit\nYes, I trust this folder", key: "Down" as const }),
  Object.freeze({ prompt: "No, exit\n❯ Yes, I trust this folder", key: "Enter" as const }),
]);
