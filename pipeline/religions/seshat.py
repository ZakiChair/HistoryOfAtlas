"""Build reviewed qualitative prevalence on dated Cliopatria polity geometry.

Default and --check work offline from the committed minimal source extract.
--acquire recreates that extract from the ignored, complete Seshat API cache and
the pinned Cliopatria archive. No null observation date inherits polity dates.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]
EXTRACT = ROOT / 'data/curated/religion-coverage-seshat-source.json'
OUTPUT = ROOT / 'data/curated/religion-coverage-seshat.json'
REPORT = ROOT / 'data/reports/religion-coverage-seshat.json'
CLIO_COMMIT = 'ad28a691b7c07c1fca89d0e0636d324667d2a258'
CLIO_URL = f'https://github.com/Seshat-Global-History-Databank/cliopatria/tree/{CLIO_COMMIT}'
PREVALENCE = {'v_m': 'majority', 'o_h_p': 'majority', 'sz_m': 'substantial'}
PREVALENCE_LABELS = {'v_m': 'Vast majority', 'o_h_p': 'Over half of the population', 'sz_m': 'Sizeable minority'}


def astro(year):
    return year + 1 if year < 0 else year


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'


def validate_geometry(geometry):
    if geometry.get('type') not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Expected Polygon or MultiPolygon')
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    if not polygons:
        raise ValueError('Empty polygon')
    for polygon in polygons:
        if not polygon:
            raise ValueError('Empty polygon rings')
        for ring in polygon:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('Polygon ring must be closed')
            for index, point in enumerate(ring):
                if len(point) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
                    raise ValueError('Invalid coordinate')
                if not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90:
                    raise ValueError('Coordinate out of range')
                if index and abs(point[0] - ring[index - 1][0]) > 180:
                    raise ValueError('Unsplit antimeridian edge')


def build_fragment(source, base_traditions):
    traditions = {t['id']: {k: t[k] for k in ('id', 'names', 'color', 'symbol')} | {'kind': 'religion'}
                  for t in base_traditions}
    traditions.update({t['id']: t for t in source.get('extraTraditions', [])})
    sources = {s['id']: s for s in source['sources']}
    features = defaultdict(list)
    for feature in source['features']:
        validate_geometry(feature['geometry'])
        if feature['properties'].get('Type') == 'POLITY':
            features[feature['properties'].get('SeshatID')].append(feature)
    rejected, accepted, candidates = [], [], defaultdict(list)
    for record in sorted(source['records'], key=lambda r: r['id']):
        review = source['reviews'].get(str(record['id']))
        reason = None
        if not review:
            reason = 'not-editorially-reviewed'
        elif record.get('is_disputed') or record.get('is_uncertain'):
            reason = 'disputed-or-uncertain-source-code'
        elif record.get('year_from') is None or record.get('year_to') is None:
            reason = 'no-explicit-observation-interval'
        elif record['degree_of_prevalence'] not in PREVALENCE:
            reason = 'not-explicit-majority-or-substantial-minority'
        elif record['year_from'] > record['year_to']:
            reason = 'reversed-observation-interval'
        if reason:
            rejected.append({'id': record['id'], 'reason': reason})
            continue
        if review['traditionId'] not in traditions:
            raise ValueError(f"Unknown reviewed tradition: {review['traditionId']}")
        start, end = astro(record['year_from']), astro(record['year_to'])
        matching = [f for f in features[record['polity']['name']]
                    if astro(f['properties']['FromYear']) <= end and astro(f['properties']['ToYear']) >= start]
        if not matching:
            rejected.append({'id': record['id'], 'reason': 'no-matching-dated-geometry'})
            continue
        sid = f'seshat-widespread-{record["id"]}'
        sources[sid] = {
            'id': sid,
            'title': f'Seshat — {record["polity"]["long_name"]}: {record["widespread_religion"]["religion_name"]}',
            'url': f'https://seshat-db.com/api/rt/widespread-religions/{record["id"]}/',
            'license': 'CC-BY-SA-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
            'citation': f'Seshat Global History Databank, Widespread Religion, record {record["id"]}; ' +
                        PREVALENCE_LABELS[record['degree_of_prevalence']] + '. ' + ' '.join(record.get('references', [])),
        }
        accepted.append(record['id'])
        for feature in matching:
            fstart, fend = astro(feature['properties']['FromYear']), astro(feature['properties']['ToYear'])
            candidates[(record['polity']['name'], feature['id'])].append({
                'record': record, 'review': review, 'feature': feature, 'sourceId': sid,
                'start': max(start, fstart), 'end': min(end, fend),
            })
    observations, geometries, used_traditions, conflicts = [], {}, set(), []
    for (polity_id, feature_id), entries in sorted(candidates.items()):
        # Split at both source intervals and dated geometry changes; never extend a
        # demographic code into the remainder of a polity's life.
        boundaries = sorted({n for e in entries for n in (e['start'], e['end'] + 1)})
        for start, stop in zip(boundaries, boundaries[1:]):
            active = [e for e in entries if e['start'] <= start and e['end'] >= stop - 1]
            if not active:
                continue
            majority_families = {e['review']['traditionId'] for e in active
                                 if PREVALENCE[e['record']['degree_of_prevalence']] == 'majority'}
            if len(majority_families) > 1:
                conflicts.append({'polityId': polity_id, 'fromYear': start, 'toYear': stop - 1,
                                  'recordIds': sorted(e['record']['id'] for e in active)})
                continue
            groups = defaultdict(list)
            for entry in active:
                groups[entry['review']['traditionId']].append(entry)
            shares = []
            for tradition_id, members in sorted(groups.items()):
                prevalence = 'majority' if any(PREVALENCE[e['record']['degree_of_prevalence']] == 'majority'
                                                for e in members) else 'substantial'
                codes = '; '.join(f"{e['record']['widespread_religion']['religion_name']}: " +
                                 PREVALENCE_LABELS[e['record']['degree_of_prevalence']] for e in members)
                extra_fr = ' '.join(dict.fromkeys(e['review']['note']['fr'] for e in members))
                extra_en = ' '.join(dict.fromkeys(e['review']['note']['en'] for e in members))
                shares.append({'traditionId': tradition_id, 'prevalence': prevalence,
                               'sourceIds': sorted({e['sourceId'] for e in members}),
                               'note': {'fr': f'Codage Seshat : {codes}. {extra_fr} Aucun pourcentage n’est déduit ; les branches d’une même famille sont regroupées sans addition.',
                                        'en': f'Seshat coding: {codes}. {extra_en} No percentage is inferred; branches of one family are grouped without addition.'}})
                used_traditions.add(tradition_id)
            feature = active[0]['feature']
            geometry_id = f'seshat-clio-{feature_id}'
            geometries[geometry_id] = {'id': geometry_id, 'geometry': feature['geometry'], 'sourceIds': ['cliopatria']}
            source_ids = sorted({e['sourceId'] for e in active} | {'seshat', 'cliopatria'})
            fstart, fend = astro(feature['properties']['FromYear']), astro(feature['properties']['ToYear'])
            observations.append({
                'id': f'seshat-{polity_id}-{feature_id}-{start}-{stop - 1}',
                'regionId': f'seshat-{polity_id}', 'name': active[0]['review']['name'], 'geometryId': geometry_id,
                'time': {'kind': 'interval', 'fromYear': start, 'toYear': stop - 1},
                'populationScope': {
                    'fr': f'Population de la communauté politique codée par Seshat ({active[0]["record"]["polity"]["long_name"]}). Contour politique historique approximatif Cliopatria daté {fstart}–{fend} ; il ne localise pas les habitants de chaque religion.',
                    'en': f'Population of the polity coded by Seshat ({active[0]["record"]["polity"]["long_name"]}). Approximate historical political outline from Cliopatria, dated {fstart}–{fend}; it does not locate the inhabitants of each religion.',
                },
                'shares': shares, 'sourceIds': source_ids,
                'note': {'fr': 'Estimation historique qualitative ; période limitée à l’intersection des dates démographiques codées et du contour historique. Les limites politiques ne sont pas des frontières religieuses.',
                         'en': 'Qualitative historical estimate, limited to the intersection of coded demographic dates and historical geometry dates. Political boundaries are not religious boundaries.'},
            })
    result = {'version': 1, 'snapshotMaxAge': 10,
              'traditions': [traditions[key] for key in sorted(used_traditions)],
              'sources': [sources[key] for key in sorted(sources)],
              'geometries': [geometries[key] for key in sorted(geometries)], 'observations': observations}
    report = {'sourceRecords': len(source['records']), 'acceptedSourceRecords': accepted, 'rejected': rejected,
              'conflicts': conflicts, 'observations': len(observations), 'geometries': len(geometries),
              'regions': len({o['regionId'] for o in observations}),
              'acquisitionAudit': source.get('audit', {})}
    return result, report


def acquire():
    """Curate an immutable, compact derivative, retaining source hashes/references."""
    from shapely.geometry import shape, mapping
    raw = ROOT / 'data/raw/religions'
    pages = sorted(raw.glob('seshat-widespread-page*.json'), key=lambda p: int(re.search(r'page(\d+)', p.name)[1]))
    if len(pages) != 13:
        raise RuntimeError('Complete cached API response required: 13 pages, 1,206 records.')
    records = [r for p in pages for r in json.loads(p.read_text())['results']]
    if len(records) != 1206 or len({r['id'] for r in records}) != 1206:
        raise RuntimeError('Incomplete or duplicate Seshat acquisition; refusing publication.')
    names = {
        'so_adal_sultanate': ('Sultanat d’Adal', 'Adal Sultanate'),
        'ye_qasimid_dyn': ('Yémen — Qasimides', 'Yemen — Qasimids'),
        'is_icelandic_commonwealth': ('État libre islandais', 'Icelandic Commonwealth'),
        'us_haudenosaunee_1': ('Confédération haudenosaunee', 'Haudenosaunee Confederacy'),
        'et_aksum_emp_2': ('Royaume d’Axoum', 'Kingdom of Aksum'),
        'tr_roman_dominate': ('Empire romain — Dominat', 'Roman Empire — Dominate'),
    }
    # Explicitly reviewed identities, population scope and narrative caveats.
    selected = {435: 'islam', 476: 'islam', 477: 'islam', 503: 'christianity', 506: 'christianity',
                538: 'ethiopian-traditional', 633: 'christianity', 634: 'greco-roman', 743: 'islam',
                744: 'christianity', 799: 'islam', 800: 'islam', 846: 'old-norse',
                891: 'ethiopian-traditional', 892: 'christianity', 1060: 'greco-roman', 1061: 'christianity'}
    caveats = {
        'so_adal_sultanate': ('Le changement de codage en 1537 accompagne la conquête de territoires chrétiens ; il ne décrit pas une conversion collective.',
                              'The coding change in 1537 follows conquest of Christian territories; it does not describe collective conversion.'),
        'ye_qasimid_dyn': ('Dates approximatives selon Seshat ; regroupement des codages sunnite et chiite dans la famille islam.',
                           'Dates are approximate according to Seshat; Sunni and Shia codes are grouped in the Islam family.'),
        'is_icelandic_commonwealth': ('La présence chrétienne minoritaire coexistait avec la prédominance des traditions nordiques. Aucun codage postérieur à l’an 1000 n’est retenu ici, en raison des réserves du commentaire source.',
                                      'A Christian minority coexisted with predominant Norse traditions. Post-1000 codes are omitted here because of conflicting caveats in the source narrative.'),
        'us_haudenosaunee_1': ('Estimation issue notamment de récits missionnaires et d’une étude des conversions et des migrations ; la pratique et l’adhésion sont difficiles à mesurer.',
                               'Estimate based in part on missionary accounts and a study of conversion and migration; practice and adherence are difficult to measure.'),
        'et_aksum_emp_2': ('Dates approximatives et diffusion rurale progressive selon Seshat ; l’adoption par la cour précède la diffusion dans la population.',
                           'Dates are approximate and rural diffusion was gradual according to Seshat; adoption at court preceded diffusion among the population.'),
        'tr_roman_dominate': ('Reconstruction démographique reprise par Seshat, fondée sur des estimations de croissance ; le passage autour de 350 est approximatif et non un recensement.',
                             'Demographic reconstruction adopted by Seshat, based on growth estimates; the transition around 350 is approximate and is not a census.'),
    }
    reviewed, minimal = {}, []
    for r in sorted(records, key=lambda r: r['id']):
        if r['id'] not in selected:
            continue
        name = r['polity']['name']
        reviewed[str(r['id'])] = {'traditionId': selected[r['id']], 'name': dict(zip(('fr', 'en'), names[name])),
                                  'note': dict(zip(('fr', 'en'), caveats[name]))}
        keep = {k: r[k] for k in ('id', 'polity', 'year_from', 'year_to', 'degree_of_prevalence',
                                 'order', 'is_disputed', 'is_uncertain', 'tag', 'widespread_religion')}
        description = r.get('description') or ''
        keep['descriptionSha256'] = hashlib.sha256(description.encode()).hexdigest()
        keep['references'] = sorted(set(re.findall(r'https://www\.zotero\.org/groups/1051264/seshat_databank/items/[A-Za-z0-9]+', description)))
        minimal.append(keep)
    archive_path = ROOT / 'data/raw/geography/cliopatria.geojson.zip'
    with zipfile.ZipFile(archive_path) as archive:
        features = json.loads(archive.read('cliopatria_polities_only.geojson'))['features']
    selected_features = []
    for index, feature in enumerate(features):
        if feature['properties'].get('SeshatID') not in names:
            continue
        relevant = [r for r in minimal if r['polity']['name'] == feature['properties']['SeshatID']]
        if not any(r['year_from'] <= feature['properties']['ToYear'] and r['year_to'] >= feature['properties']['FromYear'] for r in relevant):
            continue
        original = shape(feature['geometry'])
        if not original.is_valid:
            raise ValueError(f'Invalid source Cliopatria geometry {index}')
        simplified = original.simplify(0.03, preserve_topology=True)
        geometry = json.loads(json.dumps(mapping(simplified)))
        validate_geometry(geometry)
        selected_features.append({'id': index, 'properties': feature['properties'], 'geometry': geometry,
                                  'originalGeometrySha256': hashlib.sha256(encoded(feature['geometry']).encode()).hexdigest()})
    result = {
        'version': 1, 'acquiredAt': '2026-09-28',
        'acquisition': [{'url': 'https://seshat-db.com/api/rt/widespread-religions/?format=json&page_size=2000&page=' + re.search(r'page(\d+)', p.name)[1],
                         'cacheFile': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in pages],
        'cliopatria': {'commit': CLIO_COMMIT, 'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
                       'modifications': 'Matched exact SeshatID; selected intersecting dated POLITY geometry; simplified at 0.03 degree tolerance with topology preserved. No modern-country clipping or fabricated boundaries.'},
        'audit': {'totalApiRecords': len(records), 'prevalenceCodes': dict(Counter(str(r['degree_of_prevalence']) for r in records)),
                  'explicitDateIntervals': sum(r['year_from'] is not None and r['year_to'] is not None for r in records),
                  'selectedRecords': sorted(selected),
                  'reviewedExclusions': {'504,847': 'Post-1000 Iceland narrative contains incompatible descriptions of Christian majority versus persisting pagan worldview; omitted.',
                                         '619': 'Abbasid Shia minority inferred from political support and repression, insufficient direct demographic scope for an empire-wide overlay.',
                                         '1113': 'Narrative concerns northern Syrian settlement, not an empire-wide demographic statement.'},
                  'datePolicy': 'No implicit inheritance of a polity duration. Only explicit year_from/year_to fields are admitted; all other records remain outside this reviewed fragment.'},
        'records': minimal, 'reviews': reviewed, 'features': selected_features,
        'extraTraditions': [
            {'id': 'old-norse', 'names': {'fr': 'Traditions nordiques anciennes', 'en': 'Old Norse traditions'}, 'color': '#768eab', 'symbol': 'norse', 'kind': 'religion'},
            {'id': 'ethiopian-traditional', 'names': {'fr': 'Traditions éthiopiennes anciennes', 'en': 'Traditional Ethiopian religions'}, 'color': '#ac805e', 'symbol': 'ethiopian', 'kind': 'religion'},
        ],
        'sources': [
            {'id': 'seshat', 'title': 'Seshat Global History Databank — Widespread Religion', 'url': 'https://seshat-db.com/rt/widespread_religions_all/', 'license': 'CC-BY-SA-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'citation': 'Seshat Global History Databank, Religious Demography. Qualitative prevalence categories; API extracted 2026-09-28.'},
            {'id': 'cliopatria', 'title': 'Cliopatria — dated political boundaries', 'url': CLIO_URL, 'license': 'CC-BY-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'citation': 'Cliopatria, pinned revision ' + CLIO_COMMIT + '; https://doi.org/10.1038/s41597-025-04516-9. Geometry simplified; not religious boundaries.'},
        ],
    }
    EXTRACT.write_text(encoded(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--acquire', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.acquire and args.check:
        parser.error('--acquire cannot be combined with --check')
    if args.acquire:
        acquire()
    source = json.loads(EXTRACT.read_text())
    base = json.loads((ROOT / 'public/data/religions/history.json').read_text())['traditions']
    result, report = build_fragment(source, base)
    for path, value in ((OUTPUT, result), (REPORT, report)):
        expected = encoded(value)
        if args.check:
            if not path.exists() or path.read_text() != expected:
                raise RuntimeError(f'Stale Seshat output: {path.relative_to(ROOT)}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected)
    print(f'Seshat: {report["regions"]} regions; {report["observations"]} dated observations; {report["geometries"]} historical geometries; {len(report["conflicts"])} conflicts.')


if __name__ == '__main__':
    main()
