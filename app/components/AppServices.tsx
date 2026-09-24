"use client";

import ThemeSync from "./ThemeSync";
import RouteTransitionLoader from "./RouteTransitionLoader";
import ReleaseDateAutoSync from "./ReleaseDateAutoSync";
import BadgeSync from "./BadgeSync";
import DesktopUpdateModal from "./DesktopUpdateModal";

export default function AppServices() {
  return (
    <>
      <ThemeSync />
      <RouteTransitionLoader />
      <ReleaseDateAutoSync />
      <BadgeSync />
      <DesktopUpdateModal />
    </>
  );
}
