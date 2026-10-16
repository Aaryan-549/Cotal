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

/** Claude's input screen. Claude skips the development-channels warning when channels are off for
 * the session, for example under a Team or Enterprise org that has not set `channelsEnabled`, or on
 * a third-party provider. Its footer then shows `(shift+tab to cycle)` in every permission mode but
 * the default one, which shows `? for shortcuts`. No startup dialog draws either text. */
export const CLAUDE_READY_TEXTS: readonly string[] = Object.freeze(["(shift+tab to cycle)", "? for shortcuts"]);
