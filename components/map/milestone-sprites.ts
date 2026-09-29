import type { Map as MapInstance } from 'maplibre-gl';
import type { MilestoneSpriteIds } from './milestone-ids';

const PIXEL_RATIO = 2;
/** Medallion and selection ring share one centre, so icon-size and icon-offset stay identical. */
export const MILESTONE_MEDALLION_SIZE = 44;

export function createMilestoneSprites(
  map: MapInstance,
  options: {
    ids: MilestoneSpriteIds;
    symbols: Record<string, readonly string[]>;
    fallbackSymbol: string;
    ink: string;
    subject: string;
  },
) {
  const { ids, symbols, fallbackSymbol, ink, subject } = options;
  const owned = new Set<string>();
  const add = (
    id: string,
    size: number,
    draw: (context: CanvasRenderingContext2D) => void,
    sdf = false,
  ) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * PIXEL_RATIO;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`${subject} could not be drawn`);
    context.scale(PIXEL_RATIO, PIXEL_RATIO);
    context.lineCap = context.lineJoin = 'round';
    draw(context);
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: PIXEL_RATIO,
      sdf,
    });
    owned.add(id);
  };
  // A dark disc lifts the stroked glyph off any territory colour or resource pictogram.
  const medallion =
    (theme: { color: string; symbol: string }, origin: boolean) =>
    (context: CanvasRenderingContext2D) => {
      const centre = MILESTONE_MEDALLION_SIZE / 2;
      context.fillStyle = ink;
      context.globalAlpha = 0.9;
      context.beginPath();
      context.arc(centre, centre, 17, 0, Math.PI * 2);
      context.fill();
      // A faint theme tint tells emblems apart from the neutral event-group discs.
      context.fillStyle = theme.color;
      context.globalAlpha = 0.16;
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = theme.color;
      context.lineWidth = origin ? 2.6 : 1.6;
      context.stroke();
      if (origin) {
        // A second ring marks the earliest attested centre of a theme.
        context.strokeStyle = ink;
        context.lineWidth = 3.5;
        context.beginPath();
        context.arc(centre, centre, 20.2, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = theme.color;
        context.lineWidth = 1.3;
        context.stroke();
      }
      context.translate(centre - 11, centre - 11);
      context.scale(22 / 32, 22 / 32);
      for (const d of symbols[theme.symbol] ?? symbols[fallbackSymbol]) {
        context.strokeStyle = theme.color;
        context.lineWidth = 2.4;
        context.stroke(new Path2D(d));
      }
    };
  return {
    ensure(themes: readonly { id: string; color: string; symbol: string }[]) {
      add(
        ids.selectionRing,
        MILESTONE_MEDALLION_SIZE + 12,
        (context) => {
          const centre = (MILESTONE_MEDALLION_SIZE + 12) / 2;
          context.strokeStyle = '#000';
          context.lineWidth = 3.5;
          context.beginPath();
          context.arc(centre, centre, 24.5, 0, Math.PI * 2);
          context.stroke();
        },
        true,
      );
      themes.forEach((theme, index) => {
        add(ids.medallion(theme.id), MILESTONE_MEDALLION_SIZE, medallion(theme, false));
        add(ids.origin(theme.id), MILESTONE_MEDALLION_SIZE, medallion(theme, true));
        // Whole-world views generalise later milestones to dots; founding centres keep their emblem.
        // Transparent padding widens the click target without enlarging the drawn dot.
        add(ids.dot(theme.id), 40, (context) => {
          context.beginPath();
          context.arc(20, 20, 7, 0, Math.PI * 2);
          context.fillStyle = theme.color;
          context.fill();
          context.strokeStyle = ink;
          context.lineWidth = 2.2;
          context.stroke();
        });
        add(ids.arrow(theme.id), 24, (context) => {
          const arrow = new Path2D('M5 5 L21 12 L5 19 L9 12 Z');
          context.strokeStyle = ink;
          context.lineWidth = 2.5;
          context.stroke(arrow);
          context.fillStyle = theme.color;
          context.fill(arrow);
        });
        // Hatching separates approximate zones from flat political fills.
        // Alternating directions cross-hatch where two themes' zones overlap.
        add(ids.hatch(theme.id), 10, (context) => {
          context.strokeStyle = theme.color;
          context.lineWidth = 1.4;
          context.lineCap = 'square';
          context.beginPath();
          for (const offset of [-10, 0, 10]) {
            context.moveTo(offset, index % 2 ? 0 : 10);
            context.lineTo(offset + 10, index % 2 ? 10 : 0);
          }
          context.stroke();
        });
      });
    },
    dispose() {
      for (const id of owned) if (map.hasImage(id)) map.removeImage(id);
      owned.clear();
    },
  };
}
