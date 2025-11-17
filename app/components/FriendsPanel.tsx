"use client";

import { useState } from "react";
import CollapsiblePanel from "./CollapsiblePanel";

export default function FriendsPanel() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <CollapsiblePanel
      title="Online Friends"
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      defaultWidth={320}
      collapsedWidth={56}
    >
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 pl-2">
        <h2>Coming Soon</h2>
      </div>
    </CollapsiblePanel>
  );
}
