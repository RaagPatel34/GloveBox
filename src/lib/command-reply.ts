import type { CommandReply } from "./types";

// A command-bar reply, with nothing changed, no cards added and no trip unless given. Shared by
// the server, which writes replies, and the command bar, which reads them, so a new field is
// added in one place.
export function commandReply(
  model: CommandReply["model"],
  message: string,
  changes: string[] = [],
  proposals = 0,
  trip?: CommandReply["trip"] | null,
): CommandReply {
  return { model, message, changes, proposals, ...(trip ? { trip } : {}) };
}
