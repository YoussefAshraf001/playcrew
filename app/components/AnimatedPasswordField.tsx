import { motion } from "framer-motion";
import { FiEye, FiEyeOff } from "react-icons/fi";

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

export default function AnimatedPasswordField({
  label,
  name,
  value,
  show,
  toggle,
  onChange,
  onFocus,
  disabled,
  autoComplete = "new-password",
}: {
  label: string;
  name: string;
  value: string;
  show: boolean;
  toggle: () => void;
  onChange: (v: string) => void;
  onFocus?: () => void;
  disabled: boolean;
  autoComplete?: "off" | "current-password" | "new-password";
}) {
  return (
    <motion.div
      variants={fieldVariants}
      initial={false}
      animate={disabled ? "locked" : "editable"}
    >
      <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-zinc-400">
        {label}
      </label>

      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl px-3 py-2.5 pr-10 text-sm transition-colors duration-300 ${
            disabled
              ? "cursor-not-allowed border border-slate-800 bg-slate-900 text-gray-400"
              : "border border-cyan-300/45 bg-slate-800 text-white focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
          }`}
        />

        {/* Eye icon */}
        {!disabled && (
          <button
            type="button"
            onClick={toggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-all duration-300 ease-in-out hover:text-cyan-300"
          >
            {show ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
    </motion.div>
  );
}
