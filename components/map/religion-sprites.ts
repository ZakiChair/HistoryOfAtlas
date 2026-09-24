import type { Map as MapInstance } from 'maplibre-gl';
import type { ReligionTradition } from '@/lib/religions/types';
import { RELIGION_SYMBOLS } from '@/lib/religions/icons';

export function createReligionSprites(map: MapInstance) {
  const owned = new Set<string>();
  return {
    ensure(traditions: ReligionTradition[]) {
      for (const tradition of traditions) {
        const id = `religion-${tradition.id}`;
        if (map.hasImage(id)) continue;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 80;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Religion emblems could not be drawn');
        context.scale(2, 2);
        context.translate(4, 4);
        context.lineCap = context.lineJoin = 'round';
        const paths = RELIGION_SYMBOLS[tradition.symbol] ?? RELIGION_SYMBOLS.confucian;
        for (const d of paths) {
          const path = new Path2D(d);
          context.strokeStyle = '#09222e';
          context.lineWidth = 4.5;
          context.stroke(path);
          context.strokeStyle = tradition.color;
          context.lineWidth = 2;
          context.stroke(path);
        }
        map.addImage(id, context.getImageData(0, 0, 80, 80), { pixelRatio: 2 });
        owned.add(id);
        context.setTransform(2, 0, 0, 2, 0, 0);
        context.clearRect(0, 0, 40, 40);
        const arrow = new Path2D('M10 12 L25 20 L10 28 L14 20 Z');
        context.strokeStyle = '#09222e';
        context.lineWidth = 2;
        context.stroke(arrow);
        context.fillStyle = tradition.color;
        context.fill(arrow);
        const arrowId = `religion-arrow-${tradition.id}`;
        map.addImage(arrowId, context.getImageData(0, 0, 80, 80), { pixelRatio: 2 });
        owned.add(arrowId);
      }
    },
    dispose() {
      for (const id of owned) if (map.hasImage(id)) map.removeImage(id);
      owned.clear();
    },
  };
}
