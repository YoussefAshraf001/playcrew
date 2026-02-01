export default function HeroSkeleton() {
  return (
    <section className="relative mx-auto w-[65%] h-[55vh] overflow-hidden mb-20">
      {/* Background */}
      <div className="absolute inset-0 bg-neutral-900 animate-pulse" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-r from-black via-black/60 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-end px-14 pb-16">
        <div className="max-w-xl space-y-6">
          {/* Title */}
          <div className="h-12 w-[70%] bg-white/10 rounded-lg animate-pulse" />

          {/* Buttons */}
          <div className="flex gap-4">
            <div className="h-12 w-32 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-12 w-44 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-12 w-28 bg-white/10 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full h-1 bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 bg-white/30 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
