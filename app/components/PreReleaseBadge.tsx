import { FiAlertTriangle, FiClock, FiZap } from "react-icons/fi";
import type { PreReleaseAccessType } from "@/app/types/trackedGame";

const ACCESS_META: Record<
  PreReleaseAccessType,
  { label: string; icon: typeof FiClock }
> = {
  "early-access": { label: "Early Access", icon: FiClock },
  "advanced-access": { label: "Advanced Access", icon: FiZap },
  leaked: { label: "Leaked", icon: FiAlertTriangle },
};

export default function PreReleaseBadge({
  type,
  label,
  compact = false,
  expandOnHover = false,
  themeBackground = false,
}: {
  type: PreReleaseAccessType;
  label?: string;
  compact?: boolean;
  expandOnHover?: boolean;
  themeBackground?: boolean;
}) {
  const meta = ACCESS_META[type];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex w-fit items-center overflow-hidden rounded-full border border-[rgba(var(--theme-accent-rgb),0.68)] font-bold uppercase text-[var(--theme-accent-strong)] shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.3)] backdrop-blur-xl transition-all duration-300 ease-out ${
        themeBackground
          ? "bg-[var(--theme-bg)]"
          : "bg-[rgba(var(--theme-accent-rgb),0.28)]"
      } ${
        expandOnHover
          ? "h-8 max-w-8 gap-1.5 px-[9px] text-[10px] tracking-[0.12em] group-hover:max-w-[190px] group-hover:pr-3"
          : compact
          ? "gap-1 px-1.5 py-0.5 text-[9px] tracking-[0.08em]"
          : "gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.12em]"
      }`}
    >
      <Icon className="shrink-0" size={compact ? 10 : 12} />
      <span
        className={`whitespace-nowrap transition-all duration-300 ${
          expandOnHover
            ? "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            : "truncate"
        }`}
      >
        {label ?? meta.label}
      </span>
    </span>
  );
}
