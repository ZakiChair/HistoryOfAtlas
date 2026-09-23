import type { Map as MapInstance } from 'maplibre-gl';
import { RESOURCE_COLORS } from '@/lib/resources/colors';
import { RESOURCE_ICONS, type ResourceIconPaint } from '@/lib/resources/icons';
import {
  RESOURCE_CATEGORIES,
  type ResourceCategory,
  type ResourceSite,
} from '@/lib/resources/types';

const INK = '#153640';
const PAPER = '#fff4dd';
const PIXEL_RATIO = 2;

export const resourceIconKey = (categories: ResourceCategory[]) => [...categories].sort().join('-');

function drawIcon(context: CanvasRenderingContext2D, category: ResourceCategory) {
  const paints: Record<ResourceIconPaint, string> = {
    color: RESOURCE_COLORS[category],
    ink: INK,
    paper: PAPER,
    none: 'transparent',
  };
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const path of RESOURCE_ICONS[category]) {
    const shape = new Path2D(path.d);
    if (path.fill && path.fill !== 'none') {
      context.fillStyle = paints[path.fill];
      context.fill(shape);
    }
    if (path.stroke !== 'none') {
      context.strokeStyle = paints[path.stroke ?? 'ink'];
      context.lineWidth = path.strokeWidth ?? 1.6;
      context.stroke(shape);
    }
  }
}

/** Local sprites share their vector paths with the legend; no external image requests. */
export function createResourceSprites(map: MapInstance) {
  const ownedImages = new Set<string>();
  const add = (
    id: string,
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = width * PIXEL_RATIO;
    canvas.height = height * PIXEL_RATIO;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Resource pictograms could not be drawn');
    context.scale(PIXEL_RATIO, PIXEL_RATIO);
    draw(context);
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: PIXEL_RATIO,
    });
    ownedImages.add(id);
  };

  return {
    ensure(sites: ResourceSite[]) {
      for (const category of RESOURCE_CATEGORIES) {
        add(`resource-group-${category}`, 48, 48, (context) => {
          // A count cartouche distinguishes a group from a single exploitation site.
          context.fillStyle = INK;
          context.strokeStyle = PAPER;
          context.lineWidth = 1;
          context.beginPath();
          context.roundRect(6, 32, 36, 15, 3);
          context.fill();
          context.stroke();
          context.translate(8, 1);
          drawIcon(context, category);
        });
      }
      const seen = new Set<string>();
      for (const site of sites) {
        const categories = [...site.categories].sort();
        const key = resourceIconKey(categories);
        if (seen.has(key)) continue;
        seen.add(key);
        const columns = Math.min(categories.length, 3);
        const rows = Math.ceil(categories.length / columns);
        const glyphSize = categories.length === 1 ? 32 : 26;
        const width = columns * glyphSize + 8;
        const height = rows * glyphSize + 8;
        add(`resource-site-${key}`, width, height, (context) => {
          categories.forEach((category, index) => {
            context.save();
            context.translate(
              4 + (index % columns) * glyphSize,
              4 + Math.floor(index / columns) * glyphSize,
            );
            context.scale(glyphSize / 32, glyphSize / 32);
            drawIcon(context, category);
            context.restore();
          });
        });
        add(`resource-selection-${key}`, width + 8, height + 8, (context) => {
          const right = width + 5;
          const bottom = height + 5;
          const corners = new Path2D(
            `M3 11 V3 H11 M${right - 8} 3 H${right} V11 M3 ${bottom - 8} V${bottom} H11 M${right - 8} ${bottom} H${right} V${bottom - 8}`,
          );
          context.lineJoin = 'round';
          context.strokeStyle = INK;
          context.lineWidth = 4;
          context.stroke(corners);
          context.strokeStyle = PAPER;
          context.lineWidth = 2;
          context.stroke(corners);
        });
      }
    },
    dispose() {
      for (const id of ownedImages) if (map.hasImage(id)) map.removeImage(id);
      ownedImages.clear();
    },
  };
}
