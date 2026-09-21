import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CampaignSchema, type HistoricalEvent } from '../../lib/schema';
import { localizedLanguage, localizedName } from '../../lib/i18n';

const dataRoot = join(process.cwd(), 'public/data');

describe('published campaign names', () => {
  it('uses exact sourced event names and an English default for every step', () => {
    const campaigns = CampaignSchema.array().parse(
      JSON.parse(readFileSync(join(dataRoot, 'campaigns.json'), 'utf8')),
    );
    expect(campaigns.length).toBeGreaterThan(0);
    for (const campaign of campaigns) {
      for (const step of campaign.steps) {
        const event: HistoricalEvent = JSON.parse(
          readFileSync(join(dataRoot, 'events', `${step.eventId}.json`), 'utf8'),
        );
        expect(step.name, step.eventId).toEqual(event.name);
        expect(step.label, step.eventId).toBe(event.name.en);
        expect(localizedName(step.name!, 'en')).toBe(event.name.en);
        expect(localizedName(step.name!, 'fr')).toBe(event.name.fr ?? event.name.en);
        expect(localizedLanguage(step.name!, 'zh')).toBe(event.name.zh ? 'zh' : 'en');
      }
    }
  });
});
