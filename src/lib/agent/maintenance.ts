import { buildDashboard } from "../dashboard";
import { logService, updateOdometer, type OdometerUpdated, type ServiceLogged } from "../service-log";
import type { CarSnapshot, ScheduleItemKind } from "../types";
import type { Chat } from "./chat";
import { runToolLoop, type Tool } from "./loop";
import type { Route } from "./router";

// The maintenance agent (Super): reads the schedule and records what the user did.
// Its tools work on an in-memory copy of the car; the caller saves the result.
// Each write tool also records an effect, which is what the reply is built from.

export type MaintenanceEffect = ServiceLogged | OdometerUpdated;

export type MaintenanceState = { car: CarSnapshot; effects: MaintenanceEffect[] };

export function maintenanceTools(state: MaintenanceState, now: Date): Tool[] {
  return [
    {
      name: "getSchedule",
      description:
        "The car's upkeep items with status, last service and due date/mileage, plus today's estimated odometer.",
      parameters: { type: "object", properties: {} },
      run: () => {
        const dashboard = buildDashboard(state.car, now);
        return {
          today: now.toISOString(),
          odometerEstimate: dashboard.odometerEstimate,
          items: dashboard.items.map((shown) => {
            const item = state.car.items.find((i) => i.id === shown.id)!;
            return {
              item: item.kind,
              label: shown.label,
              status: shown.status,
              lastDoneAt: item.lastDoneAt ?? null,
              lastDoneOdometer: item.lastDoneOdometer ?? null,
              dueAt: item.dueAt ?? null,
              dueOdometer: item.dueOdometer ?? null,
            };
          }),
        };
      },
    },
    {
      name: "logService",
      description:
        "Record that an upkeep item was done, which restarts its interval. Leave out date for today " +
        "and odometer to use the estimate for that day.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", enum: state.car.items.map((i) => i.kind) },
          date: { type: "string", description: "YYYY-MM-DD" },
          odometer: { type: "integer", description: "Miles on the odometer when it was done" },
        },
        required: ["item"],
      },
      run: (args) => {
        const result = logService(
          state.car,
          {
            kind: args.item as ScheduleItemKind,
            date: typeof args.date === "string" ? args.date : undefined,
            odometer: args.odometer as number | undefined,
          },
          now,
        );
        return apply(state, result);
      },
    },
    {
      name: "updateOdometer",
      description: "Set the car's current odometer reading, in whole miles.",
      parameters: {
        type: "object",
        properties: { miles: { type: "integer" } },
        required: ["miles"],
      },
      run: (args) => apply(state, updateOdometer(state.car, args.miles as number, now)),
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

const SYSTEM_PROMPT = [
  "You are GloveBox's maintenance agent. The user told you about upkeep they did or their odometer reading.",
  "Record it with the tools: logService for a service, updateOdometer for a reading. Call getSchedule if you need",
  "to see the items first. If a tool returns an error, fix the arguments or stop.",
  "Never state numbers yourself: the app shows the user what the tools changed. When done, reply in one short sentence.",
].join("\n");

export async function runMaintenanceAgent(args: {
  chat: Chat;
  car: CarSnapshot;
  now: Date;
  text: string;
  route: Route;
}): Promise<MaintenanceState> {
  const state: MaintenanceState = { car: args.car, effects: [] };
  await runToolLoop({
    chat: args.chat,
    tier: "super",
    tools: maintenanceTools(state, args.now),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${args.text}\n\n(The router read this as ${JSON.stringify(args.route)}.)` },
    ],
  });
  return state;
}
