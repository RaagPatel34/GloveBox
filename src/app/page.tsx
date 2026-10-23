// PROTOTYPE (issue #5): three health-dashboard variants on "/", switchable via ?variant=A|B|C.
// Lives on the prototype/health-dashboard branch only; the winner gets rebuilt under /tdd.

import { connection } from "next/server";
import { Suspense } from "react";
import { buildDashboard } from "./_prototype/fixture";
import { PrototypeSwitcher } from "./_prototype/switcher";
import * as A from "./_prototype/variant-a";
import * as B from "./_prototype/variant-b";
import * as C from "./_prototype/variant-c";

const VARIANTS = {
  A: { name: A.name, View: A.VariantA },
  B: { name: B.name, View: B.VariantB },
  C: { name: C.name, View: C.VariantC },
};
type Key = keyof typeof VARIANTS;

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const param = (await searchParams).variant;
  await connection();
  const key: Key = typeof param === "string" && param in VARIANTS ? (param as Key) : "A";
  const { View } = VARIANTS[key];

  return (
    <>
      <View data={buildDashboard(new Date())} />
      <PrototypeSwitcher
        variants={Object.entries(VARIANTS).map(([k, v]) => ({ key: k, name: v.name }))}
        current={key}
      />
    </>
  );
}
