"use client";

import ThemeSync from "./ThemeSync";
import RouteTransitionLoader from "./RouteTransitionLoader";
import ReleaseDateAutoSync from "./ReleaseDateAutoSync";
import BadgeSync from "./BadgeSync";
import DesktopUpdateModal from "./DesktopUpdateModal";
import DesktopPlaytimeSync from "./DesktopPlaytimeSync";
import DesktopDownloadModal from "./DesktopDownloadModal";

export default function AppServices() {
  return (
    <>
      <ThemeSync />
      <RouteTransitionLoader />
      <ReleaseDateAutoSync />
      <BadgeSync />
      <DesktopUpdateModal />
      <DesktopPlaytimeSync />
      <DesktopDownloadModal />
    </>
  );
}
