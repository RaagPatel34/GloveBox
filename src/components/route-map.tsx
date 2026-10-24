'use client';
import { useState } from 'react';
import { validateStops } from '@/lib/route-planner';

export function RouteMap({ stops }: { stops: string[] }) {
  const [show, setShow] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (stops.length < 2 || stops.length > 8) return null;
  try { validateStops(stops); } catch { return null; }
  const params = new URLSearchParams({ key: key ?? '', origin: stops[0], destination: stops.at(-1)!, mode: 'driving' });
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).join('|'));
  return <div className="spaced"><h3>Route map</h3>
    {!key ? <p className="helper">The embedded map is waiting for a Google Maps connection. You can still open your stops using the Maps link above.</p> : <>
      <p className="helper">Loading this map shares these stops with Google. The map may calculate a different route or time from an earlier estimate.</p>
      <button className="secondary" onClick={() => setShow(!show)}>{show ? 'Hide map' : 'Load route map'}</button>
      {show && <iframe title="Driving route in Google Maps" width="100%" height="400" style={{ border: 0, minWidth: 200 }} referrerPolicy="strict-origin-when-cross-origin" allowFullScreen src={`https://www.google.com/maps/embed/v1/directions?${params}`}/>}
    </>}
  </div>;
}
