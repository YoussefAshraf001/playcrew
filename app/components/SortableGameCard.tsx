"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import GameCard from "./GameCard";
import { TrackedGame } from "@/app/types/trackedGame";

interface SortableGameCardProps {
  game: TrackedGame;
  reorderMode: boolean;
  selectedStatus: string;
  releaseFilter: "All" | "Released" | "Unreleased";
  openEditModal: (game: TrackedGame) => void;
  openConfirmModal: (
    message: string,
    action: () => void | Promise<void>,
  ) => void;
}

export default function SortableGameCard({
  game,
  reorderMode,
  selectedStatus,
  releaseFilter,
  openEditModal,
  openConfirmModal,
}: SortableGameCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: game.igdb.id,
    disabled: !reorderMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : "auto",
    opacity: isDragging ? 0 : 1,
    cursor: reorderMode ? "grab" : "default",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GameCard
        game={game}
        reorderMode={reorderMode}
        selectedStatus={selectedStatus}
        releaseFilter={releaseFilter}
        openEditModal={openEditModal}
        openConfirmModal={openConfirmModal}
      />
    </div>
  );
}
