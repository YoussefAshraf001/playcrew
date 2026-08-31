"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import toast, { Toaster, ToastBar } from "react-hot-toast";

export default function GlobalToaster() {
  const pathname = usePathname();

  useEffect(() => {
    toast.dismiss();
  }, [pathname]);

  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      containerStyle={{ top: 60, right: 14, zIndex: 20000 }}
      toastOptions={{
        duration: 2600,
      }}
    >
      {(t) => (
        <div className="relative overflow-hidden rounded-md">
          <ToastBar
            toast={t}
            // style={{
            //   ...t.style,
            //   animation: t.visible
            //     ? "toast-slide-in-right 220ms ease-out"
            //     : "toast-slide-out-right 180ms ease-in forwards",
            // }}
          />
          {/* {t.visible && t.type !== "loading" && (
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-black/10">
              <div
                className="h-full bg-cyan-400/80 animate-toast-progress"
                style={{ animationDuration: `${t.duration ?? 2600}ms` }}
              />
            </div>
          )} */}
        </div>
      )}
    </Toaster>
  );
}
