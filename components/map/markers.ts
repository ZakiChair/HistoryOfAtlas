import type { Map } from 'maplibre-gl';
import type { EventType } from '@/lib/types';

/** Stroked 32×32 glyphs drawn on the map's event discs; the event key redraws them as SVG. */
export const EVENT_GLYPHS: Record<EventType, string[]> = {
  battle: [
    'M6 5 L24 23 M25 5 L7 23',
    'M4 20 L11 27 M20 27 L27 20',
    'M6 5 L7 11 L12 7 M25 5 L24 11 L19 7',
  ],
  siege: [
    'M6 26 L6 10 L10 10 L10 6 L14 6 L14 10 L18 10 L18 6 L22 6 L22 10 L26 10 L26 26 Z',
    'M13 26 L13 20 Q16 15 19 20 L19 26',
  ],
  naval: [
    'M16 10 L16 26',
    'M8 15 L24 15',
    'M5 20 Q7 27 16 27 Q25 27 27 20',
    'M5 20 L5 25 M27 20 L27 25',
  ],
  treaty: [
    'M8 7 L23 7 Q27 7 27 11 L27 12 L10 12 L10 24 Q10 27 6 27 L22 27 Q25 27 25 23 L25 12',
    'M14 17 L21 17 M14 21 L20 21',
  ],
  war: ['M8 28 L8 5', 'M8 6 Q14 3 20 7 Q23 9 27 7 L27 18 Q22 21 17 17 Q13 15 8 17'],
  campaign: ['M7 26 Q24 24 13 17 Q2 11 23 7', 'M19 3 L25 7 L21 12'],
  conquest: ['M16 4 L16 9 M16 23 L16 28 M4 16 L9 16 M23 16 L28 16'],
};

/** Extra circles completing the naval anchor ring and the conquest target. */
export const EVENT_GLYPH_CIRCLES: Partial<Record<EventType, [number, number, number]>> = {
  naval: [16, 7, 3],
  conquest: [16, 16, 8],
};

/** Ink disc and paper stroke of the pictograms shown from zoom 3.5. */
export const EVENT_GLYPH_PAINT = { disc: '#16313c', stroke: '#fff1d1' } as const;

/** Small local sprites avoid an external icon service or one DOM node per event. */
export function addEventSprites(map: Map) {
  for (const [type, lines] of Object.entries(EVENT_GLYPHS)) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) continue;
    context.scale(2, 2);
    context.strokeStyle = EVENT_GLYPH_PAINT.stroke;
    context.lineWidth = 1.6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = EVENT_GLYPH_PAINT.disc;
    context.beginPath();
    context.arc(16, 16, 15, 0, Math.PI * 2);
    context.fill();
    for (const line of lines) context.stroke(new Path2D(line));
    const circle = EVENT_GLYPH_CIRCLES[type as EventType];
    if (circle) {
      context.beginPath();
      context.arc(circle[0], circle[1], circle[2], 0, Math.PI * 2);
      context.stroke();
    }
    map.addImage(`event-${type}`, context.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
  }
}
