'use client';

import { useAtlasStore } from '@/lib/store';
import { useReligionStore } from '@/lib/religions/store';
import { useReligionCoverageStore } from '@/lib/religions/coverage-store';
import { religionCoverageText } from '@/lib/religions/coverage-i18n';

export default function ReligionViewSwitch() {
  const locale = useAtlasStore((state) => state.locale);
  const view = useAtlasStore((state) => state.religionView);
  return (
    <div
      className="religion-view-switch"
      role="group"
      aria-label={religionCoverageText(locale, 'view')}
    >
      {(['coverage', 'history'] as const).map((value) => (
        <button
          key={value}
          type="button"
          data-testid={`religion-view-${value}`}
          aria-pressed={view === value}
          onClick={() => {
            useReligionCoverageStore.getState().select(null);
            useReligionStore.getState().select(null);
            useAtlasStore.getState().setReligionView(value);
          }}
        >
          {religionCoverageText(locale, value)}
        </button>
      ))}
    </div>
  );
}
