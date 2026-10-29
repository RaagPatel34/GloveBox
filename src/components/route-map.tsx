"use client";
import { useState } from "react";
import { canDrawRoute, routeEmbedUrl } from "@/lib/route-embed";

// The route as an interactive Google Map (Maps Embed API, Directions mode). `points` are in
// driving order, first to last (for a trip, home at both ends): coordinates ("lat,lng") or
// addresses. `headingLevel` is one below the heading the map sits under. Draws nothing for
// points the embed cannot take. The map loads only on request, since loading it tells Google
// the points. Uses the domain-restricted browser key; without it, the caller's stop list and
// Maps link stand.
export function RouteMap({ points, headingLevel }: { points: string[]; headingLevel: 3 | 4 }) {
  const [show, setShow] = useState(false);
  if (!canDrawRoute(points)) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const src = routeEmbedUrl(points, key);
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="route-map">
      <Heading>Route map</Heading>
      {!src ? (
        <p className="helper">
          The route map is waiting for a Google Maps connection. The stop list and the Google Maps link still show the drive.
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
