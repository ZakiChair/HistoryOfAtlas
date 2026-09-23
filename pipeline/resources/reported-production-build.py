#!/usr/bin/env python3
"""Append cited quarterly mine observations, never forecasts or company totals.

Offline, standard-library-only build from a pinned report-index snapshot.
Mine identities are explicitly reviewed in reported-production-matches.json;
the index's coordinates are not imported into the atlas.
"""
import argparse
import collections
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent


def normalized(value):
    value = unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode().lower()
    return ' '.join(re.findall(r'[a-z0-9]+', value))


def observation_year(row):
    # Explicit calendar quarters avoid fiscal-year and YTD ambiguity. Completed
    # Q1/Q2 2026 observations are available at the September snapshot; Q3 is not.
    period = row.get('calendar_period') or row.get('time_period') or ''
    match = re.fullmatch(r'Q([1-4]) (20\d{2})', period)
    if not match:
        return None
    quarter, year = map(int, match.groups())
    if year < 2021 or year > 2026 or (year == 2026 and quarter > 2):
        return None
    return year


def rejection_reason(row, match):
    value, confidence = row.get('value_normalized'), row.get('confidence')
    if row.get('metric') != 'production' or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        return 'not_positive_production'
    if not isinstance(confidence, (int, float)) or not math.isfinite(confidence) or confidence < .95:
        return 'low_confidence'
    if row.get('period_type') != 'quarterly':
        return 'not_quarterly'
    if not (row.get('source_url') or '').startswith('https://'):
        return 'no_source_url'
    locators = [row.get(k) or '' for k in ['source_row', 'source_table', 'source_section']]
    # Preserve word boundaries: Tara must not match "data rates" after removing
    # spaces, and aliases cannot be assembled across unrelated locator fields.
    if not any(' ' + normalized(alias) + ' ' in ' ' + normalized(locator) + ' '
               for alias in match['aliases'] if normalized(alias) for locator in locators):
        return 'no_mine_specific_report_locator'
    context = ' '.join(locators + [row.get('source_column') or '', row.get('product_form') or ''])
    if re.search(r'guidance|forecast|target|tailings|stockpile|recycling', context, re.I):
        return 'forecast_or_reprocessing'
    # Zn-equivalent, CuEq and gold-equivalent ounces combine different metals
    # by price; they cannot establish production of the reference commodity.
    if re.search(r'\bequivalent\d*\b|\b(?:Au|Ag|Cu|Zn|Pb|Ni|Co|Li|PGE)[ -]*Eq\b|\bGEOs?\b', context, re.I):
        return 'metal_equivalent'
    # A production table may contain sales and grades too. The broader section
    # title "Production and sales statistics" alone is not grounds to exclude it.
    if re.search(r'\bsales\b|\bsold\b|\bshipments?\b|\bgrade\b',
                 ' '.join([row.get('source_row') or '', row.get('source_column') or '']), re.I):
        return 'sales_or_grade'
    return None


def build():
    manifest = json.loads((ROOT / 'sources/reported-mine-production-manifest.json').read_text())
    raw = (ROOT / 'sources' / manifest['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest['extractSha256']:
        raise ValueError('Reported mine production source checksum mismatch')
    snapshot = json.loads(gzip.decompress(raw))
    matches = json.loads((ROOT / 'reported-production-matches.json').read_text())
    mapped = {match['mineId']: match for match in matches}
    if len(mapped) != len(matches):
        raise ValueError('Duplicate report-index mine identity')
    observations = collections.defaultdict(lambda: collections.defaultdict(list))
    supported = {'copper', 'gold', 'silver', 'zinc', 'lead', 'nickel', 'uranium',
                 'lithium', 'bauxite', 'manganese', 'cobalt', 'tin', 'tungsten',
                 'niobium', 'phosphate', 'platinum', 'palladium', 'molybdenum'}
    excluded = collections.Counter()
    for row in snapshot['records']:
        match = mapped.get(row['mine_id'])
        year = observation_year(row)
        if not match or year is None:
            continue
        category = 'diamond' if row['commodity'] == 'diamonds' else row['commodity']
        if category not in supported | {'diamond'}:
            continue
        if (row['source_extracted_at'] or '')[:10] > manifest['retrievedAt']:
            raise ValueError('Observation extracted after the snapshot date')
        reason = rejection_reason(row, match)
        if reason:
            excluded[reason] += 1
            continue
        if match.get('throughYear') is not None and year > match['throughYear']:
            continue
        observations[match['siteId']][(year, category)].append(row)
    updates, audit = [], []
    for site_id, annual in sorted(observations.items()):
        periods = []
        for (year, category), rows in sorted(annual.items()):
            # Prefer an explicit page number; retain every row ID in the audit.
            row = min(rows, key=lambda r: (r['source_page'] is None, r['id']))
            locator = f"page {row['source_page']}" if row['source_page'] is not None else 'the identified report table'
            periods.append({'fromYear': year, 'toYear': year, 'categories': [category],
                            'sourceUrl': row['source_url'],
                            'description': f"Positive {category} production at this mine or named mining complex in a completed quarter of {year}, reported by {row['company']} in {row['source_document_name']} ({locator}). This is an annual-resolution observation, not a closure date or an assertion of uninterrupted daily extraction. Sales, metal-equivalent indicators, forecasts and company-wide totals are excluded."})
            audit.append({'siteId': site_id, 'year': year, 'category': category,
                          'rowIds': [r['id'] for r in rows], 'mineIds': sorted({r['mine_id'] for r in rows}),
                          'sourceUrl': row['source_url'], 'document': row['source_document_name'],
                          'page': row['source_page'], 'table': row['source_table'],
                          'section': row['source_section'], 'row': row['source_row'],
                          'column': row['source_column'], 'productForm': row['product_form'],
                          'quarter': row['calendar_period'] or row['time_period']})
        updates.append({'siteId': site_id, 'periods': periods})
    if len(updates) < 30:
        raise ValueError('Unexpected loss of matched recent production evidence')
    return {'source': {'id': 'reported-mine-production-2026',
            'name': 'Primary operator quarterly production reports — World Mining Monitor index',
            'url': f"https://github.com/kadoa-org/world-mining-monitor/tree/{manifest['commit']}",
            'license': 'Factual report metadata; original company reports retain their copyright. Index supplied for research and educational use; index code MIT.',
            'year': 2026,
            'description': 'Completed calendar-quarter observations from named mine report rows, located through the pinned Kadoa World Mining Monitor index. Existing independently sourced mine coordinates and historical phases are retained. No sales, guidance, regional company totals, or undated deposit locations are added.'},
            'updates': updates, 'audit': audit, 'exclusions': dict(excluded)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    content = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    path = ROOT / 'reported-production.json'
    if args.check:
        if path.read_text() != content:
            raise SystemExit('Reported production differs from its deterministic offline build')
    else:
        path.write_text(content)
    print(f"Reported mine production: {len(result['updates'])} matched sites, {len(result['audit'])} dated category observations")


if __name__ == '__main__':
    main()
