#!/usr/bin/env python3
"""Resolve BOEM fields to official named/discovery-block representative positions.
Only stdlib; read local official history/Appendix A/blocks DBF, cache ArcGIS WGS84
polygons, compute polygon area centroid. Coordinates are NOT field boundaries.
"""
import argparse,concurrent.futures,csv,gzip,hashlib,io,json,pathlib,re,struct,urllib.parse,urllib.request,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
BASE=pathlib.Path('/tmp'); CACHE=BASE/'hoa-boem-geometry'
API='https://gis.boem.gov/arcgis/rest/services/BOEM_BSEE/GOA_Layers/MapServer/6/query'
DBF_URL='https://www.data.boem.gov/Mapping/Files/blocks.zip'
APP_URL='https://www.data.boem.gov/FieldReserves/Files/appendadelimit.zip'

def normalize_block(s):
 s=''.join(s.split())
 m=re.fullmatch(r'([A-Z]?)(\d+)',s)
 return m[1]+str(int(m[2])) if m else s

def read_dbf():
 b=zipfile.ZipFile(BASE/'hoa-boem-blocks.zip').read('blocks/blocks.dbf')
 n=struct.unpack_from('<I',b,4)[0];h=struct.unpack_from('<H',b,8)[0];r=struct.unpack_from('<H',b,10)[0]
 fs=[]
 for i in range(32,h-1,32):
  f=b[i:i+32]
  if f[0]==13:break
  fs.append((f[:11].split(b'\0')[0].decode(),f[16]))
 rows=[]
 for i in range(n):
  pos=h+i*r
  if b[pos:pos+1]==b'*':continue
  row={};st=pos+1
  for name,l in fs:row[name]=b[st:st+l].decode().strip();st+=l
  rows.append(row)
 return rows

def remote_block(s):
 m=re.fullmatch(r'([A-Z]?)(\d+)',s)
 return (m[1]+' '+m[2].rjust(3)) if m[1] else m[2].rjust(5)

def fetch(item):
 prot,blocks=item
 where="PROT_NUMBER='"+prot+"' AND BLOCK_NUMBER IN ("+','.join("'"+remote_block(b)+"'" for b in sorted(blocks))+')'
 params={'f':'json','where':where,'outFields':'PROT_NUMBER,BLOCK_NUMBER','returnGeometry':'true','outSR':'4326','resultRecordCount':'10000'}
 url=API+'?'+urllib.parse.urlencode(params)
 p=CACHE/(prot+'.json')
 if not p.exists():
  with urllib.request.urlopen(url,timeout=60) as response:raw=response.read()
  p.write_bytes(raw)
 else:raw=p.read_bytes()
 x=json.loads(raw)
 if 'error' in x:raise RuntimeError((prot,x['error']))
 if x.get('exceededTransferLimit'):raise RuntimeError('Transfer truncated: '+prot)
 return prot,x,{'url':url,'path':str(p),'sha256':hashlib.sha256(raw).hexdigest(),'features':len(x.get('features',[]))}

def centroid(rings):
 a=cx=cy=0.0
 # Translate before shoelace arithmetic to avoid cancellation at longitudes ~-90.
 ox,oy=rings[0][0]
 for ring in rings:
  for p,q in zip(ring,ring[1:]+ring[:1]):
   x,y=p[0]-ox,p[1]-oy;u,v=q[0]-ox,q[1]-oy
   cross=x*v-u*y;a+=cross;cx+=(x+u)*cross;cy+=(y+v)*cross
 if abs(a)<1e-14:raise ValueError('Degenerate block polygon')
 return [round(ox+cx/(3*a),7),round(oy+cy/(3*a),7)]

def main():
 global BASE,CACHE
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source-dir',type=pathlib.Path,default=BASE)
 args=parser.parse_args();BASE=args.source_dir;BASE.mkdir(parents=True,exist_ok=True)
 CACHE=BASE/'hoa-boem-geometry';CACHE.mkdir(exist_ok=True)
 manifest_path=ROOT/'sources/boem-position-manifest.json'
 manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else None
 for filename,url in [('hoa-boem-blocks.zip',DBF_URL),('hoa-boem-appendadelimit.zip',APP_URL)]:
  path=BASE/filename
  if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=120).read())
  if manifest and hashlib.sha256(path.read_bytes()).hexdigest()!=manifest['inputSha256'][filename]:
   raise ValueError('Live BOEM source differs from reviewed snapshot: '+filename)
 # The committed compact source fixes the 2023 report's set of field IDs.
 history=json.loads(gzip.decompress((ROOT/'sources/boem-fields.json.gz').read_bytes()))
 fields=sorted({x['field'] for x in history})
 app=list(csv.reader(io.StringIO(zipfile.ZipFile(BASE/'hoa-boem-appendadelimit.zip').read('appendadelimit.txt').decode())))
 memberships={(r[2].strip(),r[0].strip(),normalize_block(r[1])) for r in app}
 index={}
 for row in read_dbf():
  key=(row['AREA_CODE'],normalize_block(row['BLOCK_NUMB']))
  index.setdefault(key,[]).append(row)
 wanted={};candidates=[];exclusions=[]
 for field in fields:
  m=re.fullmatch(r'([A-Z]{2,3})(\d{3,4})([A-Z]?)',field)
  if not m:exclusions.append({'field':field,'reason':'field-code-format'});continue
  area,number,suffix=m.groups();block=suffix+str(int(number))
  if (field,area,block) not in memberships:
   exclusions.append({'field':field,'area':area,'block':block,'reason':'named-block-not-assigned-to-field-in-current-Appendix-A'});continue
  matches=index.get((area,block),[])
  if len(matches)!=1:
   exclusions.append({'field':field,'area':area,'block':block,'reason':'DBF-block-match-count','count':len(matches)});continue
  prot=matches[0]['PROT_NUMBE'];wanted.setdefault(prot,set()).add(block)
  candidates.append({'field':field,'area':area,'block':block,'protNumber':prot})
 print('Candidates',len(candidates),'excluded',len(exclusions),'queries',len(wanted),flush=True)
 geometries={};requests=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for prot,response,record in pool.map(fetch,sorted(wanted.items())):
   if manifest:
    expected=next((r for r in manifest['requests'] if r['url']==record['url']),None)
    if not expected or expected['sha256']!=record['sha256']:raise ValueError('BOEM geometry differs from reviewed snapshot: '+prot)
   requests.append(record)
   for feat in response['features']:
    attr=feat['attributes'];key=(attr['PROT_NUMBER'].strip(),normalize_block(attr['BLOCK_NUMBER']))
    geometries.setdefault(key,[]).append(feat['geometry']['rings'])
 output=[]
 for row in candidates:
  rings=geometries.get((row['protNumber'],row['block']),[])
  if len(rings)!=1:exclusions.append({**row,'reason':'REST-block-match-count','count':len(rings)});continue
  row['coordinates']=centroid(rings[0]);row['coordinateSourceUrl']=API+'?'+urllib.parse.urlencode({'f':'json','where':"PROT_NUMBER='"+row['protNumber']+"' AND BLOCK_NUMBER='"+remote_block(row['block'])+"'",'outFields':'PROT_NUMBER,BLOCK_NUMBER','returnGeometry':'true','outSR':'4326'})
  output.append(row)
 hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [BASE/'hoa-boem-appendadelimit.zip',BASE/'hoa-boem-blocks.zip']}
 audit={'fieldCount':len(fields),'positionCount':len(output),'exclusions':exclusions,'method':'Field code is parsed into BOEM area and named/discovery block. That same block must be assigned to the same field in official Appendix A. Official BOEM blocks.zip DBF joins AREA_CODE+BLOCK_NUMB to PROT_NUMBE. ArcGIS returns only requested block polygons transformed to EPSG:4326. A planar polygon-area centroid represents the named block approximately, not a reservoir boundary or discovery-well point. Prefix A is preserved (HI563A -> HI / A563). No fallback to basin/city/area centroid.','coordinateAccuracy':'approximate: representative centroid of an OCS block, usually about 3 by 3 miles','fieldNamingSourceUrl':'https://www.boem.gov/oil-gas-energy/resource-evaluation/ocs-operations-field-directory','blocksSourceUrl':DBF_URL,'inputSha256':hashes,'fieldIdsSha256':hashlib.sha256(json.dumps(fields,separators=(',',':')).encode()).hexdigest(),'requests':[{k:v for k,v in r.items() if k!='path'} for r in requests]}
 (BASE/'hoa-boem-field-positions.json').write_text(json.dumps(output,indent=2)+'\n')
 (BASE/'hoa-boem-field-positions-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
 print('Positions',len(output),'exclusions',len(exclusions),flush=True);print(json.dumps(exclusions,indent=2),flush=True)
if __name__=='__main__':main()
