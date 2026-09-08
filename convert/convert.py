import csv, json, re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR / "data" / "models.json"

CATEGORY_ALIASES = {
    "givers": "Giver",
}

COLUMN_MAP = {
    "id": "id", "id#": "id",
    "creator": "creator", "user": "creator", "author": "creator",
    "desc": "description", "desc.": "description", "description": "description",
    "category": "category", "categoria": "category",
    "date": "date",
}

models = []
warnings = []


def strip_star(text):
    return text.replace("\u2730", "").strip()


def clean_desc(text):
    text = text.strip()
    text = re.sub(r"^[-\u2013\u2014]\s*", "", text)
    return strip_star(text).strip()


def sniff_delimiter(sample):
    try:
        return csv.Sniffer().sniff(sample, delimiters=",\t;").delimiter
    except csv.Error:
        return ","


def find_header(rows, max_scan=15):
    for i, row in enumerate(rows[:max_scan]):
        normalized = [c.strip().lower() for c in row]
        if any(cell in ("id", "id#") for cell in normalized):
            return i
    return None


def map_columns(header_row):
    mapping = {}
    for idx, cell in enumerate(header_row):
        key = cell.strip().lower()
        if key in COLUMN_MAP:
            mapping[COLUMN_MAP[key]] = idx
    return mapping


def get(row, mapping, field):
    idx = mapping.get(field)
    if idx is None or idx >= len(row):
        return ""
    return row[idx].strip()


def load_file(path):
    raw=path.read_text(encoding="utf-8",errors="replace")
    delimiter=sniff_delimiter(raw[:4000])
    rows=list(csv.reader(raw.splitlines(),delimiter=delimiter))

    header_idx=find_header(rows)

    if header_idx is None:
        warnings.append(f"[{path.name}] nenhuma coluna de ID encontrada, arquivo ignorado")
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
                f"[{path.name}] linha sem ID ignorada -> creator={creator!r} desc={desc!r}"
            )
            continue

        creator_raw=get(row,mapping,"creator")
        creator=re.sub(r"#\d{2,6}$","",creator_raw).strip()

        desc_raw=get(row,mapping,"description")
        category_raw=get(row,mapping,"category")

        category=(
            CATEGORY_ALIASES.get(category_raw.lower(),category_raw)
            if category_raw else ""
        )

        models.append({
            "id":model_id,
            "creator":creator if creator else None,
            "description":clean_desc(desc_raw) if desc_raw else None,
            "category":category if category else None,
            "recent":"\u2730" in desc_raw,
            "date":get(row,mapping,"date") or None,
        })

        count+=1

    return count

def score(mod):
    s=0

    if mod["category"]:
        s+=2

    if mod["description"]:
        s+=1

    if mod["creator"]:
        s+=1

    if mod["recent"]:
        s+=1

    return s

files = sorted(set(SCRIPT_DIR.glob("*.txt")) | set(SCRIPT_DIR.glob("*.csv")))

if not files:
    print("Nenhum arquivo .txt ou .csv encontrado nesta pasta.")
else:
    per_file_counts = {}
    for f in files:
        per_file_counts[f.name] = load_file(f)

    by_id = {}
    dupes = 0
    for mod in models:
        mid = mod["id"]
        if mid not in by_id:
            by_id[mid] = mod
            continue
        dupes += 1
        if score(mod) > score(by_id[mid]):
            by_id[mid] = mod

    models = list(by_id.values())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(models, f, ensure_ascii=False, indent=2)

    print("Arquivos encontrados:")
    for name, n in per_file_counts.items():
        print(f"  - {name}: {n} modelos")
    print(f"Duplicados removidos: {dupes}")
    print(f"Total (sem duplicados): {len(models)} modelos")
    print(f"Avisos (linhas sem ID ignoradas): {len(warnings)}")
    for w in warnings[:20]:
        print(" -", w)
