import type { Chat } from "./agent/chat";
import { runMaintenanceAgent, type ActionRoute, type MaintenanceEffect } from "./agent/maintenance";
import { routeCommand } from "./agent/router";
import { buildDashboard } from "./dashboard";
import { formatReadDate, numberFormat, STATUS_LABEL } from "./readout";
import type { CarSnapshot, CommandReply } from "./types";

// One command-bar input, end to end: Nano routes it, Super records service logs and
// odometer readings, and the reply is written here from what the tools changed.
// Every failure becomes a reply the user can act on; nothing here throws.

export const MAX_COMMAND_LENGTH = 500;

const EXAMPLES = "Try something you did, like “just got a car wash”, or your odometer, like “odometer is 48,210”.";

const reply = (model: CommandReply["model"], message: string, changes: string[] = []): CommandReply => ({
  model,
  message,
  changes,
});

export async function runCommand(args: {
  text: unknown;
  car: CarSnapshot | null;
  // Null when the AI is not configured (see missingNebiusConfig).
  chat: Chat | null;
  now: Date;
  save: (car: CarSnapshot) => Promise<void>;
}): Promise<CommandReply> {
  const { car, chat, now } = args;
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (text === "" || text.length > MAX_COMMAND_LENGTH) {
    return reply(null, `Type what happened, in under ${MAX_COMMAND_LENGTH} characters. ${EXAMPLES}`);
  }
  if (!car) return reply(null, "Set up your car first, or load the demo car.");
  if (!chat) {
    return reply(null, "The AI is not connected yet, so the command bar cannot read messages. The dashboard still works.");
  }

  // The last model that answered, so even an error reply carries the right badge.
  let answered: CommandReply["model"] = null;
  const tracked: Chat = async (request) => {
    const response = await chat(request);
    answered = request.tier;
    return response;
  };

  let route: ActionRoute;
  let state;
  try {
    const routed = await routeCommand(text, tracked, now);
    switch (routed.intent) {
      case "unknown":
        return reply("nano", `I couldn't tell what to do with that. ${EXAMPLES}`);
      case "event":
        return reply("nano", "That sounds like a life event. Schedule suggestions for events are coming soon; for now I can log a service or an odometer reading.");
      case "errand":
        return reply("nano", "That sounds like an errand. Trip planning is coming soon; for now I can log a service or an odometer reading.");
    }
    route = routed;
    state = await runMaintenanceAgent({ chat: tracked, car, now, text, route });
  } catch (error) {
    console.error("runCommand: model call failed", error);
    return reply(answered, "Could not reach the AI just now. Please try again in a moment.");
  }

  if (state.effects.length === 0) return reply("super", nothingRecorded(route));

  try {
    await args.save(state.car);
  } catch (error) {
    console.error("runCommand: save failed", error);
    return reply("super", "Could not save that change. Please try again.");
  }

  return reply("super", "Done.", describeEffects(state.effects, state.car, now));
}

// What to try when Super recorded nothing, by what the router read.
function nothingRecorded(route: ActionRoute): string {
  if (route.intent === "odometer") {
    return "I couldn't record that reading. Type it as whole miles, like “odometer is 48,210”.";
  }
  if (route.item === undefined) {
    return "I couldn't tell which item that was. Try naming it, like “oil change” or “tire rotation”.";
  }
  return "I couldn't log that. Check the date or mileage, like “changed the oil yesterday at 48,100”.";
}

// The lines the user sees. Every number comes from an effect or the updated car.
export function describeEffects(effects: MaintenanceEffect[], car: CarSnapshot, now: Date): string[] {
  const dashboard = buildDashboard(car, now);
  return effects.flatMap((effect): string[] => {
    if (effect.type === "odometer_updated") {
      return [
        `Odometer set to ${numberFormat.format(effect.to)} mi (was about ${numberFormat.format(effect.from)}).`,
        ...effect.statusChanges.map(
          (change) => `${change.label}: ${STATUS_LABEL[change.from]} → ${STATUS_LABEL[change.to]}.`,
        ),
      ];
    }
    const shown = dashboard.items.find((i) => i.kind === effect.kind)!;
    const item = car.items.find((i) => i.kind === effect.kind)!;
    // The due point that limits it, as on the tile. A date or mileage rather than "14 days
    // left", which the dashboard (re-rendered a moment later) could already show as 13.
    const next =
      shown.limit?.kind === "days" && item.dueAt !== undefined
        ? ` next due ${formatReadDate(new Date(item.dueAt))}`
        : shown.limit?.kind === "miles" && item.dueOdometer !== undefined
          ? ` next due at ${numberFormat.format(item.dueOdometer)} mi`
          : "";
    return [
      `${effect.label} logged ${formatReadDate(new Date(effect.doneAt))} at ${numberFormat.format(effect.doneOdometer)} mi. ` +
        `${STATUS_LABEL[shown.status]}${next ? `,${next}` : ""}.`,
    ];
  });
}
