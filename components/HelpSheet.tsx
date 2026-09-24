'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Gem, Swords, Waypoints, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { onboardingText, type OnboardingCopyKey } from '@/lib/i18n/onboarding';
import { resourceText } from '@/lib/resources/i18n';

export default function HelpSheet({
  open,
  onOpenChange,
  onShowStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent while a record, campaign or story is open: the start card would stay hidden. */
  onShowStart?: () => void;
}) {
  const { locale, t } = useI18n();
  const text = (key: OnboardingCopyKey) => onboardingText(locale, key);
  const shortcuts: { keys: string[]; action: OnboardingCopyKey }[] = [
    { keys: [text('spaceKey')], action: 'keySpace' },
    { keys: ['←', '→'], action: 'keyArrows' },
    { keys: ['⌘ K', 'Ctrl K'], action: 'keySearch' },
    { keys: [text('escapeKey')], action: 'keyEscape' },
  ];
  const layers = [
    { icon: Swords, name: resourceText(locale, 'battles'), role: text('layerBattles') },
    { icon: Gem, name: resourceText(locale, 'resources'), role: text('layerResources') },
    { icon: Waypoints, name: text('religions'), role: text('layerReligions') },
  ];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="help-sheet"
          data-testid="help-sheet"
          onCloseAutoFocus={(event) => {
            // The sheet opens from the header button rather than a Radix trigger: return there.
            event.preventDefault();
            document.querySelector<HTMLElement>('[data-testid="help-trigger"]')?.focus();
          }}
        >
          <div className="help-sheet-heading">
            <Dialog.Title>{text('helpTitle')}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t('close')}>
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="help-lead">{text('helpLead')}</Dialog.Description>
          <section>
            <h3>{text('timelineHeading')}</h3>
            <ul className="help-list">
              <li>{text('timelineDrag')}</li>
              <li>{text('timelineWheel')}</li>
              <li>{text('timelinePlay')}</li>
            </ul>
          </section>
          <section>
            <h3>{text('keysHeading')}</h3>
            <dl className="help-terms" data-testid="help-shortcuts">
              {shortcuts.map(({ keys, action }) => (
                <div key={action}>
                  <dt>
                    {keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{text(action)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>{text('layersHeading')}</h3>
            <dl className="help-terms" data-testid="help-layers">
              {layers.map(({ icon: Icon, name, role }) => (
                <div key={name}>
                  <dt>
                    <Icon size={15} aria-hidden="true" />
                    {name}
                  </dt>
                  <dd>{role}</dd>
                </div>
              ))}
            </dl>
            <p className="help-note">{text('layerKey')}</p>
            <p className="help-note">{text('toolsNote')}</p>
          </section>
          {onShowStart && (
            <button
              type="button"
              className="text-button help-show-start"
              onClick={() => {
                onOpenChange(false);
                onShowStart();
              }}
            >
              {text('showStart')}
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
