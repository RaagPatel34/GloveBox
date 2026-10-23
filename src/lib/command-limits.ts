// The longest command-bar input, in characters. Its own module so the command bar (a
// client component) can share it with runCommand without bundling the agent code.
export const MAX_COMMAND_LENGTH = 500;
