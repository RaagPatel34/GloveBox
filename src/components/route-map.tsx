"use client";
import { useState } from "react";
import { routeEmbedUrl } from "@/lib/route-embed";

// The route as an interactive Google Map (Maps Embed API, Directions mode). `stops` are in
// driving order, first to last: coordinates ("lat,lng") or addresses. The map loads only on
// request, since loading it tells Google the stops. Uses the domain-restricted browser key;
// without it, or for a route the embed cannot take, the caller's stop list and Maps link stand.
export function RouteMap({ stops }: { stops: string[] }) {
  const [show, setShow] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const src = routeEmbedUrl(stops, key);
  if (stops.length < 2) return null;
  return (
    <div className="route-map">
      <h4>Route map</h4>
      {!src ? (
        <p className="helper">
          {key
            ? "This route has too many stops to draw here. The stop list and the Google Maps link still show the drive."
            : "The route map is waiting for a Google Maps connection. The stop list and the Google Maps link still show the drive."}
        </p>
      ) : (
        <>
          <p className="helper">
            Loading this map shares these stops with Google. It may calculate a different route or time from the estimate above.
          </p>
          <button className="secondary" type="button" aria-expanded={show} onClick={() => setShow(!show)}>
            {show ? "Hide map" : "Load route map"}
          </button>
          {show && (
            <>
              <iframe
                className="route-map-frame"
                title="Driving route in Google Maps"
                src={src}
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
              <p className="helper">If the map does not appear, the stop list and the Google Maps link show the same drive.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
