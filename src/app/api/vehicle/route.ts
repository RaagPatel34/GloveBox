import { createEpaClient, EPA_UNREACHABLE } from "@/lib/epa";

// Proxy for the fueleconomy.gov picker (the browser cannot call it directly).
// One endpoint, steps picked by which params are present:
//   (none)                       -> years
//   ?year                        -> makes
//   ?year&make                   -> models
//   ?year&make&model             -> engine/transmission options
//   ?vehicleId                   -> { vehicle } with the EPA combined MPG
const epaClient = createEpaClient();

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store" },
  });

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const year = searchParams.get("year");
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const vehicleId = searchParams.get("vehicleId");

  if (year !== null && !/^\d{4}$/.test(year)) return json({ error: "Invalid year" }, 400);
  for (const text of [make, model]) {
    if (text !== null && (text === "" || text.length > 100)) return json({ error: "Invalid make or model" }, 400);
  }

  try {
    if (vehicleId !== null) {
      const vehicle = await epaClient.vehicle(vehicleId);
      return vehicle ? json({ vehicle }) : json({ error: "Unknown vehicle" }, 404);
    }
    if (year === null) return json({ items: await epaClient.years() });
    if (make === null) return json({ items: await epaClient.makes(Number(year)) });
    if (model === null) return json({ items: await epaClient.models(Number(year), make) });
    return json({ items: await epaClient.options(Number(year), make, model) });
  } catch {
    return json({ error: `${EPA_UNREACHABLE} Try again in a moment.` }, 502);
  }
}
