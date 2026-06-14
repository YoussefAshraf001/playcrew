"use client";

import ThemeSync from "./ThemeSync";
import RouteTransitionLoader from "./RouteTransitionLoader";
import ReleaseDateAutoSync from "./ReleaseDateAutoSync";
import ReleaseNotificationSync from "./ReleaseNotificationSync";

export default function AppServices() {
  return (
    <>
      <ThemeSync />
      <RouteTransitionLoader />
      <ReleaseDateAutoSync />
      <ReleaseNotificationSync />
    </>
  );
}
