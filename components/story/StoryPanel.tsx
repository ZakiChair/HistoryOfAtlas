'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen } from 'lucide-react';
import { useAtlasStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useJson } from '@/lib/data-client/hooks';
import { getEvent } from '@/lib/data-client';
import { openEvent } from '@/lib/navigation';
import type { Story } from '@/lib/schema';

async function activateStep(story: Story, index: number, showDetails = false) {
  index = Math.max(0, Math.min(story.steps.length - 1, index));
  useAtlasStore.getState().patchState({
    storyId: story.id,
    storyStep: index,
    campaignId: null,
    selectedWar: null,
    playing: false,
  });
  const event = await getEvent(story.steps[index].eventId);
  const current = useAtlasStore.getState();
  if (current.storyId === story.id && current.storyStep === index)
    openEvent(event, { preserveContext: true, showDetails });
}

export default function StoryPanel() {
  const { data: stories, loading, error } = useJson<Story[]>('/data/stories.json');
  const id = useAtlasStore((s) => s.storyId),
    activeStep = useAtlasStore((s) => s.storyStep);
  const detailOpen = useAtlasStore((s) => Boolean(s.selectedEvent || s.selectedEntity));
  const { locale, t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [navigationError, setNavigationError] = useState(false);
  const story = stories?.find((item) => item.id === id);
  useEffect(() => {
    if (!story || !container.current || detailOpen) return;
    const requestedStep = useAtlasStore.getState().storyStep;
    const initialStep = Math.max(0, Math.min(story.steps.length - 1, requestedStep));
    if (initialStep !== requestedStep)
      void activateStep(story, initialStep).catch(() => setNavigationError(true));
    container.current
      .querySelector<HTMLElement>(`[data-step="${initialStep}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const step = Number((entry.target as HTMLElement).dataset.step);
            if (useAtlasStore.getState().storyStep === step) continue;
            void activateStep(story, step).catch(() => setNavigationError(true));
          }
      },
      { root: container.current, threshold: 0.65 },
    );
    container.current
      .querySelectorAll('[data-step]')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [story, detailOpen]);
  if (loading) return <p className="loading-line">{t('loading')}…</p>;
  if (error)
    return (
      <p className="empty-state">
        {t('Les parcours ne sont pas disponibles.', 'Guided stories are unavailable.')}
      </p>
    );
  return (
    <section className="story-panel">
      {navigationError && (
        <p className="notice" role="status">
          {t(
            'Cette étape ne peut pas être chargée pour le moment.',
            'This step cannot be loaded right now.',
          )}
        </p>
      )}
      {story ? (
        <>
          <button className="text-button" onClick={() => useAtlasStore.getState().setStory(null)}>
            <ArrowLeft size={15} />
            {t('Tous les parcours', 'All stories')}
          </button>
          <h2 className="story-title">{story.title[locale] ?? story.title.en}</h2>
          <p className="panel-intro">{story.description[locale] ?? story.description.en}</p>
          <div
            ref={container}
            className="story-scroll"
            tabIndex={0}
            aria-label={t('Défiler pour suivre le récit', 'Scroll to follow the story')}
          >
            {story.steps.map((step, index) => (
              <article
                data-step={index}
                key={`${step.eventId}-${index}`}
                className={`story-step ${activeStep === index ? 'active' : ''}`}
              >
                <span className="story-step-number">
                  {index + 1} / {story.steps.length}
                </span>
                <p>{step.text[locale] ?? step.text.en}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setNavigationError(false);
                    void activateStep(story, index).catch(() => setNavigationError(true));
                  }}
                >
                  {t('Explorer cette étape', 'Explore this step')}
                  <ArrowUpRight size={14} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setNavigationError(false);
                    void activateStep(story, index, true).catch(() => setNavigationError(true));
                  }}
                >
                  {t('Lire la fiche', 'Read event details')}
                  <ArrowUpRight size={14} />
                </button>
                <a
                  className="source-link"
                  href={`https://www.wikidata.org/wiki/${step.eventId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikidata · {step.eventId}
                  <ArrowUpRight size={14} />
                </a>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="section-heading">
            <h2>{t('Des histoires à parcourir', 'Stories to explore')}</h2>
            <BookOpen size={18} />
          </div>
          <p className="panel-intro">
            {t(
              'Faites défiler le récit. La carte vous accompagne de lieu en lieu, de frontière en frontière.',
              'Scroll through a story. The map follows you from place to place, from border to border.',
            )}
          </p>
          <div className="story-catalog">
            {stories?.map((item, index) => (
              <button
                className="story-card"
                key={item.id}
                onClick={() => {
                  setNavigationError(false);
                  void activateStep(item, 0).catch(() => setNavigationError(true));
                }}
              >
                <span className="story-card-index">{String(index + 1).padStart(2, '0')}</span>
                <strong>{item.title[locale] ?? item.title.en}</strong>
                <span>
                  {item.steps.length} {t('étapes documentées', 'documented steps')}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
