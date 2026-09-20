'use client';
import { useEffect } from 'react';
import { ArrowUpRight, Play, Pause, SkipForward, SkipBack, X, Route } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { formatYear } from '@/lib/histdate';
import { useJson } from '@/lib/data-client/hooks';
import { openCampaign } from '@/lib/navigation';
import type { Campaign } from '@/lib/schema';

export default function CampaignPanel() {
  const { data: campaigns, loading, error } = useJson<Campaign[]>('/data/campaigns.json');
  const campaignId = useAtlasStore((s) => s.campaignId),
    step = useAtlasStore((s) => s.campaignStep);
  const { locale, t } = useI18n();
  const playing = useAtlasStore((state) => state.campaignPlaying);
  const setPlaying = useAtlasStore((state) => state.setCampaignPlaying);
  const detailOpen = useAtlasStore((state) => Boolean(state.selectedEvent || state.selectedEntity));
  useEffect(() => {
    if (detailOpen) setPlaying(false);
  }, [detailOpen, setPlaying]);
  useEffect(
    () => () => {
      useAtlasStore.getState().setCampaignPlaying(false);
    },
    [],
  );
  const selected = campaigns?.find((item) => item.id === campaignId);
  useEffect(() => {
    if (!loading && !selected) setPlaying(false);
  }, [loading, selected, setPlaying]);
  useEffect(() => {
    if (!selected) return;
    const boundedStep = Math.max(0, Math.min(selected.steps.length - 1, step));
    if (boundedStep !== step) openCampaign(selected, boundedStep);
  }, [selected, step]);
  useEffect(() => {
    if (!playing || !selected) return;
    const timer = setInterval(() => {
      const current = useAtlasStore.getState().campaignStep;
      if (current >= selected.steps.length - 1) {
        setPlaying(false);
        return;
      }
      openCampaign(selected, current + 1);
    }, 3200);
    return () => clearInterval(timer);
  }, [playing, selected, setPlaying]);
  return (
    <section className="campaign-panel">
      <div className="section-heading">
        <h2>
          {selected
            ? (selected.name[locale] ?? selected.name.en)
            : t('Guerres & campagnes', 'Wars & campaigns')}
        </h2>
        {selected && (
          <button
            className="icon-button"
            aria-label={t('Fermer la campagne', 'Close campaign')}
            onClick={() => {
              setPlaying(false);
              useAtlasStore.getState().setCampaign(null);
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>
      {!selected && (
        <p className="panel-intro">
          {t(
            'Suivez les événements d’un conflit. À chaque étape, les territoires se redessinent à l’année correspondante.',
            'Follow the events of a conflict. At each step, territories redraw for the corresponding year.',
          )}
        </p>
      )}
      {loading && <p className="loading-line">{t('loading')}…</p>}
      {error && (
        <p className="empty-state">
          {t('Les campagnes ne sont pas disponibles.', 'Campaigns are unavailable.')}
        </p>
      )}
      {selected ? (
        <>
          <p className="campaign-dates">
            {formatYear(selected.steps[0].date.year, locale)} —{' '}
            {formatYear(selected.steps.at(-1)!.date.year, locale)}
          </p>
          <div className="campaign-controls">
            <button
              className="icon-button"
              aria-label={t('previousStep')}
              disabled={step === 0}
              onClick={() => openCampaign(selected, step - 1)}
            >
              <SkipBack size={17} />
            </button>
            <button
              className="primary-button"
              onClick={() => {
                if (step >= selected.steps.length - 1) openCampaign(selected, 0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {playing ? t('Pause', 'Pause') : t('Lire la campagne', 'Play campaign')}
            </button>
            <button
              className="icon-button"
              aria-label={t('nextStep')}
              disabled={step >= selected.steps.length - 1}
              onClick={() => openCampaign(selected, step + 1)}
            >
              <SkipForward size={17} />
            </button>
          </div>
          {selected.steps[step]?.eventId && (
            <button
              className="text-button"
              onClick={() => {
                setPlaying(false);
                useAtlasStore.setState({ selectedEvent: selected.steps[step].eventId ?? null });
              }}
            >
              {t('Lire la fiche de cette étape', 'Read this step’s event')}
              <ArrowUpRight size={14} />
            </button>
          )}
          <ol className="campaign-steps">
            {selected.steps.map((item, index) => (
              <li
                key={`${item.eventId}-${index}`}
                className={index === step ? 'current' : index < step ? 'visited' : ''}
              >
                <button
                  onClick={() => openCampaign(selected, index)}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span className="step-number">{index + 1}</span>
                  <span>
                    <small>{formatYear(item.date.year, locale)}</small>
                    <strong>{item.label}</strong>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="source-note">
            {t(
              'Les lignes relient les lieux dans l’ordre chronologique. Elles ne représentent pas un itinéraire militaire attesté.',
              'Lines connect locations chronologically. They do not represent a verified military route.',
            )}
          </p>
          <a
            className="source-link"
            href={selected.sources[0]?.url}
            target="_blank"
            rel="noreferrer"
          >
            {t('Consulter la source', 'Read the source')}
            <ArrowUpRight size={14} />
          </a>
        </>
      ) : (
        <div className="campaign-catalog">
          {campaigns?.map((campaign) => (
            <button
              className="campaign-card"
              key={campaign.id}
              onClick={() => {
                openCampaign(campaign);
                setPlaying(false);
              }}
            >
              <Route size={20} strokeWidth={1.25} />
              <span>
                <strong>{campaign.name[locale] ?? campaign.name.en}</strong>
                <small>
                  {formatYear(campaign.steps[0].date.year, locale)} —{' '}
                  {formatYear(campaign.steps.at(-1)!.date.year, locale)}
                  <span>
                    {campaign.steps.length} {t('étapes', 'steps')}
                  </span>
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
