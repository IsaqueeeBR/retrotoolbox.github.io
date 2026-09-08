import csv
import json
import re
from datetime import date
from pathlib import Path

SCRIPT_DIR=Path(__file__).resolve().parent
OUTPUT_PATH=SCRIPT_DIR/"data"/"models.json"

CATEGORY_ALIASES={
    "givers":"Giver",
}

COLUMN_MAP={
    "id":"id",
    "id#":"id",
    "creator":"creator",
    "user":"creator",
    "author":"creator",
    "desc":"description",
    "desc.":"description",
    "description":"description",
    "category":"category",
    "categoria":"category",
    "date":"date",
}

models=[]
warnings=[]
TODAY=date.today().isoformat()

def strip_star(text):
    return text.replace("\u2730","").strip()

def clean_desc(text):
    text=text.strip()
    text=re.sub(r"^[-\u2013\u2014]\s*","",text)
    return strip_star(text).strip()

def sniff_delimiter(sample):
    try:
        return csv.Sniffer().sniff(sample,delimiters=",\t;").delimiter
    except csv.Error:
        return ","

def find_header(rows,max_scan=15):
    for i,row in enumerate(rows[:max_scan]):
        normalized=[c.strip().lower() for c in row]
        if any(cell in ("id","id#") for cell in normalized):
            return i
    return None

def map_columns(header_row):
    mapping={}
    for idx,cell in enumerate(header_row):
        key=cell.strip().lower()
        if key in COLUMN_MAP:
            mapping[COLUMN_MAP[key]]=idx
    return mapping

def get(row,mapping,field):
    idx=mapping.get(field)
    if idx is None or idx>=len(row):
        return ""
    return row[idx].strip()

def load_previous_dates():
    if not OUTPUT_PATH.exists():
        return {}

    try:
        with open(OUTPUT_PATH,"r",encoding="utf-8") as f:
            old_models=json.load(f)
    except (OSError,json.JSONDecodeError):
        warnings.append("Could not read the existing models.json.")
        return {}

    previous_dates={}

    if not isinstance(old_models,list):
        return previous_dates

    for model in old_models:
        if not isinstance(model,dict):
            continue

        model_id=str(model.get("id","")).strip()
        old_date=model.get("dateAdded")

        if model_id and old_date:
            previous_dates[model_id]=old_date

    return previous_dates

def load_file(path,previous_dates):
    raw=path.read_text(encoding="utf-8",errors="replace")
    delimiter=sniff_delimiter(raw[:4000])

    rows=list(csv.reader(raw.splitlines(),delimiter=delimiter))
    header_idx=find_header(rows)

    if header_idx is None:
        warnings.append(
            f"[{path.name}] no ID column found, file ignored"
        )
        return 0

    mapping=map_columns(rows[header_idx])
    count=0

    for row in rows[header_idx+1:]:
        if not any(c.strip() for c in row):
            continue

        model_id=get(row,mapping,"id")

        if not model_id:
            creator=get(row,mapping,"creator")
            desc=get(row,mapping,"description")

            warnings.append(
                f"[{path.name}] row without ID ignored -> "
                f"creator={creator!r} desc={desc!r}"
            )
            continue

        creator_raw=get(row,mapping,"creator")
        creator=re.sub(r"#\d{2,6}$","",creator_raw).strip()

        desc_raw=get(row,mapping,"description")
        category_raw=get(row,mapping,"category")

        category=""

        if category_raw:
            category=CATEGORY_ALIASES.get(
                category_raw.lower(),
                category_raw
            )

        date_added=previous_dates.get(model_id,TODAY)

        models.append({
            "id":model_id,
            "creator":creator if creator else None,
            "description":clean_desc(desc_raw) if desc_raw else None,
            "category":category if category else None,
            "dateAdded":date_added
        })

        count+=1

    return count

def score(mod):
    score_value=0

    if mod.get("category"):
        score_value+=2

    if mod.get("description"):
        score_value+=1

    if mod.get("creator"):
        score_value+=1

    if mod.get("dateAdded"):
        score_value+=1

    return score_value

files=sorted(
    set(SCRIPT_DIR.glob("*.txt")) |
    set(SCRIPT_DIR.glob("*.csv"))
)

if not files:
    print("No .txt or .csv files found in this folder.")
else:
    previous_dates=load_previous_dates()
    per_file_counts={}

    for f in files:
        per_file_counts[f.name]=load_file(
            f,
            previous_dates
        )

    by_id={}
    dupes=0

    for mod in models:
        mid=mod["id"]

        if mid not in by_id:
            by_id[mid]=mod
            continue

        dupes+=1

        if score(mod)>score(by_id[mid]):
            by_id[mid]=mod

    models=list(by_id.values())

    models.sort(
        key=lambda model:(
            model.get("dateAdded") or "",
            str(model.get("id",""))
        ),
        reverse=True
    )

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        OUTPUT_PATH,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            models,
            f,
            ensure_ascii=False,
            indent=2
        )

    preserved=sum(
        1 for m in models
        if m["id"] in previous_dates
    )

    new_models=sum(
        1 for m in models
        if m["id"] not in previous_dates
    )

    print("Files found:")

    for name,n in per_file_counts.items():
        print(f"  - {name}: {n} models")

    print(f"Duplicates removed: {dupes}")
    print(f"Total models: {len(models)}")
    print(f"Existing dates preserved: {preserved}")
    print(f"New models: {new_models}")
    print(f"Date used for new models: {TODAY}")
    print(f"Warnings: {len(warnings)}")

    for warning in warnings[:20]:
        print(" -",warning)