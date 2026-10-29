import type { CommandReply } from "./types";

// A command-bar reply, with nothing changed and no cards added unless given. Shared by the
// server, which writes replies, and the command bar, which reads them, so a new field is
// added in one place.
export function commandReply(
  model: CommandReply["model"],
  message: string,
  changes: string[] = [],
  proposals = 0,
): CommandReply {
  return { model, message, changes, proposals };
}
