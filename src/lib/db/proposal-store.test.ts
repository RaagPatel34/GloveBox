import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoCar } from "../fixtures/demo-car";
import { decideProposal, proposeAdjustment } from "../proposals";
import { NOW } from "../test-support";
import { loadCar, saveCar } from "./car-store";
import { addProposals, loadProposal, loadProposals, saveDecision } from "./proposal-store";
import { SCHEMA_STATEMENTS } from "./schema";

// Replace the external HTTPS driver with real Postgres running locally in WASM.
// Lazy statements preserve Neon's transaction API; no application modules are mocked.
const driver = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@neondatabase/serverless", () => ({ neon: () => {
  const sql = (parts: TemplateStringsArray, ...params: unknown[]) => {
    const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
    return { query, params, then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => driver.db!.query(query, params).then(result => result.rows).then(resolve, reject) };
  };
  sql.transaction = async (queries: { query: string; params: unknown[] }[]) => driver.db!.transaction(async tx => {
    const results = [];
    for (const query of queries) results.push((await tx.query(query.query, query.params)).rows);
    return results;
  });
  return sql;
} }));

const visitor = "11111111-2222-4333-8444-555555555555";
beforeEach(async () => {
  vi.stubEnv("DATABASE_URL", "postgres://local/test");
  driver.db = new PGlite();
  for (const statement of SCHEMA_STATEMENTS) await driver.db.exec(statement);
});
afterEach(async () => { await driver.db?.close(); vi.unstubAllEnvs(); });

it("persists pending, applied and dismissed states and reloads the changed schedule", async () => {
  const car = demoCar(NOW, visitor, randomUUID);
  await saveCar(visitor, car);
  const result = proposeAdjustment(car, { kind: "engine_filter", dueOdometer: 48_300, reason: "Dirt roads" }, NOW, randomUUID);
  if (!result.ok) throw new Error(result.error);
  await addProposals(visitor, [result.proposal]);
  expect(await loadProposals(visitor)).toEqual([result.proposal]);
  const applied = decideProposal(car, result.proposal, "apply", NOW);
  if (!applied.ok) throw new Error(applied.error);
  expect(await saveDecision(visitor, applied)).toBe(true);
  expect((await loadProposal(visitor, result.proposal.id))!.state).toBe("applied");
  expect((await loadCar(visitor))!.items.find(i => i.kind === "engine_filter")!.dueOdometer).toBe(48_300);
  const second = { ...result.proposal, id: randomUUID() };
  await addProposals(visitor, [second]);
  const dismissed = decideProposal(car, second, "dismiss", NOW);
  if (!dismissed.ok) throw new Error(dismissed.error);
  expect(await saveDecision(visitor, dismissed)).toBe(true);
  expect((await loadProposal(visitor, second.id))!.state).toBe("dismissed");
  expect((await loadProposals(visitor)).map(p => p.id)).toEqual([result.proposal.id]);
});

it("refuses other visitors, repeated Apply, and a proposal whose schedule moved after it was read", async () => {
  const car = demoCar(NOW, visitor, randomUUID);
  await saveCar(visitor, car);
  const result = proposeAdjustment(car, { kind: "engine_filter", dueOdometer: 48_300, reason: "Dirt roads" }, NOW, randomUUID);
  if (!result.ok) throw new Error(result.error);
  await addProposals(visitor, [result.proposal]);
  const applied = decideProposal(car, result.proposal, "apply", NOW);
  if (!applied.ok) throw new Error(applied.error);
  const other = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  expect(await loadProposals(other)).toEqual([]);
  expect(await loadProposal(other, result.proposal.id)).toBeNull();
  expect(await saveDecision(other, applied)).toBe(false);
  expect(await saveDecision(visitor, applied)).toBe(true);
  expect(await saveDecision(visitor, applied)).toBe(false);
  const stale = { ...result.proposal, id: randomUUID() };
  await addProposals(visitor, [stale]);
  expect(await saveDecision(visitor, { ...applied, proposal: { ...stale, state: "applied" } })).toBe(false);
  expect((await loadProposal(visitor, stale.id))!.state).toBe("pending");
});

it("Apply and Dismiss racing for one card leave one consistent decision", async () => {
  const car = demoCar(NOW, visitor, randomUUID);
  await saveCar(visitor, car);
  const result = proposeAdjustment(car, { kind: "engine_filter", dueOdometer: 48_300, reason: "Dirt roads" }, NOW, randomUUID);
  if (!result.ok) throw new Error(result.error);
  await addProposals(visitor, [result.proposal]);
  const applied = decideProposal(car, result.proposal, "apply", NOW);
  const dismissed = decideProposal(car, result.proposal, "dismiss", NOW);
  if (!applied.ok || !dismissed.ok) throw new Error("Decision failed");
  const outcomes = await Promise.all([saveDecision(visitor, dismissed), saveDecision(visitor, applied)]);
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  const stored = await loadProposal(visitor, result.proposal.id);
  const savedCar = await loadCar(visitor);
  expect(savedCar!.items.find(i => i.kind === "engine_filter")!.dueOdometer).toBe(stored!.state === "applied" ? 48_300 : result.proposal.from.dueOdometer);
});
