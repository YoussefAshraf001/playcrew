import { useEffect, useState } from "react";
import { FaCalendarCheck } from "react-icons/fa";

export default function Countdown({ date }: { date: Date }) {
  const [time, setTime] = useState(() => date.getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setTime(date.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [date]);

  if (time <= 0) {
    return (
      <div
        className="
        inline-flex justify-center items-center gap-1.5
        px-3 py-1
        rounded-full
        text-xs font-semibold
        text-green-300
        bg-green-500/10
        shadow-[0_0_12px_rgba(34,197,94,0.4)]
      "
      >
        <FaCalendarCheck size={13} className="text-green-400" />
        Released
      </div>
    );
  }
  const days = Math.floor(time / 86400000);
  const hours = Math.floor((time % 86400000) / 3600000);
  const minutes = Math.floor((time % 3600000) / 60000);

  return (
    <div className="flex items-center justify-center gap-2">
      <Box label="Days" value={days} />
      <Box label="Hours" value={hours} />
      <Box label="Min" value={minutes} />
    </div>
  );
}

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="
      bg-black/50 
      backdrop-blur-md 
      rounded-lg 
      w-[200px] 
      h-16
      flex flex-col items-center justify-center
      text-center
    "
    >
      <div className="text-white text-lg font-bold leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[10px] text-white/70 uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}
