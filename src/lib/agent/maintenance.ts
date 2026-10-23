import { BASELINE_INTERVALS, estimateCarOdometer, itemStatus } from "../intervals";
import { logService, updateOdometer, type OdometerUpdated, type ServiceLogged } from "../service-log";
import type { CarSnapshot, ScheduleItemKind } from "../types";
import type { Chat } from "./chat";
import { runToolLoop, type Tool } from "./loop";
import { pacificDate, type Route } from "./router";

// The maintenance agent (Super): reads the schedule and records what the user did.
// Its tools work on an in-memory copy of the car; the caller saves the result.
// Each write tool also records an effect, which is what the reply is built from.
//
// The route decides what Super may write: one service log (of the item the router
// named, if it named one) or one odometer reading. Dates and mileages are owned by
// code: the router's, a mileage only if the user typed it. Super may leave them out
// but a call that changes or adds one is refused.

export type MaintenanceEffect = ServiceLogged | OdometerUpdated;

export type MaintenanceState = { car: CarSnapshot; effects: MaintenanceEffect[] };

// The routes Super acts on.
export type ActionRoute = Extract<Route, { intent: "service_log" | "odometer" }>;

const ONE_CHANGE = "A change is already recorded for this message. Stop and reply.";

// Every whole number in the user's words: "48,100 miles" -> 48100.
function typedNumbers(text: string): number[] {
  return (text.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
}

export function maintenanceTools(
  state: MaintenanceState,
  now: Date,
  { route, text }: { route: ActionRoute; text: string },
): Tool[] {
  const typed = typedNumbers(text);
  const getSchedule: Tool = {
    name: "getSchedule",
    description:
      "The car's upkeep items with status, last service and due date/mileage, plus today's estimated odometer.",
    parameters: { type: "object", properties: {} },
    run: () => {
      const odometerEstimate = estimateCarOdometer(state.car, now);
      return {
        // The calendar day in California, the same "today" the router used.
        today: pacificDate(now),
        odometerEstimate,
        items: state.car.items.map((item) => ({
          item: item.kind,
          label: BASELINE_INTERVALS[item.kind].label,
          // Recomputed as on the dashboard: the stored status goes stale as time passes.
          status: itemStatus(item, now, odometerEstimate),
          lastDoneAt: item.lastDoneAt ?? null,
          lastDoneOdometer: item.lastDoneOdometer ?? null,
          dueAt: item.dueAt ?? null,
          dueOdometer: item.dueOdometer ?? null,
        })),
      };
    },
  };

  if (route.intent === "odometer") {
    return [
      getSchedule,
      {
        name: "updateOdometer",
        description: "Set the car's current odometer reading, in whole miles.",
        parameters: {
          type: "object",
          properties: { miles: { type: "integer" } },
          required: ["miles"],
        },
        run: (args) => {
          if (state.effects.length > 0) return { error: ONE_CHANGE };
          if (args.miles !== route.odometer || !typed.includes(route.odometer)) {
            return { error: "Use the reading in the user's message, or stop if it has none." };
          }
          return apply(state, updateOdometer(state.car, route.odometer, now));
        },
      },
    ];
  }

  // A mileage the router read but the user never typed is the router's invention.
  const routeOdometer = route.odometer !== undefined && typed.includes(route.odometer) ? route.odometer : undefined;
  return [
    getSchedule,
    {
      name: "logService",
      description:
        "Record that an upkeep item was done, which restarts its interval. Leave out date for today " +
        "and odometer to use the estimate for that day.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", enum: route.item ? [route.item] : state.car.items.map((i) => i.kind) },
          date: { type: "string", description: "YYYY-MM-DD" },
          odometer: { type: "integer", description: "Miles on the odometer when it was done" },
        },
        required: ["item"],
      },
      run: (args) => {
        if (state.effects.length > 0) return { error: ONE_CHANGE };
        if (route.item !== undefined && args.item !== route.item) {
          return { error: `The user named ${route.item}. Log that item, or stop.` };
        }
        if (args.date !== undefined && args.date !== (route.date ?? pacificDate(now))) {
          return { error: "Leave date out: the app already has the date from the user's message." };
        }
        if (
          args.odometer !== undefined &&
          (routeOdometer !== undefined ? args.odometer !== routeOdometer : !typed.includes(args.odometer as number))
        ) {
          return { error: "Leave odometer out: use only a mileage the user typed." };
        }
        const result = logService(
          state.car,
          {
            kind: args.item as ScheduleItemKind,
            date: route.date ?? (args.date as string | undefined),
            odometer: routeOdometer ?? (args.odometer as number | undefined),
          },
          now,
        );
        return apply(state, result);
      },
    },
  ];
}

function apply(
  state: MaintenanceState,
  result: ReturnType<typeof logService> | ReturnType<typeof updateOdometer>,
): unknown {
  if (!result.ok) return { error: result.error };
  state.car = result.car;
  state.effects.push(result.effect);
  return { ok: true, ...result.effect };
}

const systemPrompt = (today: string) => [
  "You are GloveBox's maintenance agent. The user told you about upkeep they did or their odometer reading.",
  `Today is ${today}.`,
  "Record it with the tool you have: logService for a service, updateOdometer for a reading. Call getSchedule if",
  "you need to see the items first. Record one change only. If a tool returns an error, fix the arguments or stop.",
  "Never state numbers yourself: the app shows the user what the tools changed. When done, reply in one short sentence.",
].join("\n");

export async function runMaintenanceAgent(args: {
  chat: Chat;
  car: CarSnapshot;
  now: Date;
  text: string;
  route: ActionRoute;
}): Promise<MaintenanceState> {
  const state: MaintenanceState = { car: args.car, effects: [] };
  await runToolLoop({
    chat: args.chat,
    tier: "super",
    tools: maintenanceTools(state, args.now, { route: args.route, text: args.text }),
    messages: [
      { role: "system", content: systemPrompt(pacificDate(args.now)) },
      { role: "user", content: `${args.text}\n\n(The router read this as ${JSON.stringify(args.route)}.)` },
    ],
    // One change per message, and the reply is written from it: once it is recorded, stop.
    stopWhen: () => state.effects.length > 0,
  });
  return state;
}
