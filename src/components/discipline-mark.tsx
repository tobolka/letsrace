import { cn } from "@/lib/utils";
import {
  disciplineColor,
  eventFamilyGlyph,
  familyColor,
  familyGlyph,
} from "@/lib/map-visuals";

type Props = {
  family?: string | null;
  disciplines?: string[] | null;
  className?: string;
};

/** Colored disc + white family glyph — same language as map pins. */
export function DisciplineMark({ family, disciplines, className }: Props) {
  const color = family ? familyColor(family) : disciplineColor(disciplines);
  const glyph = family ? familyGlyph(family) : eventFamilyGlyph(disciplines);

  return (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white",
        className,
      )}
      style={{ background: color }}
      aria-hidden
    >
      <svg viewBox="0 0 16 16" className="size-[10px]" aria-hidden>
        <g dangerouslySetInnerHTML={{ __html: glyph }} />
      </svg>
    </span>
  );
}
