import { RESOURCE_COLORS } from '@/lib/resources/colors';
import { RESOURCE_ICONS, type ResourceIconPaint } from '@/lib/resources/icons';
import type { ResourceCategory } from '@/lib/resources/types';

export default function ResourceIcon({
  category,
  className,
}: {
  category: ResourceCategory;
  className?: string;
}) {
  const paints: Record<ResourceIconPaint, string> = {
    color: RESOURCE_COLORS[category],
    ink: '#153640',
    paper: '#fff4dd',
    none: 'none',
  };

  return (
    <svg
      viewBox="0 0 32 32"
      width="24"
      height="24"
      className={className ? `resource-icon ${className}` : 'resource-icon'}
      data-resource-icon={category}
      aria-hidden="true"
      focusable="false"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {RESOURCE_ICONS[category].map(
        ({ d, fill = 'none', stroke = 'ink', strokeWidth = 1.6 }, index) => (
          <path
            key={index}
            d={d}
            fill={paints[fill]}
            stroke={paints[stroke]}
            strokeWidth={strokeWidth}
          />
        ),
      )}
    </svg>
  );
}
