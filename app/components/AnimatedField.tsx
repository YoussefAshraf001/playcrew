import { motion } from "framer-motion";

const fieldVariants = {
  locked: {
    opacity: 0.6,
    y: 0,
  },
  editable: {
    opacity: 1,
    y: -2,
    transition: {
      duration: 0.25,
    },
  },
};

export default function AnimatedField(props: any) {
  const { disabled } = props;

  return (
    <motion.div
      variants={fieldVariants}
      initial={false}
      animate={disabled ? "locked" : "editable"}
    >
      <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-zinc-400">
        {props.label}
      </label>

      <input
        {...props}
        disabled={disabled}
        className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors duration-300 ${
          disabled
            ? "cursor-not-allowed border border-slate-800 bg-slate-900 text-gray-400"
            : "border border-cyan-300/45 bg-slate-800 theme-text focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
        }`}
      />
    </motion.div>
  );
}
