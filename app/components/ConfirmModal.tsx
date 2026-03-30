"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TbPlaystationCircle, TbPlaystationX } from "react-icons/tb";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = "ARE YOU SURE?",
  message,
  confirmText = "Confirm",
  cancelText = "Back",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dimmed background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-999"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="
              fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              z-1000
              w-[640px] max-w-[92vw]
              bg-black/80 backdrop-blur-lg
              border border-zinc-600
              shadow-[0_0_80px_rgba(0,0,0,0.85)]
            "
          >
            <div className="px-10 pb-8 text-center">
              {/* Title */}
              <h2 className="relative uppercase text-lg tracking-[0.45em] text-zinc-200 mb-4 py-4">
                {title}

                {/* Main etched line */}
                <span className="pointer-events-none absolute left-0 bottom-1 h-px w-full bg-linear-to-r from-transparent via-zinc-400/70 to-transparent" />

                {/* Secondary scratch */}
                <span className="pointer-events-none absolute left-1/4 bottom-1 h-px w-1/2 bg-zinc-600/30 blur-[0.5px]" />
              </h2>

              {/* Message */}
              <p className="text-base text-zinc-400 leading-relaxed mb-10">
                {message}
              </p>

              {/* Actions */}
              <div className="flex justify-center gap-28 text-lg tracking-wide">
                {/* Confirm */}
                <button
                  onClick={onConfirm}
                  className="
      group flex items-center gap-4
      text-zinc-100 font-medium
      transition-all duration-200
      hover:text-white
    "
                >
                  <TbPlaystationX
                    className="
        text-cyan-400 text-3xl
        transition-transform duration-200
        group-hover:scale-110
      "
                  />
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    {confirmText}
                  </span>
                </button>

                {/* Back */}
                <button
                  onClick={onCancel}
                  className="
      group flex items-center gap-4
      text-zinc-300 font-medium
      transition-all duration-200
      hover:text-zinc-100
    "
                >
                  <TbPlaystationCircle
                    className="
        text-red-400 text-3xl
        transition-transform duration-200
        group-hover:scale-110
      "
                  />
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    {cancelText}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// "use client";

// import { ReactNode } from "react";
// import { motion, AnimatePresence } from "framer-motion";

// type ConfirmModalProps = {
//   open: boolean;
//   title?: string;
//   message: ReactNode;
//   onConfirm: () => void | Promise<void>;
//   onCancel: () => void;
//   confirmText?: ReactNode;
//   cancelText?: ReactNode;
// };

// export default function ConfirmModal({
//   open,
//   title = "Confirm",
//   message,
//   onConfirm,
//   onCancel,
//   confirmText = "Confirm",
//   cancelText = "Cancel",
// }: ConfirmModalProps) {
//   return (
//     <AnimatePresence>
//       {open && (
//         <motion.div
//           className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           exit={{ opacity: 0 }}
//         >
//           <motion.div
//             className="bg-black p-6 rounded-2xl border border-blue-400 text-white max-w-sm w-full space-y-4"
//             initial={{ scale: 0.95, opacity: 0 }}
//             animate={{ scale: 1, opacity: 1 }}
//             exit={{ scale: 0.95, opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           >
//             <h2 className="text-center text-xl font-bold">{title}</h2>
//             <div className="text-center">{message}</div>
//             <div className="flex justify-center gap-6">
//               <button
//                 onClick={onCancel}
//                 className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-800 transition"
//               >
//                 {cancelText}
//               </button>
//               <button
//                 onClick={onConfirm}
//                 className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition font-semibold"
//               >
//                 {confirmText}
//               </button>
//             </div>
//           </motion.div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// }
