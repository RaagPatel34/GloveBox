import type { ComponentType, SVGProps } from "react";
import { CarIcon, GaugeIcon, LogIcon, RouteIcon } from "./icons";

export type PageHref = "/" | "/log" | "/trips" | "/car";

// The four pages, each answering one question. `short` labels the phone tab bar.
export const NAV: { href: PageHref; label: string; short: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/", label: "Dashboard", short: "Dashboard", Icon: GaugeIcon },
  { href: "/log", label: "Service log", short: "Log", Icon: LogIcon },
  { href: "/trips", label: "Trips", short: "Trips", Icon: RouteIcon },
  { href: "/car", label: "Car & settings", short: "Car", Icon: CarIcon },
];
