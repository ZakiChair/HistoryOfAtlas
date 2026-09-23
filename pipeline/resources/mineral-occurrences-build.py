#!/usr/bin/env python3
"""Build geological knowledge independently of evidence of mine exploitation."""
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
USGS_URL = 'https://mrdata.usgs.gov/major-deposits/'
ICMM_URL = 'https://www.icmm.com/website/data/2026/global-mining-dataset-1-5.xlsx?cb=142831'
USGS_CATEGORIES = {
    'Cu': 'copper', 'Au': 'gold', 'Ag': 'silver', 'Fe': 'iron', 'Pb': 'lead', 'Zn': 'zinc',
    'phosphate': 'phosphate', 'P': 'phosphate', 'PGE': 'platinum-group', 'Cr': 'chromium',
    'Mo': 'molybdenum', 'Ti': 'titanium', 'Ni': 'nickel', 'salt': 'salt', 'REE': 'rare-earths',
    'Sn': 'tin', 'Al': 'bauxite', 'bauxite': 'bauxite', 'W': 'tungsten', 'Co': 'cobalt',
    'Mn': 'manganese', 'potash': 'potash', 'diamond': 'diamond', 'Nb': 'niobium', 'U': 'uranium',
    'graphite': 'graphite', 'barite': 'barium', 'Ba': 'barium', 'Ta': 'tantalum',
    'fluorspar': 'fluorite', 'fluorite': 'fluorite', 'Li': 'lithium', 'lithium mica': 'lithium',
    'Pt': 'platinum', 'Pd': 'palladium', 'Mg': 'magnesium', 'magnesite': 'magnesium',
    'magnesia': 'magnesium', 'V': 'vanadium', 'B': 'boron', 'Hg': 'mercury', 'Sb': 'antimony',
    'silica sand': 'silicon', 'coal': 'coal', 'Se': 'selenium', 'Te': 'tellurium',
    'Cs': 'cesium', 'Sc': 'scandium',
}
ICMM_CATEGORIES = {
    'coal': 'coal', 'iron ore': 'iron', 'iron': 'iron', 'gold': 'gold', 'copper': 'copper',
    'zinc': 'zinc', 'tin': 'tin', 'silver': 'silver', 'nickel': 'nickel', 'lead': 'lead',
    'barium': 'barium', 'tungsten': 'tungsten', 'lithium': 'lithium', 'pge / pgm': 'platinum-group',
    'pge/pgm': 'platinum-group', 'chromium': 'chromium', 'chromite': 'chromium',
    'bauxite': 'bauxite', 'aluminium': 'bauxite', 'cobalt': 'cobalt',
    'heavy mineral sands': 'mineral-sands', 'uranium': 'uranium', 'phosphate': 'phosphate',
    'manganese': 'manganese', 'antimony': 'antimony', 'diamond': 'diamond',
    'molybdenum': 'molybdenum', 'boron': 'boron', 'borates': 'boron', 'mercury': 'mercury',
    'niobium': 'niobium', 'ree': 'rare-earths', 'vanadium': 'vanadium', 'titanium': 'titanium',
    'potash': 'potash', 'fluorspar': 'fluorite', 'tantalum': 'tantalum', 'platinum': 'platinum',
    'palladium': 'palladium', 'graphite': 'graphite', 'salt': 'salt',
}


def decode_name(value):
    if any(marker in value for marker in ('Ã', 'Â')):
        try:
            return value.encode('latin1').decode('utf8')
        except UnicodeError:
            pass
    return value


def key(value):
    value = ''.join(char for char in unicodedata.normalize('NFKD', decode_name(value))
                    if not unicodedata.combining(char)).lower()
    return ''.join(char for char in value if char.isalnum())


COUNTRY_ALIASES = {
    'usa': 'unitedstates', 'unitedstatesofamerica': 'unitedstates',
    'congodrc': 'democraticrepublicofthecongo', 'congodemocraticrepublicof': 'democraticrepublicofthecongo',
    'congokinshasa': 'democraticrepublicofthecongo', 'zaire': 'democraticrepublicofthecongo',
    'congobrazzaville': 'republicofthecongo', 'congo': 'republicofthecongo',
    'russianfederation': 'russia', 'ivorycoast': 'cotedivoire', 'burma': 'myanmar',
    'republicofkorea': 'southkorea', 'koreasouth': 'southkorea', 'koreanorth': 'northkorea',
    'czechrepublic': 'czechia', 'swaziland': 'eswatini', 'macedonia': 'northmacedonia',
    'bosniaherzegovina': 'bosniaandherzegovina', 'kyrgyzrepublic': 'kyrgyzstan',
    'kalaallitnunaatgreenland': 'greenland', 'surinam': 'suriname', 'luxenbourg': 'luxembourg',
}


def country_key(value):
    normalized = key(value)
    return COUNTRY_ALIASES.get(normalized, normalized)


def name_key(value):
    value = unicodedata.normalize('NFKD', decode_name(value)).lower()
    value = re.sub(r'\b(mines?|deposits?|quarries|quarry|operations?)\b', ' ', value)
    return key(value)


def position(lon, lat):
    try:
        lon, lat = float(lon), float(lat)
        if not math.isfinite(lon) or not math.isfinite(lat) or not -180 <= lon <= 180 or not -90 <= lat <= 90:
            return None
        return [lon, lat] if lon != 0 or lat != 0 else None
    except (ValueError, TypeError):
        return None


def distance_km(a, b):
    x, y, xx, yy = map(math.radians, [*a, *b])
    return 12742 * math.asin(min(1, math.sqrt(math.sin((yy-y)/2)**2 + math.cos(y)*math.cos(yy)*math.sin((xx-x)/2)**2)))


def site_index(sites):
    index = collections.defaultdict(list)
    for site in sites:
        index[(name_key(site['name']), country_key(site.get('country', '')))].append(site)
    return index


def exact_match(site, index):
    candidates = [candidate for candidate in index.get((name_key(site['name']), country_key(site.get('country', ''))), [])
                  if distance_km(site['coordinates'], candidate['coordinates']) <= 10]
    return candidates[0] if len(candidates) == 1 else None


def in_ring(point, ring):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside


def segment_distance(point, a, b):
    # Conservative local metric for the coarse 1:110m boundary screen only.
    scale = math.cos(math.radians(point[1]))
    ax, ay = (a[0]-point[0])*scale, a[1]-point[1]
    bx, by = (b[0]-point[0])*scale, b[1]-point[1]
    dx, dy = bx-ax, by-ay
    t = max(0, min(1, -(ax*dx+ay*dy)/(dx*dx+dy*dy))) if dx or dy else 0
    return 111.2 * math.hypot(ax+t*dx, ay+t*dy)


class CountryGeometry:
    def __init__(self, features):
        self.shapes = collections.defaultdict(list)
        for feature in features:
            polygons = feature['geometry']['coordinates']
            if feature['geometry']['type'] == 'Polygon':
                polygons = [polygons]
            names = {country_key(feature['properties'].get(field) or '') for field in ['NAME_EN', 'ADMIN', 'NAME_LONG', 'NAME', 'NAME_CIAWF']}
            for name in names - {''}:
                self.shapes[name].extend(polygons)

    def accepts(self, point, country):
        # Older catalogue jurisdictions are checked against the union of their
        # successor/constituent polygons; the source label itself is preserved.
        members = {'koreanpeninsula': ['northkorea', 'southkorea'],
                   'serbiaandmontenegro': ['serbia', 'montenegro', 'kosovo'],
                   'somalia': ['somalia', 'somaliland']}.get(country_key(country), [country_key(country)])
        for polygon in [polygon for member in members for polygon in self.shapes.get(member, [])]:
            if in_ring(point, polygon[0]) and not any(in_ring(point, hole) for hole in polygon[1:]):
                return True
            if any(segment_distance(point, a, b) <= 40 for a, b in zip(polygon[0], polygon[0][1:] + polygon[0][:1])):
                return True
        return False


def occurrence(identifier, name, country, coordinates, categories, source_id, source_url, year, description):
    if not coordinates or not categories:
        return None
    categories = sorted(set(categories))
    return {'id': identifier, 'name': decode_name(name).strip(), 'country': decode_name(country),
            'coordinates': coordinates, 'categories': categories, 'sourceId': source_id,
            'sourceUrl': source_url, 'coordinateSourceUrl': source_url, 'sourceYear': year,
            'accuracy': 'approximate', 'periods': [],
            'knowledge': [{'fromYear': year, 'kind': 'attestation', 'categories': categories,
                           'sourceUrl': source_url, 'approximate': True, 'description': description}]}


def usgs_occurrence(row):
    return occurrence('usgs-occurrence:' + row['id'], row['name'], row['country'], position(row['longitude'], row['latitude']),
                      [USGS_CATEGORIES[c] for c in row['commodities'] if c in USGS_CATEGORIES],
                      'usgs-occurrences-2009', USGS_URL, 2009,
                      'Gisement attesté au plus tard dans la compilation USGS dont la dernière source date de 2009. '
                      'Cette borne documentaire approximative n’est ni une date de découverte ni une preuve d’exploitation. '
                      'Les coordonnées sont régionales et peuvent être décalées de plusieurs kilomètres. / '
                      'Known mineral occurrence in the 2009 compilation; discovery year and extraction status are unknown.')


def icmm_occurrence(row):
    if row.get('Asset Type', '').strip() != 'Mine':
        return None
    if row.get('Confidence Factor') not in ('High', 'Moderate'):
        return None
    categories = [ICMM_CATEGORIES[value.strip().lower()] for field in ['Primary Commodity', 'Secondary Commodity']
                  for value in row.get(field, '').split(';') if value.strip().lower() in ICMM_CATEGORIES]
    return occurrence('icmm-occurrence:' + row['ICMMID'], row['Mine Name'], row['Country'], position(row['Longitude'], row['Latitude']),
                      categories, 'icmm-occurrences-2026', ICMM_URL, 2026,
                      'Site minier et substances associées attestés dans le catalogue ICMM de juillet 2026. '
                      'Le catalogue comprend aussi des sites fermés et des projets : cette attestation ne prouve aucune '
                      'exploitation actuelle et ne fournit pas la date de découverte. / '
                      'Mining location and associated minerals documented in the 2026 inventory; no current extraction is inferred.')


def read_frozen(manifest, name):
    entry = next(item for item in manifest['files'] if item['name'] == name)
    raw = (ROOT / 'sources' / entry['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry['sha256']:
        raise ValueError('Occurrence source checksum mismatch: ' + name)
    return json.loads(gzip.decompress(raw))


def build():
    manifest = json.loads((ROOT / 'sources/mineral-occurrences-manifest.json').read_text())
    reviews = json.loads((ROOT / 'mineral-occurrences-reviews.json').read_text())
    existing = read_frozen(manifest, 'existing-identities')
    existing_by_id = {site['id']: site for site in existing}
    index = site_index(existing)
    explicit = {item['occurrenceId']: item for item in reviews['matches']}
    exclusions = {item['occurrenceId']: item for item in reviews['exclusions']}
    geography = CountryGeometry(read_frozen(manifest, 'country-geometry')['features'])
    sources = [
        {'id': 'usgs-occurrences-2009', 'name': 'USGS — Major mineral deposits, 2009 compilation', 'url': USGS_URL,
         'year': 2009, 'license': 'Public domain (USGS)', 'licenseUrl': 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
         'description': 'Regional deposit locations and associated commodities, not a mine-production register. The report series began in 2005; source metadata gives 2009 as the last-source publication date. Known by that approximate documentary bound; individual discovery dates are unspecified.'},
        {'id': 'icmm-occurrences-2026', 'name': 'ICMM — known mining locations, July 2026 catalogue', 'url': ICMM_URL,
         'year': 2026, 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
         'description': 'Adapted high/moderate-confidence mining-location catalogue. Includes closed mines and projects; never used to infer active production or an earlier discovery. Processing-only and very-low-confidence locations are omitted. No endorsement by ICMM is implied.'},
    ]
    sites, audit, omitted = [], [], []
    updates = collections.defaultdict(lambda: collections.defaultdict(list))
    for name, normalizer in [('usgs', usgs_occurrence), ('icmm', icmm_occurrence)]:
        for raw in read_frozen(manifest, name):
            identifier = ('usgs-occurrence:' + raw['id']) if name == 'usgs' else ('icmm-occurrence:' + raw['ICMMID'])
            site = normalizer(raw)
            if identifier in exclusions or site is None:
                omitted.append({'id': identifier, 'name': raw.get('name', raw.get('Mine Name')),
                                'reason': exclusions.get(identifier, {}).get('reason', 'Unsupported commodity, processing-only, low-confidence identity or invalid coordinates')})
                continue
            override = explicit.get(identifier)
            match = existing_by_id[override['siteId']] if override else exact_match(site, index)
            if not override and not geography.accepts(site['coordinates'], site['country']):
                omitted.append({'id': identifier, 'name': site['name'], 'country': site['country'], 'coordinates': site['coordinates'],
                                'reason': 'Published point fails coarse country-boundary screen (40 km allowance); held for location review.'})
                continue
            if match:
                updates[site['sourceId']][match['id']].extend(site['knowledge'])
                audit.append({'id': identifier, 'name': site['name'], 'matchedSiteId': match['id'],
                              'mode': 'knowledge-only', 'sourceCoordinates': site['coordinates'],
                              'distanceKm': round(distance_km(site['coordinates'], match['coordinates']), 3),
                              'rule': override['reason'] if override else 'Unique same normalized primary name and country, within 10 km; retain existing coordinates.',
                              'sourceCategories': site['categories']})
            else:
                sites.append(site)
                # Later catalogues can attach knowledge to an already accepted occurrence.
                index[(name_key(site['name']), country_key(site['country']))].append(site)
                existing_by_id[site['id']] = site
                audit.append({'id': identifier, 'name': site['name'], 'mode': 'new-occurrence',
                              'sourceCategories': site['categories'], 'geography': 'inside source country or within 40 km of coarse boundary'})
    return {'sources': sources, 'sites': sites,
            'knowledgeGroups': [{'sourceId': source, 'updates': [{'siteId': site, 'knowledge': knowledge} for site, knowledge in sorted(group.items())]}
                                for source, group in sorted(updates.items())], 'audit': audit, 'omitted': omitted}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    output = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    target = ROOT / 'mineral-occurrences.json'
    if args.check:
        if not target.exists() or target.read_text() != output:
            raise SystemExit('Occurrence contribution differs from the frozen source build')
    else:
        target.write_text(output)
    print(json.dumps({'sites': len(result['sites']), 'matchedRows': sum('matchedSiteId' in a for a in result['audit']),
                      'omitted': len(result['omitted']), 'newCategories': collections.Counter(c for s in result['sites'] for c in s['categories'])}, indent=2))


if __name__ == '__main__':
    main()
