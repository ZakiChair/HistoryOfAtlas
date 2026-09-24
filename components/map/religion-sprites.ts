import type { Map as MapInstance } from 'maplibre-gl';
import type { ReligionTradition } from '@/lib/religions/types';
import { RELIGION_SYMBOLS } from '@/lib/religions/icons';

/** Shared with the panel key in ReligionKey.tsx, which redraws these sprites as SVG. */
export const RELIGION_INK = '#09222e';
const INK = RELIGION_INK;
const PIXEL_RATIO = 2;
/** Medallion and selection ring share one centre, so icon-size and icon-offset stay identical. */
export const RELIGION_MEDALLION_SIZE = 44;
export const RELIGION_SELECTION_RING = 'religion-selection-ring';

export function createReligionSprites(map: MapInstance) {
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
    if (!context) throw new Error('Religion emblems could not be drawn');
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
    (tradition: ReligionTradition, origin: boolean) => (context: CanvasRenderingContext2D) => {
      const centre = RELIGION_MEDALLION_SIZE / 2;
      context.fillStyle = INK;
      context.globalAlpha = 0.9;
      context.beginPath();
      context.arc(centre, centre, 17, 0, Math.PI * 2);
      context.fill();
      // A faint tradition tint tells emblems apart from the neutral event-group discs.
      context.fillStyle = tradition.color;
      context.globalAlpha = 0.16;
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = tradition.color;
      context.lineWidth = origin ? 2.6 : 1.6;
      context.stroke();
      if (origin) {
        // A second ring marks the earliest attested centre of a tradition.
        context.strokeStyle = INK;
        context.lineWidth = 3.5;
        context.beginPath();
        context.arc(centre, centre, 20.2, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = tradition.color;
        context.lineWidth = 1.3;
        context.stroke();
      }
      context.translate(centre - 11, centre - 11);
      context.scale(22 / 32, 22 / 32);
      for (const d of RELIGION_SYMBOLS[tradition.symbol] ?? RELIGION_SYMBOLS.confucian) {
        context.strokeStyle = tradition.color;
        context.lineWidth = 2.4;
        context.stroke(new Path2D(d));
      }
    };
  return {
    ensure(traditions: ReligionTradition[]) {
      add(
        RELIGION_SELECTION_RING,
        RELIGION_MEDALLION_SIZE + 12,
        (context) => {
          const centre = (RELIGION_MEDALLION_SIZE + 12) / 2;
          context.strokeStyle = '#000';
          context.lineWidth = 3.5;
          context.beginPath();
          context.arc(centre, centre, 24.5, 0, Math.PI * 2);
          context.stroke();
        },
        true,
      );
      traditions.forEach((tradition, index) => {
        add(`religion-${tradition.id}`, RELIGION_MEDALLION_SIZE, medallion(tradition, false));
        add(`religion-origin-${tradition.id}`, RELIGION_MEDALLION_SIZE, medallion(tradition, true));
        // Whole-world views generalise later milestones to dots; founding centres keep their emblem.
        // Transparent padding widens the click target without enlarging the drawn dot.
        add(`religion-dot-${tradition.id}`, 40, (context) => {
          context.beginPath();
          context.arc(20, 20, 7, 0, Math.PI * 2);
          context.fillStyle = tradition.color;
          context.fill();
          context.strokeStyle = INK;
          context.lineWidth = 2.2;
          context.stroke();
        });
        add(`religion-arrow-${tradition.id}`, 24, (context) => {
          const arrow = new Path2D('M5 5 L21 12 L5 19 L9 12 Z');
          context.strokeStyle = INK;
          context.lineWidth = 2.5;
          context.stroke(arrow);
          context.fillStyle = tradition.color;
          context.fill(arrow);
        });
        // Hatching separates approximate religious zones from flat political fills.
        // Alternating directions cross-hatch where two traditions' zones overlap.
        add(`religion-hatch-${tradition.id}`, 10, (context) => {
          context.strokeStyle = tradition.color;
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
