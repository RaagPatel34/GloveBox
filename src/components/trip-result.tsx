import { ModelBadge } from "@/components/command/ModelBadge";
import { ExternalIcon } from "@/components/shell/icons";
import type { TripPlan, Vehicle } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const KIND_LABEL = { eia: "EIA regional average", area: "Area average", station: "Station price" } as const;
const STOP_LABEL = { gas: "Gas", wash: "Car wash", address: "" } as const;

// A planned drive from home and back: the stops in driving order, the fuel and where its
// price comes from. Shared by the Trips panel and the command bar. `onDistance` adds the
// button that hands the miles to the detour calculator, where there is one.
export function TripResult({
  trip,
  home,
  mpg,
  onDistance,
}: {
  trip: TripPlan;
  home: Vehicle["home"];
  mpg: number;
  onDistance?: (miles: number) => void;
}) {
  return (
    <div className="trip-result">
      <ModelBadge model={trip.model} />
      <h3>{money.format(trip.fuelCost)} in fuel for {trip.totalMiles.toFixed(1)} miles</h3>
      <p>From home, {home.label}</p>
      <ol className="location-results list-decimal">
        {trip.stops.map((stop) => (
          <li key={stop.label}>
            {STOP_LABEL[stop.type] && <span className="pill">{STOP_LABEL[stop.type]}</span>}{" "}
            {stop.name && stop.name !== stop.label ? <><strong className="font-medium">{stop.name}</strong> · {stop.label}</> : stop.label}
          </li>
        ))}
      </ol>
      <p className="mt-2.5">Then back home.</p>
      <dl className="calculation-grid">
        <div><dt>Round trip</dt><dd>{trip.totalMiles.toFixed(1)} mi</dd></div>
        <div><dt>Driving time</dt><dd>about {Math.round(trip.totalMinutes)} min</dd></div>
        <div><dt>Gas price</dt><dd>${trip.gasPrice.price.toFixed(3)}/gal</dd></div>
      </dl>
      <p>
        <span className="pill">{KIND_LABEL[trip.gasPrice.kind]}</span>{" "}
        {trip.gasPrice.label ?? "Gas price"}, week of {trip.gasPrice.asOf}.{" "}
        <a href={trip.gasPrice.source} target="_blank" rel="noreferrer">EIA source <ExternalIcon /></a>
      </p>
      {trip.gasPrice.stale && <p className="helper">This price is more than two weeks old; check it before relying on it.</p>}
      <p className="helper">
        Fuel = miles ÷ {mpg} MPG × price per gallon. A regional average, not a station quote. Time excludes traffic and time at stops.
      </p>
      <div className="actions">
        <a className="secondary link-button" href={trip.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps <ExternalIcon /></a>
        {onDistance && (
          <button className="text-button" type="button" onClick={() => onDistance(Number(trip.totalMiles.toFixed(2)))}>
            Use these miles in the detour calculator
          </button>
        )}
      </div>
    </div>
  );
}
