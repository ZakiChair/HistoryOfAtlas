#!/usr/bin/env python3
"""Reproduce the pinned production-report index; write only with --acquire."""

import argparse
from datetime import date, datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import urllib.request


ROOT = Path(__file__).resolve().parent
COMMIT = '4ab9b84e59193d235feafc974d97696987f8ea53'
URL = f'https://raw.githubusercontent.com/kadoa-org/world-mining-monitor/{COMMIT}/public/data/mining.db'
DATABASE_SHA256 = 'ef718fe055a99d23fb254257256eff577051df1afbebde57e71acccaec25145f'
EXTRACT_SHA256 = '12713aa68576473821fba76c387457d6e46b16063e17d45971902d65218a98d7'
ARCHIVE = 'reported-mine-production.json.gz'
MANIFEST = 'reported-mine-production-manifest.json'
DESCRIPTION = ('Primary operator report facts indexed by Kadoa World Mining Monitor. '
               'Production metric only; additional eligibility and reviewed mine-identity '
               'filters are applied by the offline builder. No source excerpt is published to the atlas.')
MINE_COLUMNS = ('id', 'name', 'company', 'lat', 'lng', 'country', 'region', 'commodities')
RECORD_COLUMNS = (
    'id', 'mine_id', 'company', 'operation', 'commodity', 'product_form', 'metric',
    'value_normalized', 'unit_normalized', 'time_period', 'calendar_period',
    'period_type', 'confidence', 'source_url', 'source_document_name',
    'source_extracted_at', 'source_page', 'source_section', 'source_table',
    'source_row', 'source_column',
)


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def extract(database):
    if sha256_file(database) != DATABASE_SHA256:
        raise ValueError('SQLite checksum differs from the pinned source; refusing extraction')
    connection = sqlite3.connect(database.resolve().as_uri() + '?mode=ro&immutable=1', uri=True)
    connection.row_factory = sqlite3.Row
    try:
        mines = [dict(row) for row in connection.execute(
            f"SELECT {','.join(MINE_COLUMNS)} FROM mines ORDER BY id")]
        records = [dict(row) for row in connection.execute(
            f"SELECT {','.join(RECORD_COLUMNS)} FROM production WHERE metric = ? ORDER BY id",
            ('production',))]
    finally:
        connection.close()
    if (len(mines), len(records)) != (179, 8564):
        raise ValueError('Unexpected pinned snapshot row counts')
    content = json.dumps({'mines': mines, 'records': records}, ensure_ascii=False,
                         separators=(',', ':')).encode('utf-8')
    buffer = io.BytesIO()
    # GzipFile also fixes the OS header byte to 255 across platforms. There is
    # no filename, clock timestamp, JSON whitespace, or trailing newline.
    with gzip.GzipFile(filename='', mode='wb', compresslevel=9, mtime=0, fileobj=buffer) as output:
        output.write(content)
    archive = buffer.getvalue()
    if hashlib.sha256(archive).hexdigest() != EXTRACT_SHA256:
        raise ValueError('Generated gzip differs from the pinned extract checksum')
    latest_fact_date = max(row['source_extracted_at'][:10] for row in records
                           if row['source_extracted_at'])
    return content, archive, latest_fact_date


def manifest(retrieved_at):
    return {
        'retrievedAt': retrieved_at,
        'commit': COMMIT,
        'url': URL,
        'sourceSha256': DATABASE_SHA256,
        'file': ARCHIVE,
        'extractSha256': EXTRACT_SHA256,
        'records': 8564,
        'description': DESCRIPTION,
    }


def verify_existing(directory, content, archive, latest_fact_date):
    current = json.loads((directory / MANIFEST).read_text(encoding='utf-8'))
    retrieved_at = current.get('retrievedAt', '')
    date.fromisoformat(retrieved_at)
    if retrieved_at < latest_fact_date:
        raise ValueError('Manifest retrieval date precedes indexed evidence')
    if current != manifest(retrieved_at):
        raise ValueError('Manifest does not describe the pinned extraction')
    existing = (directory / ARCHIVE).read_bytes()
    if gzip.decompress(existing) != content:
        raise ValueError('Existing archive content differs from the SQLite extraction')
    if existing != archive:
        raise ValueError('Existing gzip bytes differ from the deterministic extraction')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Verify existing files without writing (default)')
    mode.add_argument('--acquire', action='store_true', help='Explicitly write the pinned archive and manifest')
    parser.add_argument('--database', type=Path, help='Use a local original mining.db; otherwise download the pinned URL')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'sources', help='Archive/manifest directory (default: sibling sources/)')
    args = parser.parse_args()
    try:
        with tempfile.TemporaryDirectory(prefix='hoa-reported-production-') as temporary:
            database = args.database
            if database is None:
                database = Path(temporary) / 'mining.db'
                request = urllib.request.Request(URL, headers={'User-Agent': 'HistoryOfAtlas reproducible resource evidence acquisition'})
                with urllib.request.urlopen(request, timeout=60) as response, database.open('wb') as output:
                    for block in iter(lambda: response.read(1024 * 1024), b''):
                        output.write(block)
            content, archive, latest_fact_date = extract(database)
            if args.acquire:
                retrieved_at = datetime.now(timezone.utc).date().isoformat()
                if retrieved_at < latest_fact_date:
                    raise ValueError('System date precedes indexed evidence; refusing an invalid manifest')
                args.output_dir.mkdir(parents=True, exist_ok=True)
                (args.output_dir / ARCHIVE).write_bytes(archive)
                (args.output_dir / MANIFEST).write_text(
                    json.dumps(manifest(retrieved_at), indent=2) + '\n', encoding='utf-8')
            verify_existing(args.output_dir, content, archive, latest_fact_date)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f'Reported production acquisition failed: {error}\n')
    print(f"{'Acquired and verified' if args.acquire else 'Verified'}: 179 mines, 8564 production records; gzip SHA-256 {EXTRACT_SHA256}")


if __name__ == '__main__':
    main()
