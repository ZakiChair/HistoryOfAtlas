// Deliberately synthetic attribution exercises the dominant view without asserting history.
export const religionPolitiesFixture = {
  version: 1,
  acquiredAt: '2026-09-30',
  reviewedAt: '2026-09-30',
  families: [
    {
      id: 'christianity',
      names: { fr: 'Christianisme', en: 'Christianity' },
      color: '#edc578',
      symbol: 'cross',
      kind: 'religion',
    },
    {
      id: 'islam',
      names: { fr: 'Islam', en: 'Islam' },
      color: '#84c69a',
      symbol: 'crescent',
      kind: 'religion',
    },
  ],
  evidence: {
    majority: {
      fr: 'Majorité documentée dans la population',
      en: 'Documented population majority',
    },
    predominant: {
      fr: 'Religion la plus répandue (sans majorité mesurée)',
      en: 'Most widespread religion (no measured majority)',
    },
    state: { fr: 'Religion d’État ou officielle seulement', en: 'State or official religion only' },
  },
  sources: [
    {
      id: 'seshat',
      title: 'Source Seshat du scénario',
      url: 'https://example.org/seshat',
      license: 'Test fixture',
    },
    {
      id: 'wikidata',
      title: 'Source Wikidata du scénario',
      url: 'https://example.org/wikidata',
      license: 'Test fixture',
    },
    {
      id: 'cliopatria',
      title: 'Source Cliopatria du scénario',
      url: 'https://example.org/clio',
      license: 'Test fixture',
    },
  ],
  polities: [
    {
      entityId: 'clio-bd4b87bc07eb4c',
      name: 'Ottoman Empire',
      spans: [
        {
          from: 1299,
          to: 1922,
          familyId: 'islam',
          evidence: 'majority',
          basis: 'seshat',
          label: { fr: 'Islam — vaste majorité', en: 'Islam — vast majority' },
          note: {
            fr: 'Code Seshat non daté, appliqué à la durée du régime politique.',
            en: "Undated Seshat code applied to the polity's lifetime.",
          },
          links: [{ label: 'Seshat record 1', url: 'https://example.org/seshat-1' }],
          sourceIds: ['seshat', 'cliopatria'],
        },
      ],
    },
    {
      entityId: 'clio-5f93662ebde007',
      name: 'Kingdom of France',
      wikidataId: 'Q34392',
      spans: [
        {
          from: 481,
          to: 1791,
          familyId: 'christianity',
          evidence: 'state',
          basis: 'wikidata',
          label: { fr: 'catholicisme', en: 'Catholicism' },
          links: [{ label: 'Q202432', url: 'https://www.wikidata.org/wiki/Q202432' }],
          sourceIds: ['wikidata', 'cliopatria'],
        },
      ],
      wikidata: [
        {
          item: 'Q202432',
          label: { fr: 'catholicisme', en: 'Catholicism' },
          familyId: 'christianity',
        },
      ],
    },
    {
      entityId: 'clio-a773fee227ac36',
      name: 'Republic of Venice',
      spans: [
        {
          from: 697,
          to: 1200,
          familyId: 'christianity',
          evidence: 'predominant',
          basis: 'editorial',
          label: { fr: 'Christianisme', en: 'Christianity' },
          sourceIds: ['seshat'],
        },
      ],
    },
  ],
};
