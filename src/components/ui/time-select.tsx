"use client";

const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

export function TimeSelect({
  value,
  onChange,
  required,
  minuteStep = 30,
  className = "",
}: {
  value: string; // "HH:mm", sempre 24h
  onChange: (value: string) => void;
  required?: boolean;
  minuteStep?: number;
  className?: string;
}) {
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
    String(i * minuteStep).padStart(2, "0")
  );
  const [hour, minute] = value.split(":");

  return (
    <div
      className={`mt-1.5 flex w-full items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 focus-within:border-brand-500 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      <select
        value={hour ?? "00"}
        onChange={(e) => onChange(`${e.target.value}:${minute ?? "00"}`)}
        required={required}
        aria-label="Hora"
        className="flex-1 bg-transparent py-2 text-sm text-zinc-900 focus:outline-none dark:text-white"
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-zinc-400">:</span>
      <select
        value={minute ?? "00"}
        onChange={(e) => onChange(`${hour ?? "00"}:${e.target.value}`)}
        required={required}
        aria-label="Minuto"
        className="flex-1 bg-transparent py-2 text-sm text-zinc-900 focus:outline-none dark:text-white"
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
