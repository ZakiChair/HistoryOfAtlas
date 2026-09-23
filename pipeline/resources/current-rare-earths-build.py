#!/usr/bin/env python3
"""Rebuild dated rare-earth mining observations from frozen public evidence."""

import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "sources/current-rare-earths-stimson.json.gz"
CURATED = ROOT / "current-rare-earths-curated.json"
OUTPUT = ROOT / "current-rare-earths.json"
YEAR = 2026
DASHBOARD = "https://www.stimson.org/2025/mining-in-mainland-southeast-asia-river-basins-dashboard/"
METHODS = "https://www.stimson.org/2025/unregulated-mining-along-rivers-in-mainland-southeast-asia/"
FEATURES = "https://gis.stimson.org/server/rest/services/Hosted/Mines/FeatureServer/0"
SOURCE = {
    "id": "stimson-rare-earths-2026",
    "name": "Stimson Center — satellite-observed rare-earth mining in Southeast Asia",
    "url": DASHBOARD,
    "license": "Public factual mine observations; Stimson requests attribution. Underlying Planet Labs imagery is not redistributed.",
    "year": YEAR,
    "description": "Satellite interpretation by Stimson Center and credited partners. Only the identified initial mining year is retained, with approximate annual precision. This inventory includes inactive sites; neither newer imagery nor a metadata update proves ongoing extraction. Unbounded '2015 or Older' dates are excluded.",
}


def normalize_stimson(rows):
    sites, audit, seen = [], [], set()
    for row in rows:
        year_text = str(row.get("year", ""))
        latitude, longitude = row.get("latitude"), row.get("longitude")
        identifier = str(row.get("globalid") or row.get("objectid")).strip("{}").lower()
        site_id = f"stimson-ree:{identifier}"
        updated = row.get("last_updated")
        entry = {
            "siteId": site_id, "objectId": row.get("objectid"),
            "identifiedMiningYear": year_text, "imageYear": row.get("imgyear"),
            "lastUpdated": datetime.fromtimestamp(updated / 1000, timezone.utc).date().isoformat() if isinstance(updated, (int, float)) else updated,
            "sourceCredits": row.get("source"), "sourceStatus": row.get("status"),
        }
        reason = None
        if row.get("metal") != "Rare Earth" or row.get("method") != "In-situ Leaching":
            reason = "Not a specifically identified rare-earth in-situ leaching site."
        elif not year_text.isdigit() or not 2016 <= int(year_text) <= YEAR:
            reason = "No finite identified mining year within the documented 2016–2026 observation period."
        elif not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (latitude, longitude)) or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            reason = "Invalid published coordinates."
        elif site_id in seen:
            reason = "Duplicate source identity."
        if reason:
            entry["excludedReason"] = reason
            audit.append(entry)
            continue
        seen.add(site_id)
        year = int(year_text)
        url = f"{FEATURES}/{row['objectid']}"
        locality = row.get("subbasin") or row.get("adm1") or row.get("country")
        name = row.get("name") or f"{locality} — rare-earth leaching site {row['objectid']}"
        sites.append({
            "id": site_id, "name": name, "coordinates": [longitude, latitude],
            "categories": ["rare-earths"], "country": row.get("country"),
            "sourceId": SOURCE["id"], "sourceUrl": DASHBOARD, "sourceYear": YEAR,
            "coordinateSourceUrl": url, "accuracy": "approximate",
            "periods": [{
                "fromYear": year, "toYear": year, "categories": ["rare-earths"],
                "sourceUrl": url, "approximate": True,
                "description": f"Stimson identifies rare-earth in-situ leaching activity beginning in {year} from satellite imagery. This is an approximate mining-footprint observation, not a measured production quantity or proof of continuous operation. Later image and metadata dates do not extend this observation.",
            }],
        })
        entry["retainedYears"] = [year]
        entry["reason"] = "Source year identifies initial mining activity; no inferred continuity or current status."
        audit.append(entry)
    return sites, audit


def build():
    with gzip.open(RAW, "rt", encoding="utf-8") as stream:
        raw = json.load(stream)
    curated = json.loads(CURATED.read_text())
    satellite_sites, satellite_audit = normalize_stimson(raw["rows"])
    sites = curated["sites"] + satellite_sites
    assert len({site["id"] for site in sites}) == len(sites), "Duplicate resource identity"
    return {
        "sources": curated["sources"] + [SOURCE], "sites": sites,
        "audit": {
            "reviewedAt": "2026-09-23", "rawSha256": hashlib.sha256(RAW.read_bytes()).hexdigest(),
            "methodologyUrl": METHODS, "curated": curated.get("audit", {}),
            "satelliteRows": satellite_audit,
            "counts": {
                "sites": len(sites), "satelliteSites": len(satellite_sites),
                "countries": dict(sorted(Counter(s["country"] for s in sites).items())),
                "observed2026": sum(any(p["fromYear"] <= YEAR <= p["toYear"] for p in s["periods"]) for s in sites),
            },
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare frozen inputs with the checked-in contribution without writing")
    args = parser.parse_args()
    result = build()
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if OUTPUT.read_text() != encoded:
            raise SystemExit("Rare-earth contribution is stale; rerun current-rare-earths-build.py")
    else:
        OUTPUT.write_text(encoded)
    print(json.dumps(result["audit"]["counts"]))


if __name__ == "__main__":
    main()
