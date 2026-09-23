#!/usr/bin/env python3
"""Build the independent modern-minerals.json contribution from pinned local evidence."""
import argparse
import collections
import csv
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sqlite3
import struct
import tempfile
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / 'sources'
GLOBAL_URL = 'https://zenodo.org/records/7369478'
MINCAN_URL = 'https://figshare.com/articles/dataset/Principal_Productive_Mines_of_Canada/23740071'
GIOMT_URL = 'https://globalenergymonitor.org/projects/global-iron-ore-mines-tracker'
WEST_AFRICA = {'Mali', 'Ghana', 'Burkina Faso', 'Senegal', 'Guinea', 'Ivory Coast', 'Cote d Ivoire', "Côte d'Ivoire", 'Côte d’Ivoire'}
CATEGORY_NAMES = {
    'gold': 'gold', 'silver': 'silver', 'copper': 'copper', 'iron': 'iron', 'iron ore': 'iron', 'magnetite': 'iron',
    'uranium': 'uranium', 'lithium': 'lithium', 'nickel': 'nickel', 'bauxite': 'bauxite', 'aluminium': 'bauxite',
    'phosphate': 'phosphate', 'phosphates': 'phosphate', 'tin': 'tin', 'salt': 'salt', 'zinc': 'zinc',
    'lead': 'lead', 'cobalt': 'cobalt', 'manganese': 'manganese', 'molybdenum': 'molybdenum',
    'graphite': 'graphite', 'diamond': 'diamond', 'diamonds': 'diamond', 'potash': 'potash',
    'platinum': 'platinum', 'palladium': 'palladium', 'tungsten': 'tungsten', 'antimony': 'antimony',
    'niobium': 'niobium', 'tantalum': 'tantalum', 'mercury': 'mercury', 'rare earths': 'rare-earths',
}
ELEMENTS = {'Au':'gold','Ag':'silver','Cu':'copper','Fe':'iron','U3O8':'uranium','Li':'lithium','Li2O':'lithium','Ni':'nickel','Al':'bauxite','Al2O3':'bauxite','P':'phosphate','PO':'phosphate','Sn':'tin','Zn':'zinc','Pb':'lead','Co':'cobalt','Mn':'manganese','Mo':'molybdenum','dia':'diamond','K2O':'potash','Pt':'platinum','Pd':'palladium','W':'tungsten','Sb':'antimony','Nb':'niobium','Ta':'tantalum','Ta2O5':'tantalum'}

# These corrections constrain this source snapshot, not every later reopening.
# Metal recovered from old stockpiles must not reopen a mine on the timeline.
FINEPRINT_REVIEWS = {
    'COM00099.00': {'excludedYears': [[2002, 2020]], 'sourceUrl': 'https://ugspub.nr.utah.gov/publications/circular/c-118.pdf', 'reason': 'Barneys Canyon stopped mining in 2001; later gold came from old heap-leach pads.'},
    'COM00392.00': {'excludedYears': [[2013, 2020]], 'sourceUrl': 'https://www.waterquality.gov.au/anz-guidelines/resources/case-study/ranger-mine', 'reason': 'Ranger open-cut mining ceased in 2012; later uranium came from stockpiled ore.'},
    'COM00629.00': {'excludedYears': [[2004, 2020]], 'sourceUrl': 'https://www.sec.gov/Archives/edgar/data/863064/000102123105000222/b786126ex99-3.htm', 'reason': 'Kelian ceased mining in 2003; subsequent production was from stockpiled ore.'},
    'COM01069.00': {'excludedYears': [[2003, 2009]], 'sourceUrl': 'https://www.sec.gov/Archives/edgar/data/1056512/000106299307002879/exhibit3.htm', 'reason': 'Rawhide extraction ended in October 2002. Crushing and stacking of stockpiled ore finished in May 2003; later residual recovery does not establish extraction. This rule does not describe later reopening.'},
    'COM00496.00': {'ignoreProductionStart': True, 'sourceUrl': 'https://www.sec.gov/Archives/edgar/data/831259/000083125922000012/a2021trsptfi-exhibit.htm', 'reason': 'The 1967 metadata date is the initial contract, before mining in the 1970s. Keep documented production years rather than backdating extraction to the contract.'},
}

def category(value):
    return CATEGORY_NAMES.get(str(value or '').strip().lower())

def material_category(value):
    return ELEMENTS.get(str(value).split('.')[-1])

def year(value, maximum=2026):
    try:
        result = float(value)
        if result.is_integer() and 1000 <= result <= maximum:
            return int(result)
    except (ValueError, TypeError):
        pass
    return None

def number(value):
    try:
        n = float(str(value).replace(',', '').strip())
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None

def position(lon, lat):
    lon, lat = number(lon), number(lat)
    return [lon, lat] if lon is not None and lat is not None and -180 <= lon <= 180 and -90 <= lat <= 90 and (lon or lat) else None

def xlsx_sheets(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    ns = {'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    ss = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('x:si',ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    sheets = []
    for file in sorted(z.namelist()):
        if not re.fullmatch(r'xl/worksheets/sheet\d+\.xml', file):
            continue
        rows = []
        for row in ET.fromstring(z.read(file)).findall('.//x:row',ns):
            cells = {}
            for cell in row.findall('x:c',ns):
                value = cell.find('x:v',ns)
                inline = cell.find('x:is',ns)
                text = value.text if value is not None else ''.join(inline.itertext()) if inline is not None else ''
                col = re.sub(r'\d', '', cell.get('r'))
                cells[col] = ss[int(text)] if cell.get('t') == 's' and text else text
            if any(cells.values()):
                rows.append((int(row.get('r')), cells))
        sheets.append(rows)
    return sheets

def mincan_sites():
    sheets = xlsx_sheets((SOURCES/'modern-minerals-mincan.xlsx').read_bytes())
    header = sheets[1][0][1]
    sites, audit = [], []
    for row_number, cells in sheets[1][1:]:
        row = {header.get(col, col): value for col, value in cells.items()}
        primary = category(row.get('commodity1'))
        if not primary:
            continue
        coord = position(row.get('longitude'), row.get('latitude'))
        if not coord or 'coordinates are for the museum' in row.get('information', '').lower():
            audit.append({'row':row_number,'excluded':'Explicit museum coordinate or invalid position'})
            continue
        periods = []
        for phase in range(1,4):
            start = year(row.get(f'open{phase}'),2022)
            raw_end = row.get(f'close{phase}')
            end = 2022 if raw_end == 'open' else year(raw_end,2022)
            if start is None or end is None or end < start:
                continue
            description = f'MinCan production phase {phase}, from its published production-start and suspension/closure columns. '
            description += 'The source marks this phase open as of 2022; 2022 is the last attestation, not an asserted closure.' if raw_end == 'open' else 'The source does not distinguish temporary suspension from permanent closure.'
            description += ' Only the primary commodity is assigned throughout the phase; co-products without their own chronology are not projected across it.'
            periods.append({'fromYear':start,'toYear':end,'sourceUrl':MINCAN_URL,'categories':[primary],'approximate':True,'description':description})
        if not periods:
            continue
        name = row.get('namemine','').strip()
        if not name:
            company = row.get('company1','').strip()
            locality = row.get('town',row.get('province','Canada')).strip()
            name = f'{company} — {locality} (MinCan mine record)'
        site = {'id':f'mincan:{row_number}','name':name,'coordinates':coord,'categories':[primary],'country':'Canada','sourceId':'mincan-2024','sourceUrl':MINCAN_URL,'sourceYear':2024,'coordinateSourceUrl':MINCAN_URL,'accuracy':'approximate','periods':periods}
        sites.append(site)
        audit.append({'id':site['id'],'sourceRow':row_number,'primaryCommodity':row.get('commodity1'),'reportedCommodities':row.get('commodityall'),'information':row.get('information',''),'references':[row.get(f'link{i}') for i in range(1,4) if row.get(f'link{i}')]})
    return sites, audit

def gpkg_points(blob):
    if not blob:
        return []
    envelope_sizes = {0:0,1:32,2:48,3:48,4:64}
    offset = 8 + envelope_sizes[(blob[3] >> 1) & 7]
    def read_wkb(offset):
        endian = '<' if blob[offset] else '>'
        kind = struct.unpack_from(endian+'I',blob,offset+1)[0]
        if kind == 1:
            x,y = struct.unpack_from(endian+'dd',blob,offset+5)
            return [position(x,y)], offset+21
        if kind == 4:
            count = struct.unpack_from(endian+'I',blob,offset+5)[0]
            points, offset = [], offset+9
            for _ in range(count):
                children, offset = read_wkb(offset)
                points.extend(children)
            return points,offset
        raise ValueError(f'Unexpected source geometry type: {kind}')
    return [point for point in read_wkb(offset)[0] if point]

def source_url(record, source_table):
    raw = source_table.get(record.get('source_id'),{}).get('source_urls','')
    match = re.search(r'https?://[^\s<>]+',raw)
    return match.group(0).rstrip(';') if match else GLOBAL_URL

def merge_annual(annual, default_url, description):
    periods = []
    for y, values in sorted(annual.items()):
        cats = sorted(values['categories'])
        if not cats:
            continue
        urls = sorted(values['urls'])
        # All per-year evidence URLs remain in the audit; the dataset cites the source catalog
        # for a merged series when annual documents differ.
        url = urls[0] if len(urls)==1 else default_url
        prev = periods[-1] if periods else None
        period_description = values.get('description', description)
        approximate = values.get('approximate', False)
        if prev and prev['toYear']+1 == y and prev['categories']==cats and prev['description']==period_description and prev.get('approximate',False)==approximate:
            prev['toYear']=y
            if prev['sourceUrl'] != url:
                prev['sourceUrl']=default_url
        else:
            period = {'fromYear':y,'toYear':y,'categories':cats,'sourceUrl':url,'description':period_description}
            if approximate:
                period['approximate'] = True
            periods.append(period)
    return periods

def fineprint_evidence(row, table, source_table):
    source = source_table.get(row.get('source_id'), {})
    fields = sorted(set(re.findall(r'Estimate\s*\(([^)]+)\)', source.get('sources',''), re.I)))
    evidence = {'table':table,'id':row['id'],'sourceId':row['source_id'],'sourceUrl':source_url(row,source_table),'valueTonnes':number(row['value_tonnes'])}
    for key in ['material','commodity']:
        if row.get(key):evidence[key]=row[key]
    if fields:
        evidence['estimatedFields'] = fields
        evidence['sourceDescription'] = source['sources']
    if row.get('comment'):
        evidence['comment'] = row['comment']
    return evidence

def fineprint_observations(minerals, commodities, group_key, source_table):
    """Mine production is evidence even when its report omits ore tonnage.

    FINEPRINT also fills ore-mined quantities from processed/produced material.
    Requiring that column therefore neither proves fresh extraction nor provides
    a sound reason to discard a named mine's positive metal production.
    """
    mined = collections.defaultdict(dict)
    observed = collections.defaultdict(dict)
    stockpiles = collections.defaultdict(set)
    def observation(identifier, y):
        return observed[identifier].setdefault(y, {'categories':set(),'urls':set(),'records':[]})
    for row in minerals:
        identifier=group_key.get(row['facility_id']);y=year(row['year'],2021)
        if identifier is None or y is None:
            continue
        # This explicit source comment also occurs on gap-filled Ore mined rows.
        if row.get('comment','').strip().lower() == 'stockpiles were processed':
            stockpiles[identifier].add(y)
            continue
        if row['type'] != 'Ore mined':
            continue
        value=number(row['value_tonnes'])
        if value is None:
            continue
        facts=mined[identifier].setdefault(y, {'positive':False,'zero':False})
        facts['positive'] |= value>0; facts['zero'] |= value==0
        if value>0:
            result=observation(identifier,y);cat=material_category(row['material'])
            if cat:result['categories'].add(cat)
            result['urls'].add(source_url(row,source_table))
            result['records'].append(fineprint_evidence(row,'minerals',source_table))
    blocked = collections.defaultdict(set)
    for identifier in set(mined) | set(stockpiles):
        blocked[identifier] = {y for y,v in mined[identifier].items() if v['zero'] and not v['positive']}
        # Other ore streams can be proxies too. An explicit stockpile-only note
        # takes precedence until a separate reviewed extraction source exists.
        blocked[identifier].update(stockpiles[identifier])
    for row in commodities:
        identifier=group_key.get(row['facility_id']);y=year(row['year'],2021)
        value=number(row['value_tonnes']);cat=material_category(row['commodity'])
        if identifier is None or y is None or value is None or value<=0 or not cat or y in blocked[identifier]:
            continue
        result=observation(identifier,y)
        result['categories'].add(cat);result['urls'].add(source_url(row,source_table))
        result['records'].append(fineprint_evidence(row,'commodities',source_table))
    for years in observed.values():
        for facts in years.values():
            # Estimate(grade) does not imply an estimated production quantity.
            estimated = any('value' in r.get('estimatedFields',[]) for r in facts['records'])
            facts['description'] = 'Positive mine production documented for every included year at the named mining facility. Ore extraction or commodity output is accepted; the source may use processing or sales proxies. This is production evidence, not a claim of independently measured fresh ore extraction. Missing years and known shutdowns are not interpolated.'
            if estimated:
                facts['approximate'] = True
                facts['description'] += ' At least one production quantity is explicitly marked Estimate (value) by FINEPRINT; its original source and estimated field are retained in the audit.'
    return observed, mined, blocked

def check_fineprint_evidence_rules():
    """Small evidence fixtures guard the distinction between production and stockpiles."""
    sources={
        'report': {'sources':'Operator annual report','source_urls':'https://example.org/report'},
        'value': {'sources':'Operator annual report ; Estimate (value)','source_urls':'https://example.org/report'},
        'grade': {'sources':'Operator annual report ; Estimate (grade)','source_urls':'https://example.org/report'},
    }
    def row(y, source='report', value='1', comment=''):
        return {'id':str(y),'facility_id':'M.00','year':str(y),'source_id':source,'value_tonnes':value,'commodity':'Me.Cu','material':'O.Cu','type':'Ore mined','comment':comment}
    products=[row(2001),row(2002),row(2003),row(2004,'value'),row(2005,'grade'),row(2007),row(2008,value='')]
    products.append({**row(2009),'facility_id':'NON_MINE.00'})
    ore=[row(2002,value='0'),row(2003,comment='Stockpiles were processed')]
    observed,_,blocked=fineprint_observations(ore,products,{'M.00':'M'},sources)
    years=observed['M']
    if set(years)!={2001,2004,2005,2007} or blocked['M']!={2002,2003}:
        raise ValueError('Mine-output evidence, zero-extraction, stockpile or facility filtering regressed')
    if not years[2004].get('approximate') or years[2005].get('approximate'):
        raise ValueError('Estimated quantities and estimated grades were conflated')
    if years[2004]['records'][0]['estimatedFields']!=['value']:
        raise ValueError('Estimated-field provenance was lost')
    periods=merge_annual(years,GLOBAL_URL,'fixture')
    if any(p['fromYear']<=2006<=p['toYear'] for p in periods):
        raise ValueError('Missing production year was interpolated')

def fineprint_sites():
    archive = zipfile.ZipFile(SOURCES/'modern-minerals-global.zip')
    def table(name):
        return list(csv.DictReader(io.StringIO(archive.read(f'data/{name}.csv').decode('utf-8-sig'))))
    with tempfile.TemporaryDirectory() as directory:
        gpkg = Path(directory)/'facilities.gpkg'
        gpkg.write_bytes(archive.read('data/facilities.gpkg'))
        connection = sqlite3.connect(gpkg)
        connection.row_factory=sqlite3.Row
        facilities=[dict(row) for row in connection.execute('select * from facilities order by facility_id')]
        connection.close()
    source_table = {row['source_id']:row for row in table('source_ids')}
    groups=collections.defaultdict(list)
    for row in facilities:
        if 'Mine' in row['facility_type'] and row['primary_commodity']!='Coal':
            groups[row['facility_id'].split('.')[0]].append(row)
    # A Region/Company aggregate is not a mine: when no mine-level .00 parent
    # exists, keep the child mines distinct and never apply one child's chronology
    # to production from its siblings.
    valid_groups={}
    group_key={}
    for prefix,rows in groups.items():
        if any(row['facility_id'].endswith('.00') for row in rows):
            valid_groups[prefix]=rows
            for row in rows:group_key[row['facility_id']]=prefix
        else:
            for row in rows:
                valid_groups[row['facility_id']]=[row]
                group_key[row['facility_id']]=row['facility_id']
    groups=valid_groups
    minerals,commodities=table('minerals'),table('commodities')
    annual,mined,blocked=fineprint_observations(minerals,commodities,group_key,source_table)
    sites,audit=[],[]
    for identifier,rows in groups.items():
        parent=next((row for row in rows if row['facility_id'].endswith('.00')),rows[0])
        if parent['primary_commodity']=='Iron':
            audit.append({'id':f'fineprint:{parent["facility_id"]}', 'excluded':'GIOMT is preferred for global iron ore mines; FINEPRINT regional iron complexes can overlap several GIOMT mines.'})
            continue
        if parent['country']=='Canada':
            audit.append({'id':f'fineprint:{parent["facility_id"]}', 'excluded':'MinCan is preferred for Canadian mines because it records explicit production/reopening/suspension phases.'})
            continue # MinCan explicitly records production phases for Canadian principal mines.
        primary=category(parent['primary_commodity'])
        reported={category(x) for x in re.split(r'[,;]',parent['commodities_products'] or '')}-{None}
        if not primary and len(reported)==1:
            primary=next(iter(reported))
        if parent['country'] in WEST_AFRICA and (primary=='gold' or reported=={'gold'}):
            audit.append({'id':f'fineprint:{parent["facility_id"]}', 'excluded':'West African gold is reviewed separately against operator production and stockpile history.'})
            continue
        coords=gpkg_points(parent['geom'])
        if not coords:
            coords=[p for row in rows for p in gpkg_points(row['geom'])]
        if not coords:
            continue
        start,end=year(parent['production_start'],2021),year(parent['production_end'],2021)
        review=FINEPRINT_REVIEWS.get(parent['facility_id'],{})
        if review.get('ignoreProductionStart'):
            start=None
        gaps=set(blocked[identifier])
        for first,last in review.get('excludedYears',[]):
            gaps.update(range(first,last+1))
        observed=annual[identifier]
        for y,record in mined[identifier].items():
            if not record['positive']:
                continue
            entry=observed[y]
            if not entry['categories'] and primary:entry['categories'].add(primary)
        # Explicit operational bounds take precedence over later processing observations.
        observed={y:r for y,r in observed.items() if y not in gaps and (start is None or y>=start) and (end is None or y<=end)}
        periods=merge_annual(observed,GLOBAL_URL,'Positive mine production documented in every included year.')
        operations_url=source_url(parent,source_table)
        # Preserve documented lifetime endpoints without claiming exact uninterrupted output.
        # A known start can extend back before the first observation, but never bridge later gaps.
        bound=end
        if bound is None and parent['activity_status']=='active':
            bound=year(parent['activity_status_year'],2021)
        if bound is None and observed:
            bound=min(observed)
        if primary and start is not None and bound is not None and start<=bound:
            run_start=start
            for gap in sorted(y for y in gaps if start<=y<=bound)+[bound+1]:
                if run_start<=gap-1:
                    periods.append({'fromYear':run_start,'toYear':gap-1,'categories':[primary],'sourceUrl':operations_url,'approximate':True,'description':'Published production-start and production-end/status bounds, or the span from the published start to the first documented mine-production year. Operating-life bounds do not establish uninterrupted annual production; explicit zero-extraction years and known shutdowns remain gaps. No continuation beyond the latest attestation is inferred.'})
                run_start=gap+1
        if not periods:
            continue
        periods.sort(key=lambda p:(p['fromYear'],p['toYear'],p['categories']))
        categories=sorted({c for period in periods for c in period['categories']})
        site={'id':f'fineprint:{parent["facility_id"]}','name':parent['facility_name'] + (' — ' + parent['sub_site_name'] if parent.get('sub_site_name') and not parent['facility_id'].endswith('.00') else ''),'coordinates':coords[0],'categories':categories,'country':parent['country'],'sourceId':'fineprint-2023','sourceUrl':GLOBAL_URL,'sourceYear':2023,'coordinateSourceUrl':GLOBAL_URL,'accuracy':'approximate','periods':periods}
        sites.append(site)
        audit.append({'id':site['id'],'facilityIds':[row['facility_id'] for row in rows],'coordinateRule':'First published valid facility point; for a complex, this is a documented sub-site rather than an invented centroid.','publishedCoordinates':coords,'productionStart':start,'productionEnd':end,'activityStatus':parent['activity_status'],'activityStatusYear':parent['activity_status_year'],'operationsSourceUrl':operations_url,'excludedYears':sorted(gaps),'review':review,'observations':{str(y):{'categories':sorted(r['categories']),'evidence':r['records']} for y,r in observed.items()}})
    return sites,audit

def giomt_sites():
    path=SOURCES/'modern-minerals-giomt-wiki.json.gz'
    if not path.exists():return [],[]
    facts={r['title']:r for r in json.loads(gzip.decompress(path.read_bytes()))}
    rows=json.loads(gzip.decompress((SOURCES/'modern-minerals-giomt.json.gz').read_bytes()))
    sites,audit=[],[]
    for row in rows:
        if row['status'] not in ['operating','retired','mothballed']:
            continue
        coords=position(row.get('Longitude'),row.get('Latitude'))
        if not coords or row.get('location-accuracy')=='country-level only':
            continue
        title=urllib.parse.unquote(row['url'].rsplit('/',1)[-1]).replace('_',' ')
        fact=facts.get(title)
        if not fact:
            continue
        if number(fact['start']) is not None and number(fact['start'])>2026:
            continue
        cited=f'https://www.gem.wiki/w/index.php?oldid={fact["revisionId"]}'
        start=year(fact['start']);end=year(fact['end'])
        periods=[]
        if row['status']=='operating' and fact['status'].lower()=='operating':
            if start is not None:
                periods.append({'fromYear':start,'toYear':2026,'sourceUrl':cited,'categories':['iron'],'approximate':True,'description':'GEM publishes this production-start year and classifies the mine as operating in its September 2026 tracker snapshot. The operating-life interval may include unrecorded suspensions; 2026 is the dated status attestation, not a projected closure.'})
            else:
                periods.append({'fromYear':2026,'toYear':2026,'sourceUrl':cited,'categories':['iron'],'description':'Operating iron ore mine in the September 2026 GEM tracker snapshot. No earlier operation dates are inferred where the start is unknown.'})
        elif start is not None and end is not None and start<=end:
            periods.append({'fromYear':start,'toYear':end,'sourceUrl':cited,'categories':['iron'],'approximate':True,'description':'Published production start and stop dates in the GEM iron ore mine factsheet. Intermediate suspensions are not comprehensively documented.'})
        annual={}
        for observation in fact['production']:
            y=year(observation['year']);v=number(observation['value'])
            if y is None or v is None or v<=0 or any(p['fromYear']<=y<=p['toYear'] for p in periods):
                continue
            if end is not None and y>end:
                continue
            annual[y]={'categories':{'iron'},'urls':{cited}}
        periods.extend(merge_annual(annual,cited,'Positive iron ore extraction reported for each included year in the GEM factsheet.'))
        if not periods:
            continue
        site={'id':f'gem-giomt:{row["project-id"]}','name':row['name'],'coordinates':coords,'categories':['iron'],'country':row['country-area1'],'sourceId':'gem-giomt-2026','sourceUrl':row['url'],'sourceYear':2026,'coordinateSourceUrl':GIOMT_URL,'accuracy':row.get('location-accuracy') if row.get('location-accuracy') in ['exact','approximate'] else 'unknown','periods':sorted(periods,key=lambda p:p['fromYear'])}
        sites.append(site);audit.append({'id':site['id'],**fact})
    return sites,audit

def normalized(name):
    name=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()
    name=re.sub(r'\b(mine|mines|mining|iron|ore|gold|copper|nickel|complex|operation|operations|project|pit)\b',' ',name)
    return re.sub(r'[^a-z0-9]','',name)

def distance(a,b):
    a,b=[math.radians(x) for x in a],[math.radians(x) for x in b]
    return 6371*2*math.asin(min(1,math.sqrt(math.sin((b[1]-a[1])/2)**2+math.cos(a[1])*math.cos(b[1])*math.sin((b[0]-a[0])/2)**2)))

def verify_inputs():
    manifest=json.loads((SOURCES/'modern-minerals-manifest.json').read_text())
    for entry in manifest['files']:
        digest=hashlib.sha256((SOURCES/entry['file']).read_bytes()).hexdigest()
        if digest!=entry['extractSha256']:
            raise ValueError(f'Source checksum mismatch: {entry["file"]}')

def validate_output(output):
    sites=output['sites'];ids={site['id'] for site in sites}
    if len(ids)!=len(sites):raise ValueError('Duplicate site identifiers')
    source_years={source['id']:source['year'] for source in output['sources']}
    for site in sites:
        if position(*site['coordinates']) is None:raise ValueError(f'Invalid coordinate: {site["id"]}')
        if source_years.get(site['sourceId'])!=site['sourceYear']:raise ValueError('Invalid source reference')
        if not site['periods']:raise ValueError('Missing exploitation period')
        for period in site['periods']:
            if period['fromYear']>period['toYear'] or period['toYear']>site['sourceYear']:raise ValueError('Invalid temporal bounds')
            if not set(period['categories'])<=set(site['categories']):raise ValueError('Invalid period categories')
    by_id={site['id']:site for site in sites}
    def present(identifier,y):return any(p['fromYear']<=y<=p['toYear'] for p in by_id[identifier]['periods'])
    for identifier,missing in [('gem-giomt:P100000128196',2016),('gem-giomt:P100000128201',2016),('gem-giomt:P100000128152',1990),('mincan:210',2021),('mincan:104',1960),('mincan:104',1985),('mincan:104',2007),('mincan:150',1965),('mincan:150',1980),('mincan:150',2018),('mincan:180',1980),('mincan:195',2005),('mincan:225',1932),('mincan:225',1945),('mincan:225',1980)]:
        if present(identifier,missing):raise ValueError(f'Known shutdown bridged: {identifier}')
    for identifier,observed in [('fineprint:COM00397.00',2018),('fineprint:COM00496.00',2019),('fineprint:COM00949.00',2014)]:
        if identifier not in ids or not present(identifier,observed):raise ValueError(f'Documented mine production omitted: {identifier}')
        if present(identifier,2021):raise ValueError(f'Production extended past the mineral observations: {identifier}')
    for identifier,missing in [('fineprint:COM00496.00',1967),('fineprint:COM00099.00',2002),('fineprint:COM00392.00',2013),('fineprint:COM00629.00',2004),('fineprint:COM01069.00',2003),('fineprint:COM00227.00',2012),('fineprint:COM00227.00',2015),('fineprint:COM00227.00',2016)]:
        if present(identifier,missing):raise ValueError(f'Contract date or stockpile processing treated as extraction: {identifier}')
    if ids & {'mincan:458','mincan:427','mincan:335','mincan:728','mincan:791'}:raise ValueError('Reviewed duplicate Canadian mine reintroduced')
    if distance(by_id['gem-giomt:P100000128188']['coordinates'],by_id['gem-giomt:P100000128152']['coordinates'])<40:raise ValueError('Mont-Wright and Fire Lake positions were conflated')
    if len(sites)<1500 or len({site['country'] for site in sites})<70:raise ValueError('Unexpected global coverage loss')
    if any(site['country']=='Canada' for site in sites if site['sourceId']=='fineprint-2023'):raise ValueError('Canadian FINEPRINT duplicate source reintroduced')

def main():
    check_fineprint_evidence_rules()
    verify_inputs()
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    canadian,ca_audit=mincan_sites();global_sites,global_audit=fineprint_sites();iron,iron_audit=giomt_sites()
    # Preserve documented global commodity observations when a newer iron inventory also
    # describes the same mine. Matching requires name identity and coherent geography.
    merged=[];replacements=[]
    by_name=collections.defaultdict(list)
    for site in global_sites+canadian:by_name[(site['country'],normalized(site['name']))].append(site)
    for site in iron:
        candidates=[s for s in by_name.get((site['country'],normalized(site['name'])),[]) if distance(s['coordinates'],site['coordinates'])<=25]
        if len(candidates)==1:
            target=candidates[0];target['periods'].extend(site['periods']);target['sourceYear']=2026
            target['sourceId']='combined-mineral-evidence-2026'
            target['categories']=sorted(set(target['categories']+site['categories']))
            replacements.append({'combinedId':target['id'],'additionalId':site['id'],'distanceKm':round(distance(target['coordinates'],site['coordinates']),3)})
        else:merged.append(site)
    sources=[
        {'id':'mincan-2024','name':'Clara Dallaire-Fortier — MinCan, March 2024','url':MINCAN_URL,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','year':2024,'description':'947 Canadian principal mine records with production phases and coordinates. This adaptation selects supported non-fossil primary commodities, preserves reopening/suspension phases, bounds open mines to 2022 and excludes explicitly museum-based coordinates. Co-products without dated extraction evidence are not projected across a mine’s lifetime.'},
        {'id':'fineprint-2023','name':'Jasansky, Lieber, Giljum & Maus — Global coal and metal mine production, version 1.0.3','url':GLOBAL_URL,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','year':2023,'description':'Published global mine evidence linked to company reports; non-fossil production observations in this release end in 2020. This adaptation selects mines with published coordinates and uses production-start/end bounds plus positive ore or commodity output at those mining facilities. The source may estimate production from processing/sales proxies; marked quantity estimates are identified, and known stockpile-only years and shutdowns remain excluded. Canadian mines use MinCan; global iron mines use GIOMT; West African gold is reviewed separately.'},
        {'id':'gem-giomt-2026','name':'Global Energy Monitor — Global Iron Ore Mines Tracker, September 2026','url':GIOMT_URL,'license':'Tracker data: CC BY 4.0; factual dates from separately cited GEM wiki revisions (original wiki text: CC BY-NC-SA 4.0)','licenseUrl':'https://globalenergymonitor.org/creative-commons-license','year':2026,'description':'September 2026 public map, enriched with factual production start/stop dates and observations from individually versioned factsheets. No wiki prose is redistributed. Lifetime intervals are approximate and may contain undocumented shutdowns; no planned/future start or closure is used.'},
        {'id':'combined-mineral-evidence-2026','name':'Reconciled MinCan/FINEPRINT and GEM iron ore mine evidence','url':GLOBAL_URL,'license':'See individual cited period sources: MinCan/FINEPRINT and GEM tracker CC BY 4.0; original GEM wiki text CC BY-NC-SA 4.0','year':2026,'description':'Same mine identified by matching normalized name, country and geography within 25 km; individual periods preserve their original evidence URLs. Reconciliation audit lists both source identifiers.'},
    ]
    sites=sorted(canadian+global_sites+merged,key=lambda s:s['id'])
    corrections=json.loads((ROOT/'modern-minerals-corrections.json').read_text())
    for correction in corrections:
        target=next((site for site in sites if site['id']==correction['id']),None)
        if target is None:raise ValueError(f'Correction target missing: {correction["id"]}')
        if 'coordinates' in correction:
            target['coordinates']=correction['coordinates']
            target['coordinateSourceUrl']=correction['coordinateSourceUrl']
        if 'periods' in correction:target['periods']=correction['periods']
        excluded=set(correction.get('removeSiteIds',[]))
        sites=[site for site in sites if site['id'] not in excluded]
        replacements.append(correction)
    used={s['sourceId'] for s in sites};sources=[s for s in sources if s['id'] in used]
    output={'sources':sources,'sites':sites,'audit':{'mincan':ca_audit,'fineprint':global_audit,'giomt':iron_audit,'reconciliations':replacements,'rules':{'coordinates':'Published mine coordinates only; invalid and explicit museum positions excluded. Multipoint complexes use a published actual point, never a country/municipality centroid.','temporal':'Finite production-phase bounds or dated extraction observations; no discovery/construction dates or inferred future operation. Approximate lifetime periods are explicitly labelled.','exclusions':'Undated deposits, non-mining industrial facilities, unsupported commodities, Canadian FINEPRINT duplicates, West African gold under separate review.'}}}
    validate_output(output)
    content=json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n'
    destination=ROOT/'modern-minerals.json'
    if args.check:
        if destination.read_text()!=content:raise SystemExit('modern-minerals.json differs from deterministic offline build')
    else:destination.write_text(content)
    print('sites',len(sites),'countries',len({s['country'] for s in sites}),'periods',sum(len(s['periods']) for s in sites),'sources',collections.Counter(s['sourceId'] for s in sites))
    print('categories',dict(collections.Counter(c for s in sites for c in s['categories'])))
    print('2026',sum(any(p['fromYear']<=2026<=p['toYear'] for p in s['periods']) for s in sites),'reconciled',len(replacements))

if __name__=='__main__':main()
