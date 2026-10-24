import Link from 'next/link';
import { WeatherPreference } from '@/components/weather-preference';
import { weatherPreference } from '@/lib/db/weather-check-store';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { HealthDashboard, HealthDashboardSkeleton } from '@/components/health/HealthDashboard';
import { SetupForm } from '@/components/setup/SetupForm';
import { VisitorSync } from '@/components/visitor/VisitorSync';
import { getCarSnapshot } from '@/lib/car';
import { buildDashboard } from '@/lib/dashboard';
import { loadProposals } from '@/lib/db/proposal-store';
import { listNudges } from '@/lib/db/nudge-store';
import { VISITOR_COOKIE } from '@/lib/visitor';

export default function CloudGarage() {
  return <div className="cloud-garage"><nav className="mx-auto max-w-5xl p-4"><Link href="/">← Local garage, records and gas calculator</Link></nav><Suspense fallback={<HealthDashboardSkeleton/>}><Dashboard/></Suspense></div>;
}
async function Dashboard() {
  await connection();
  if (!process.env.DATABASE_URL) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl">Cloud garage is not connected yet</h1><p className="mt-4">Your local garage continues to work without an account. Cloud setup needs a configured database before it can save a car.</p><Link className="mt-6 inline-block underline" href="/">Continue with the local garage</Link></main>;
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  let car;
  try { car = await getCarSnapshot(visitorId); }
  catch { return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl">Cloud garage is temporarily unavailable</h1><p className="mt-4">Your local records are unchanged. Try again later or return to the local garage.</p></main>; }
  const [proposals, nudges] = car && visitorId ? await Promise.all([loadProposals(visitorId).catch(() => []),listNudges(visitorId,new Date()).catch(() => [])]) : [[],[]];
  const preference = car && visitorId ? await weatherPreference(visitorId).catch(() => null) : null;
  return <><p className="mx-auto max-w-5xl px-4 text-sm">Cloud and local garages are separate. To copy a local car into an empty cloud garage, use Records → Copy to the cloud garage. Later edits do not sync. Live AI is {process.env.ENABLE_LIVE_AI === 'true' ? 'enabled' : 'paused'}.</p><VisitorSync serverVisitorId={visitorId}/>{car ? <><HealthDashboard dashboard={buildDashboard(car,new Date(),proposals)} nudges={nudges}/><WeatherPreference initialEnabled={Boolean(preference?.enabled)} available={process.env.ENABLE_DAILY_WEATHER === "true" && process.env.VERCEL_ENV === "production"} checkedAt={preference?.checked_at ? new Date(preference.checked_at).toISOString() : undefined} outcome={preference?.outcome ?? undefined}/></> : <SetupForm/>}</>;
}
