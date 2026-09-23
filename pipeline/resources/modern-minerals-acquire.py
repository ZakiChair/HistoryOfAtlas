#!/usr/bin/env python3
"""Acquire versioned mining evidence. The app never calls this script or its APIs."""
import argparse
import concurrent.futures
import gzip
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
DOWNLOADS = {
    'global.zip': ('modern-minerals-global.zip', 'https://zenodo.org/records/7369478/files/open_database_mine_production.zip?download=1'),
    'mincan.xlsx': ('modern-minerals-mincan.xlsx', 'https://ndownloader.figshare.com/files/45011833'),
    'giomt.geojson': ('modern-minerals-giomt.json.gz', 'https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/giomt/giomt_map_2026-09.geojson'),
}

def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'HistoryOfAtlas resource evidence import; non-interactive public dataset research'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def clean_cell(value):
    value = re.sub(r'<ref\b[^>]*(?:/>|>.*?</ref>)', '', value, flags=re.S)
    value = re.sub(r'<[^>]+>', '', value)
    return value.replace("'''", '').strip()

def wiki_facts(page):
    revision = page['revisions'][0]
    content = revision['slots']['main']['*']
    general = re.search(r'General Mine Details.*?\{\|.*?\n\|-\s*\n(.*?)\n\|}', content, re.S)
    cells = [clean_cell(line[1:]) for line in general.group(1).splitlines() if line.startswith('| ') ] if general else []
    records = []
    production = re.search(r'Production Details.*?\{\|(.*?)\n\|}', content, re.S)
    if production:
        for block in production.group(1).split('\n|-'):
            vals = [clean_cell(line[1:]) for line in block.splitlines() if line.startswith('| ')]
            if len(vals) >= 2 and re.fullmatch(r'\d{4}', vals[0]):
                records.append({'year': int(vals[0]), 'value': vals[1]})
    return {
        'title': page['title'], 'pageId': page['pageid'], 'revisionId': revision['revid'],
        'revisionTimestamp': revision['timestamp'],
        'status': cells[0] if len(cells) >= 3 else '',
        'start': cells[1] if len(cells) >= 3 else '',
        'end': cells[2] if len(cells) >= 3 else '',
        'production': records,
        # Preserve factual citations, not the copyrighted page prose.
        'referenceUrls': sorted(set(re.findall(r'\|\s*url\s*=\s*(https?://[^\s|}<>]+)', content))),
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Directory containing original global.zip, mincan.xlsx and giomt.geojson')
    parser.add_argument('--wiki', action='store_true', help='Acquire cited start/stop production facts from public GEM wiki API')
    args = parser.parse_args()
    destination = ROOT / 'sources'
    destination.mkdir(exist_ok=True)
    manifest = {'downloadedAt': '2026-09-23', 'files': []}
    map_rows = []
    for local_name, (output_name, url) in DOWNLOADS.items():
        raw = (args.source_dir / local_name).read_bytes() if args.source_dir else request(url)
        data = raw
        if local_name == 'giomt.geojson':
            map_rows = [feature['properties'] for feature in json.loads(raw)['features']]
            data = gzip.compress(json.dumps(map_rows, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
        (destination / output_name).write_bytes(data)
        manifest['files'].append({'file': output_name, 'url': url, 'sourceSha256': hashlib.sha256(raw).hexdigest(), 'extractSha256': hashlib.sha256(data).hexdigest()})
        print(output_name, len(data))
    if args.wiki:
        titles = sorted(set(urllib.parse.unquote(row['url'].rsplit('/', 1)[-1]).replace('_', ' ') for row in map_rows if row['status'] in ['operating', 'retired', 'mothballed']))
        def batch(group):
            query = urllib.parse.urlencode({'action': 'query', 'prop': 'revisions', 'rvprop': 'ids|timestamp|content', 'rvslots': 'main', 'titles': '|'.join(group), 'format': 'json', 'redirects': '1', 'maxlag': '5'})
            answer = json.loads(request('https://www.gem.wiki/w/api.php?' + query))
            if 'error' in answer:
                raise ValueError(answer['error'])
            return [wiki_facts(page) for page in answer['query']['pages'].values() if 'revisions' in page]
        groups = [titles[i:i + 40] for i in range(0, len(titles), 40)]
        facts = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            for results in pool.map(batch, groups):
                facts.extend(results)
                print('wiki factual records', len(facts), flush=True)
        facts.sort(key=lambda row: row['title'])
        data = gzip.compress(json.dumps(facts, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
        filename = 'modern-minerals-giomt-wiki.json.gz'
        (destination / filename).write_bytes(data)
        manifest['files'].append({'file': filename, 'url': 'https://www.gem.wiki/w/api.php', 'extractSha256': hashlib.sha256(data).hexdigest(), 'records': len(facts), 'note': 'Dates, status, production facts and citation URLs only; original prose is not redistributed. Original page revisions are individually recorded.'})
    (destination / 'modern-minerals-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

if __name__ == '__main__':
    main()
