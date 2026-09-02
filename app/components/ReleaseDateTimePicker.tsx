"use client";

import { useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

type ReleaseDateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (value: number) => String(value).padStart(2, "0");

const parseValue = (value: string) => {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
};

const serialize = ({
  year,
  month,
  day,
  hour,
  minute,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) =>
  `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;

export default function ReleaseDateTimePicker({
  value,
  onChange,
}: ReleaseDateTimePickerProps) {
  const selected = parseValue(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = parseValue(value);
    return new Date(
      initial?.year ?? new Date().getFullYear(),
      (initial?.month ?? new Date().getMonth() + 1) - 1,
      1,
    );
  });

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const monthLength = new Date(year, month + 1, 0).getDate();
    const previousMonthLength = new Date(year, month, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      const relativeDay = index - firstWeekday + 1;
      if (relativeDay < 1) {
        return new Date(year, month - 1, previousMonthLength + relativeDay);
      }
      if (relativeDay > monthLength) {
        return new Date(year, month + 1, relativeDay - monthLength);
      }
      return new Date(year, month, relativeDay);
    });
  }, [visibleMonth]);

  const selectDay = (date: Date) => {
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    onChange(
      serialize({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: selected?.hour ?? 0,
        minute: selected?.minute ?? 0,
      }),
    );
  };

  const setTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const base = selected ?? {
      year: visibleMonth.getFullYear(),
      month: visibleMonth.getMonth() + 1,
      day: 1,
      hour: 0,
      minute: 0,
    };
    onChange(serialize({ ...base, hour, minute }));
  };

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/25">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setVisibleMonth(
              new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth() - 1,
                1,
              ),
            )
          }
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/70 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white"
        >
          <FaChevronLeft size={11} />
        </button>
        <div className="text-center">
          <p className="text-sm font-black text-white">
            {visibleMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          <button
            type="button"
            onClick={() => selectDay(today)}
            className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300/75 hover:text-cyan-200"
          >
            Jump to today
          </button>
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setVisibleMonth(
              new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth() + 1,
                1,
              ),
            )
          }
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/70 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white"
        >
          <FaChevronRight size={11} />
        </button>
      </div>

      <div className="p-3">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="py-1 text-center text-[9px] font-black uppercase tracking-wider text-white/35"
            >
              {weekday}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const isCurrentMonth =
              date.getMonth() === visibleMonth.getMonth();
            const isSelected =
              selected?.year === date.getFullYear() &&
              selected.month === date.getMonth() + 1 &&
              selected.day === date.getDate();
            const isToday =
              date.getFullYear() === today.getFullYear() &&
              date.getMonth() === today.getMonth() &&
              date.getDate() === today.getDate();

            return (
              <button
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                type="button"
                onClick={() => selectDay(date)}
                className={`relative aspect-square rounded-xl text-xs font-semibold transition ${
                  isSelected
                    ? "bg-cyan-300 text-zinc-950 shadow-[0_0_18px_rgba(103,232,249,0.28)]"
                    : isCurrentMonth
                      ? "text-white/85 hover:bg-white/10"
                      : "text-white/20 hover:bg-white/5 hover:text-white/45"
                }`}
              >
                {date.getDate()}
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.025] px-4 py-3">
        <span>
          <span className="block text-xs font-bold text-white">Launch time</span>
          <span className="block text-[10px] text-white/40">
            Time in the selected launch timezone
          </span>
        </span>
        <input
          type="time"
          value={selected ? `${pad(selected.hour)}:${pad(selected.minute)}` : "00:00"}
          onChange={(event) => setTime(event.target.value)}
          className="h-10 rounded-xl border border-white/15 bg-black/30 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
    </div>
  );
}
