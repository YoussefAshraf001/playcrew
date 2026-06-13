import { FiCamera, FiTrash2 } from "react-icons/fi";

type CropData = {
  x: number;
  y: number;
  zoom: number;
};

type MediaValue =
  | { type: "image"; data: string }
  | { type: "gif"; data: string; crop: CropData };

export default function ImageOverlay({
  label,
  media,
  rounded,
  onEdit,
  onDelete,
}: {
  label: string;
  media?: MediaValue;
  rounded?: boolean;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const hasImage = Boolean(media);

  return (
    <div
      onClick={onEdit}
      className={`relative group ${
        rounded ? "h-42 w-40 rounded-2xl" : "h-42 w-full rounded-2xl"
      } overflow-hidden border border-cyan-300/35 bg-slate-800/70 shadow-[0_8px_30px_rgba(0,0,0,0.35)]`}
    >
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-cyan-300/35 bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
        {label}
      </span>
      {/* IMAGE OR PLACEHOLDER */}
      {media ? (
        media.type === "gif" ? (
          <img
            src={media.data}
            alt=""
            style={{
              transform: `
          translate(${media.crop.x}px, ${media.crop.y}px)
          scale(${media.crop.zoom})
        `,
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={media.data} alt="" className="w-full h-full object-cover" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          <FiCamera size={32} />
        </div>
      )}

      {/* HOVER ACTIONS */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {/* ACTION BUTTONS */}
        <div className="flex gap-3">
          {/* EDIT / CHANGE */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="
                h-10 w-10
                rounded-full
                bg-cyan-400 hover:bg-cyan-300
                text-black
                flex items-center justify-center
                cursor-pointer transition-all hover:-translate-y-0.5 duration-300
              "
            title={hasImage ? "Change image" : "Add image"}
          >
            <FiCamera />
          </button>

          {/* DELETE (ONLY IF IMAGE EXISTS) */}
          {hasImage && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="
                  h-10 w-10
                  rounded-full
                  bg-red-500 hover:bg-red-400
                  text-black
                  flex items-center justify-center
                  cursor-pointer transition-all hover:-translate-y-0.5 duration-300
                "
              title="Delete image"
            >
              <FiTrash2 />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
