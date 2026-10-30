import { randomUUID } from "node:crypto";
import type { Chat } from "./agent/chat";
import { runMaintenanceAgent, type ActionRoute, type AgentRoute, type MaintenanceEffect } from "./agent/maintenance";
import { routeCommand } from "./agent/router";
import { planTrip, type TripServices } from "./agent/trip";
import { MAX_COMMAND_LENGTH } from "./command-limits";
import { commandReply as reply } from "./command-reply";
import { formatReadDate, numberFormat, STATUS_LABEL } from "./readout";
import { vehicleMpg } from "./trip";
import type { CarSnapshot, CommandReply, Proposal } from "./types";

// One command-bar input, end to end: Nano routes it, Super records service logs and
// odometer readings or proposes schedule changes for a life event, and the reply is
// written here from what the tools did.
// Every failure becomes a reply the user can act on; nothing here throws.

const EXAMPLES =
  "Try something you did, like “just got a car wash”, your odometer, like “odometer is 48,210”, " +
  "something coming up, like “camping trip, 300 miles on dirt roads”, or errands, like “gas, car wash and Trader Joe's”.";
const ERRAND_EXAMPLE = "Try listing them, like “gas, car wash and Trader Joe's”.";
const NO_TRIP = "Trip planning needs Google Maps and EIA prices, which aren't connected yet.";

export async function runCommand(args: {
  text: unknown;
  car: CarSnapshot | null;
  // The visitor's cards still waiting on Apply or Dismiss. A new suggestion for one of their items replaces it.
  pending?: Proposal[];
  // Google Maps and EIA for errands. Null when they are not connected (see tripServices).
  trip?: TripServices | null;
  // Null when the AI is not configured (see missingNebiusConfig).
  chat: Chat | null;
  // Whether Ultra is configured, so a trip with several gas stations can weigh them.
  ultra?: boolean;
  now: Date;
  save: (car: CarSnapshot) => Promise<void>;
  saveProposals: (proposals: Proposal[]) => Promise<void>;
  newId?: () => string;
}): Promise<CommandReply> {
  const { car, chat, now, pending = [], trip = null, ultra = false, newId = randomUUID } = args;
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (text === "" || text.length > MAX_COMMAND_LENGTH) {
    return reply(null, `Type what happened, in ${MAX_COMMAND_LENGTH} characters or fewer. ${EXAMPLES}`);
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

  let route: AgentRoute;
  let state;
  try {
    const routed = await routeCommand(text, tracked, now);
    switch (routed.intent) {
      case "unknown":
        return reply("nano", `I couldn't tell what to do with that. ${EXAMPLES}`);
      case "errand": {
        if (!routed.stops) return reply("nano", `Which places do you want to go? ${ERRAND_EXAMPLE}`);
        if (!trip) return reply("nano", NO_TRIP);
        // Super (or Ultra, choosing between gas stations) finds the places and plans the drive;
        // code builds the plan from what the tools found.
        const planned = await planTrip({
          stops: routed.stops,
          home: car.vehicle.home,
          mpg: vehicleMpg(car.vehicle),
          chat: tracked,
          services: trip,
          ultra,
        });
        return reply(planned.model ?? "nano", planned.message, [], 0, planned.plan);
      }
    }
    route = routed;
    state = await runMaintenanceAgent({ chat: tracked, car, now, text, route, newId, pending });
  } catch (error) {
    console.error("runCommand: model call failed", error);
    return reply(answered, "Could not reach the AI just now. Please try again in a moment.");
  }

  if (route.intent === "event") {
    if (state.proposals.length === 0) {
      return reply("super", "Nothing on your schedule needs to change for that. Your dashboard is up to date.");
    }
    try {
      await args.saveProposals(state.proposals);
    } catch (error) {
      console.error("runCommand: saving proposals failed", error);
      return reply("super", "Could not save those suggestions. Please try again.");
    }
    return reply("super", "Here is what I would change. Apply the ones you want.", [], state.proposals.length);
  }

  if (state.effects.length === 0) return reply("super", nothingRecorded(route));

  try {
    await args.save(state.car);
  } catch (error) {
    console.error("runCommand: save failed", error);
    return reply("super", "Could not save that change. Please try again.");
  }

  return reply("super", "Done.", describeEffects(state.effects));
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

// The lines the user sees. Every number comes from an effect, so each line describes
// the change as it was made.
export function describeEffects(effects: MaintenanceEffect[]): string[] {
  return effects.flatMap((effect): string[] => {
    if (effect.type === "odometer_updated") {
      return [
        `Odometer set to ${numberFormat.format(effect.to)} mi (was about ${numberFormat.format(effect.from)}).`,
        ...effect.statusChanges.map(
          (change) => `${change.label}: ${STATUS_LABEL[change.from]} → ${STATUS_LABEL[change.to]}.`,
        ),
      ];
    }
    // The due point that limits it, as on the tile. A date or mileage rather than "14 days
    // left", which the dashboard (re-rendered a moment later) could already show as 13.
    const next =
      effect.next?.kind === "days"
        ? ` next due ${formatReadDate(new Date(effect.next.dueAt))}`
        : effect.next?.kind === "miles"
          ? ` next due at ${numberFormat.format(effect.next.dueOdometer)} mi`
          : "";
    return [
      `${effect.label} logged ${formatReadDate(new Date(effect.doneAt))} at ${numberFormat.format(effect.doneOdometer)} mi. ` +
        `${STATUS_LABEL[effect.status]}${next ? `,${next}` : ""}.`,
    ];
  });
}
