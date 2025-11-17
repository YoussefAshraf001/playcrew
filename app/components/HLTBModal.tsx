import { Dialog } from "@headlessui/react";
import { AnimatePresence, motion } from "framer-motion";
import { HLTBModalProps } from "../types/HLTB";

export default function HLTBModal({
  open,
  loading,
  gameName,
  results,
  onClose,
  onSelect,
}: HLTBModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <Dialog
          as={motion.div}
          open={open}
          onClose={onClose}
          className="fixed inset-0 z-60 flex items-center justify-center"
        >
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-zinc-900 p-6 rounded-2xl w-full max-w-2xl border border-zinc-700 text-white"
          >
            <h3 className="text-xl font-bold mb-4">
              Select game on HowLongToBeat
            </h3>

            {loading ? (
              <p className="text-gray-400">Searching for "{gameName}"...</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {results.length === 0 ? (
                  <p className="col-span-2 text-gray-400 text-center">
                    No matches found.
                  </p>
                ) : (
                  results.map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => onSelect(r)}
                      className="cursor-pointer hover:bg-zinc-700 p-3 rounded-lg border border-zinc-600"
                    >
                      <img
                        src={r.imageUrl}
                        alt={r.name}
                        className="rounded-lg mb-2"
                      />
                      <p className="font-semibold truncate">{r.name}</p>
                      <p className="text-sm text-gray-400">
                        Main: {r.gameplayMain ?? "?"}h
                      </p>
                      <p className="text-sm text-gray-400">
                        Completionist: {r.gameplayCompletionist ?? "?"}h
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
