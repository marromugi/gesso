import type { SVGProps } from "react";

const outline = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function DiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
      <circle cx="5.5" cy="5.5" r="0.6" fill="currentColor" />
      <circle cx="10.5" cy="5.5" r="0.6" fill="currentColor" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" />
      <circle cx="5.5" cy="10.5" r="0.6" fill="currentColor" />
      <circle cx="10.5" cy="10.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} strokeWidth="2.5" {...props}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} strokeWidth="2" {...props}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

export function AlignLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />
    </svg>
  );
}

export function AlignCenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M2.5 4h11M4.5 8h7M3.5 12h9" />
    </svg>
  );
}

export function AlignRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M2.5 4h11M6.5 8h7M4.5 12h9" />
    </svg>
  );
}

export function ImageOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...outline} {...props}>
      <path d="M13.5 10.5v-6a2 2 0 0 0-2-2h-6M2.5 4.5v7a2 2 0 0 0 2 2h7" />
      <path d="M2.5 10.5l3-3 2 2M2 2l12 12" />
    </svg>
  );
}

/**
 * A hand-drawn gear. The shape is a filled band traced from a drawing; the
 * stroke thickens it to sit with the other glyphs' line weight.
 */
export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11.2 21.5C11.6 21.5 11.9 21.3 12.2 21.1C12.6 20.7 12.8 20.3 13.1 19.3C13.2 19 13.3 18.7 13.3 18.7C13.4 18.7 14.1 18.6 14.5 18.6C15 18.6 15.3 18.7 15.9 19.2C16.7 19.8 17.2 19.9 17.9 19.6C18.3 19.5 18.8 19.1 19 18.7C19.2 18.3 19.2 17.9 18.9 17C18.7 16.3 18.7 16.1 18.7 15.6C18.7 15.2 18.8 15 19 14.7C19.2 14.6 19.3 14.5 19.8 14.6C20.3 14.6 21 14.6 21.2 14.5C21.4 14.4 21.7 14.2 21.8 14C21.9 13.8 22 13.2 22 12.7C22 12.3 22 12.2 21.9 12C21.7 11.6 21.4 11.4 20.5 10.9C19.5 10.4 19.2 10.1 19 9.6C18.8 9.3 18.8 9 18.9 8.6C19 8.4 19.2 8.1 19.3 7.8C19.7 7.1 19.7 6.7 19.5 6.1C19.1 5.2 18.6 4.8 18 4.8C17.6 4.7 17.3 4.8 16.8 5.1C16.1 5.4 16 5.5 15.6 5.5C15.2 5.5 15 5.4 14.8 5.2C14.6 5 14.5 4.8 14.4 4.3C14.4 3.8 14.3 3.6 14.2 3.3C14 2.9 13.6 2.7 13 2.6C12.2 2.4 11.6 2.5 11.2 2.9C10.9 3.2 10.8 3.3 10.6 4C10.3 4.7 10.2 4.9 10.1 4.9C9.8 5 9.3 5 9.1 5C8.9 5 8.6 4.8 8.1 4.5C7.6 4.2 7.4 4.1 7 4C6.8 3.9 6.7 3.9 6.4 4C5.8 4.1 5.3 4.4 5 5.1C4.6 5.9 4.6 6.6 5.1 7.2C5.2 7.3 5.3 7.5 5.4 7.6C5.5 7.8 5.6 7.9 5.6 8C5.6 8.3 5.5 8.5 5.2 8.7C4.8 9.1 4.4 9.3 3.4 9.4C2.8 9.5 2.7 9.5 2.5 9.6C2.3 9.7 2.1 9.9 2.1 10.1C2 10.2 2 10.5 2 11C2 11.7 2 11.9 2.1 12.1C2.3 12.8 2.4 12.9 3.5 13.3C4.2 13.5 4.3 13.6 4.5 13.7C4.8 14 4.8 14.3 4.7 14.8C4.6 15.1 4.5 15.3 4.1 15.9C3.9 16.4 3.7 16.7 3.7 17C3.7 17.6 4.3 18.4 4.8 18.7C5.1 18.8 5.1 18.8 5.5 18.8C6 18.8 6.3 18.8 6.9 18.4C7.5 18.2 7.7 18.1 7.9 18.1C8.1 18.1 8.3 18.2 8.6 18.4C9 18.8 9.2 19.1 9.5 20.2C9.6 20.6 9.7 21 9.8 21.1C9.9 21.3 10.1 21.5 10.3 21.5C10.5 21.6 10.9 21.6 11.2 21.5ZM10.4 21.1C10.2 21 10.2 20.9 10 20.1C9.9 19.7 9.8 19.3 9.7 19.1C9.4 18.4 8.9 17.9 8.3 17.7C7.9 17.5 7.5 17.6 6.7 18C6.2 18.3 6 18.3 5.5 18.3C5.2 18.3 5.1 18.3 5 18.2C4.7 18.1 4.5 17.9 4.4 17.5C4.2 17.2 4.2 17 4.2 16.7C4.3 16.7 4.4 16.4 4.6 16.2C4.9 15.6 5.1 15.4 5.2 15C5.3 14.5 5.3 14.2 5.1 13.8C4.9 13.4 4.6 13.2 3.8 12.9C3.1 12.7 2.9 12.6 2.7 12.3C2.5 12.1 2.5 11.7 2.5 10.9C2.5 10.1 2.5 10.1 2.9 10C3.1 9.9 3.2 9.9 4 9.8C4.5 9.7 4.9 9.6 5.2 9.4C5.5 9.2 5.8 8.9 5.9 8.6C6 8.4 6 8.4 6 8.1C6 7.7 6 7.6 5.6 7.1C5.3 6.7 5.2 6.5 5.2 6.2C5.2 5.8 5.4 5.2 5.8 4.8C6.1 4.5 6.5 4.4 6.9 4.5C7.2 4.5 7.4 4.6 8 5C8.6 5.4 8.8 5.5 9.2 5.5C9.5 5.5 10.2 5.4 10.4 5.4C10.6 5.3 10.7 5.1 10.9 4.6C11.1 3.8 11.3 3.5 11.4 3.3C11.7 2.9 12.7 2.9 13.3 3.3C13.8 3.5 13.8 3.6 13.9 4.3C13.9 4.6 14 4.9 14 5C14.2 5.6 14.8 6 15.4 6C15.9 6.1 16.3 5.9 16.9 5.6C17.4 5.3 17.6 5.2 17.9 5.2C18.3 5.2 18.7 5.5 18.9 6.1C19.1 6.5 19.2 6.7 19.1 7C19.1 7.2 18.9 7.6 18.8 7.8C18.7 7.9 18.4 8.5 18.4 8.7C18.4 8.8 18.3 9 18.4 9.2C18.4 9.7 18.8 10.3 19.3 10.7C19.4 10.8 19.8 11 20.2 11.2C21.3 11.8 21.5 12 21.5 12.8C21.5 13 21.5 13.2 21.4 13.5C21.2 14.1 21.2 14.1 20.4 14.1C20.1 14.1 19.8 14 19.6 14C19.2 14 19.2 14.1 19 14.1C18.4 14.4 18.1 15 18.1 15.8C18.1 16.1 18.2 16.4 18.4 17.2C18.6 18.1 18.6 18.4 18.3 18.7C18.1 19 17.6 19.3 17.2 19.3C17 19.3 16.7 19.2 16.3 18.8C15.5 18.3 15.3 18.1 14.8 18.1C14.6 18 14.4 18 13.9 18.1C13.6 18.2 13.2 18.2 13.2 18.2C13 18.3 12.9 18.6 12.7 19.1C12.4 19.9 12.2 20.3 11.9 20.6C11.8 20.7 11.6 20.8 11.5 20.9C11.1 21.1 10.6 21.2 10.4 21.1ZM12.5 15.1C13.3 14.9 14.2 14.3 14.7 13.6C15.2 13.1 15.4 12.5 15.4 11.5C15.5 10.3 15.3 9.4 14.6 8.8C14.4 8.6 13.9 8.3 13.5 8.1C12.4 7.7 11.2 7.6 10.2 8C9.4 8.4 8.6 9.2 8.2 10.3C7.7 11.3 7.9 12.5 8.5 13.6C9 14.5 9.8 15 11 15.2C11.4 15.2 12.2 15.2 12.5 15.1ZM11 14.6C9.9 14.4 9.2 13.9 8.8 12.9C8.3 11.9 8.4 10.8 9 9.9C9.4 9.1 10 8.6 10.8 8.4C11 8.3 11.2 8.3 11.7 8.3C12.2 8.3 12.4 8.3 12.7 8.4C13.4 8.6 14 8.9 14.3 9.3C14.6 9.6 14.8 10 14.9 10.6C15 11.1 15 11.3 14.9 11.8C14.8 12.6 14.6 13.1 14 13.6C13.3 14.4 12.7 14.7 11.7 14.7C11.4 14.7 11.1 14.6 11 14.6Z" />
    </svg>
  );
}
