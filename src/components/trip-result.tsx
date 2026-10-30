import { ModelBadge } from "@/components/command/ModelBadge";
import { RouteMap } from "@/components/route-map";
import { ExternalIcon } from "@/components/shell/icons";
import { priceProvenance } from "@/lib/price-provenance";
import { tripRoutePoints } from "@/lib/route-embed";
import { atLeastACent, tripPlaceKey } from "@/lib/trip";
import type { GasPrice, TripDetour, TripPlan, Vehicle } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const STOP_LABEL = { gas: "Gas", wash: "Car wash", address: "" } as const;

// Where a price came from and when it was true: its kind, its date, and a link to its source, or
// the source named in plain text when it is not a web page (the demo's illustrative prices).
function PriceSource({ price, name }: { price: GasPrice; name?: string }) {
  const { kindLabel, when, source } = priceProvenance(price);
  return (
    <>
      <span className="pill">{kindLabel}</span>{" "}
      {name ? `${name}, ${when.prefix}` : when.prefix} <span className="font-mono tabular-nums">{when.date}</span>.
      {source ? <>{" "}<a href={source.href} target="_blank" rel="noreferrer">{source.label} <ExternalIcon /></a></> : price.source && <> {price.source}.</>}
    </>
  );
}

const perGallon = (price: GasPrice) => <><span className="font-mono tabular-nums">${price.price.toFixed(3)}</span>/gal</>;

// The Ultra verdict on a cheaper station: both prices with their sources, the plain-code
// arithmetic, and whether the route goes through it. Code decided `worthIt`; this only says it.
function DetourVerdict({ detour }: { detour: TripDetour }) {
  const even = !atLeastACent(Math.abs(detour.net));
  const fillUp = <span className="font-mono tabular-nums">{+detour.gallons.toFixed(1)}</span>;
  return (
    <section className="trip-detour" aria-label="Gas detour verdict">
      <h4>{detour.worthIt ? "Worth the detour" : "Skip the detour"}</h4>
      <p>
        {detour.worthIt ? (
          <>Filling up at {detour.station} saves <span className="font-mono tabular-nums">{money.format(detour.net)}</span> after the extra miles. The route already goes through {detour.station}.</>
        ) : even ? (
          <>{detour.station} comes out even once the extra miles are paid for, so the route keeps {detour.usual.station}.</>
        ) : (
          <>{detour.station} would cost <span className="font-mono tabular-nums">{money.format(Math.abs(detour.net))}</span> more than it saves once the extra miles are paid for, so the route keeps {detour.usual.station}.</>
        )}
      </p>
      <ul className="detour-prices">
        <li>Cheaper: <strong className="font-medium">{detour.station}</strong> · {perGallon(detour.price)} <PriceSource price={detour.price} /></li>
        <li>On the way: <strong className="font-medium">{detour.usual.station}</strong> · {perGallon(detour.usual.price)} <PriceSource price={detour.usual.price} /></li>
      </ul>
      <dl className="calculation-grid">
        <div><dt>Savings on {fillUp} gal</dt><dd>{money.format(detour.savings)}</dd></div>
        <div><dt>Extra miles</dt><dd>{detour.extraMiles.toFixed(1)} mi</dd></div>
        <div><dt>Detour fuel</dt><dd>− {money.format(detour.detourCost)}</dd></div>
        <div><dt>Net</dt><dd>{detour.net < 0 && !even ? "− " : ""}{money.format(Math.abs(detour.net))}</dd></div>
      </dl>
      <p className="helper">
        Savings = price difference × a {fillUp}-gallon fill-up. Detour fuel = extra miles ÷ MPG × the usual station&apos;s price.
      </p>
    </section>
  );
}

// A planned drive from home and back: the stops in driving order, the fuel and where its
// price comes from, the verdict on a cheaper station when Ultra weighed one, and a map of the
// drive on request. Shared by the Trips panel and the command bar. `onDistance` adds the button
// that hands the miles to the detour calculator, where there is one. `showModel` is off where
// the caller already shows which model answered.
export function TripResult({
  trip,
  home,
  mpg,
  showModel = true,
  onDistance,
}: {
  trip: TripPlan;
  home: Vehicle["home"];
  mpg: number;
  showModel?: boolean;
  onDistance?: (miles: number) => void;
}) {
  const points = tripRoutePoints(home, trip.stops);
  const regional = priceProvenance(trip.gasPrice).regional;
  return (
    <div className="trip-result">
      {showModel && <ModelBadge model={trip.model} />}
      <h3><span className="font-mono tabular-nums">{money.format(trip.fuelCost)}</span> in fuel for <span className="font-mono tabular-nums">{trip.totalMiles.toFixed(1)}</span> miles</h3>
      <p>From home, {home.label}</p>
      <ol className="location-results list-decimal marker:font-mono">
        {trip.stops.map((stop) => (
          <li key={tripPlaceKey(stop)}>
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
      <p><PriceSource price={trip.gasPrice} name={trip.gasPrice.label ?? "Gas price"} /></p>
      {trip.gasPrice.stale && <p className="helper">This price is more than two weeks old; check it before relying on it.</p>}
      {trip.detour && <DetourVerdict detour={trip.detour} />}
      <p className="helper">
        Fuel = miles ÷ <span className="font-mono tabular-nums">{mpg}</span> MPG × price per gallon.{regional && " A regional average, not a station quote."} Time excludes traffic and time at stops.
      </p>
      <RouteMap key={points.join("|")} points={points} headingLevel={4} />
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
