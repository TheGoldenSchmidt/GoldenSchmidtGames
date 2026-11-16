import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  group: <><circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2zM3 12a2.5 2.5 0 1 1 1-4.8M1 20v-2c0-2 1-4 3-5M21 12a2.5 2.5 0 1 0-1-4.8M23 20v-2c0-2-1-4-3-5"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
  flag: <><path d="M5 21V4m0 1c5-5 9 4 15-1l-2 5 2 4c-6 5-10-4-15 1"/></>,
  door: <><path d="M11 4h8v16h-8M2 12h13m-5-5 5 5-5 5"/></>,
  next: <path d="m9 5 7 7-7 7"/>,
  back: <path d="m15 5-7 7 7 7"/>,
  sound: <><path d="m3 9 4 0 5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></>,
  muted: <><path d="m3 9 4 0 5-5v16l-5-5H3zM16 9l6 6m0-6-6 6"/></>,
  crown: <><path d="m2 6 5.5 4L12 3l4.5 7L22 6l-3 12H5zM6 21h12"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m16.5 7.5-3 6-6 3 3-6z"/></>
};
export function MenuIcon({name}: {name: keyof typeof paths}) {
  return <svg className="menu-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
