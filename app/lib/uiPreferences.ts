export type NavbarLayout = "top" | "sidebar";

export const NAVBAR_LAYOUT_STORAGE_KEY = "playcrew-navbar-layout";
export const WHATS_NEW_SEEN_STORAGE_KEY = "playcrew-whats-new-seen";

export const DEFAULT_NAVBAR_LAYOUT: NavbarLayout = "top";

export function isNavbarLayout(value: unknown): value is NavbarLayout {
  return value === "top" || value === "sidebar";
}
