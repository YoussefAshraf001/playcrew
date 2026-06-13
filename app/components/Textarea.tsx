export default function Textarea({ label, disabled, ...props }: any) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </label>
      <textarea
        {...props}
        disabled={disabled}
        rows={3}
        className={`w-full resize-none rounded-xl px-3 py-2.5 text-sm ${
          disabled
            ? "cursor-not-allowed border border-slate-800 bg-slate-900 text-gray-400"
            : "border border-cyan-300/45 bg-slate-800 theme-text focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
        }`}
      />
    </div>
  );
}
