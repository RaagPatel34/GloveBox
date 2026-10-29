import type { SVGProps } from "react";

// One authored icon set: 20px grid, 1.5 stroke, round joins.
type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
});

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 14a7 7 0 1 1 13 0" />
      <path d="m10 11 3-4" />
      <circle cx="10" cy="11.5" r="1" />
    </svg>
  );
}

export function LogIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h3" />
    </svg>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5" cy="15" r="2" />
      <circle cx="15" cy="5" r="2" />
      <path d="M7 15h5a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h5" />
    </svg>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 13v-2l1.6-4A2 2 0 0 1 6.5 5.7h7a2 2 0 0 1 1.9 1.3L17 11v2a1 1 0 0 1-1 1h-1M5 14H4a1 1 0 0 1-1-1M7 14h6" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="14" cy="14" r="1.5" />
      <path d="M4 10h12" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

// Marks a link that opens another site.
export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base({ width: 14, height: 14, className: "inline-block align-[-2px]", ...props })}>
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M11 4h5v5M16 4l-7 7" />
    </svg>
  );
}
