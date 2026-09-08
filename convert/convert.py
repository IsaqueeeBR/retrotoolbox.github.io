import csv
import json
import re
from datetime import date
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR / "data" / "models.json"

CATEGORY_ALIASES = {
    "givers": "Giver",
}

COLUMN_MAP = {
    "id": "id",
    "id#": "id",

    "creator": "creator",
    "user": "creator",
    "author": "creator",

    "desc": "description",
    "desc.": "description",
    "description": "description",

    "category": "category",
    "categoria": "category",

    "date": "date",
}


models = []
warnings = []

# Data de hoje.
TODOS_NOVOS_RECEBEM_ESTA_DATA.
TODAY = date.today().isoformat()


def strip_star(text):
    return text.replace("\u2730", "").strip()


def clean_desc(text):
    text = text.strip()

    text = re.sub(
        r"^[-\u2013\u2014]\s*",
        "",
        text
    )

    return strip_star(text).strip()


def sniff_delimiter(sample):
    try:
        return csv.Sniffer().sniff(
            sample,
            delimiters=",\t;"
        ).delimiter

    except csv.Error:
        return ","


def find_header(rows, max_scan=15):
    for i, row in enumerate(rows[:max_scan]):
        normalized = [
            c.strip().lower()
            for c in row
        ]

        if any(
            cell in ("id", "id#")
            for cell in normalized
        ):
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

    if idx is None:
        return ""

    if idx >= len(row):
        return ""

    return row[idx].strip()


def load_previous_dates():
    """
    Lê o models.json antigo para preservar
    a data de modelos que já existem.
    """

    if not OUTPUT_PATH.exists():
        return {}

    try:
        with open(
            OUTPUT_PATH,
            "r",
            encoding="utf-8"
        ) as f:
            old_models = json.load(f)

    except (OSError, json.JSONDecodeError):
        warnings.append(
            "Não foi possível ler o models.json antigo."
        )
        return {}

    previous_dates = {}

    if not isinstance(old_models, list):
        return previous_dates

    for model in old_models:
        if not isinstance(model, dict):
            continue

        model_id = str(
            model.get("id", "")
        ).strip()

        if not model_id:
            continue

        old_date = model.get("dateAdded")

        if old_date:
            previous_dates[model_id] = old_date

    return previous_dates


def load_file(path, previous_dates):
    raw = path.read_text(
        encoding="utf-8",
        errors="replace"
    )

    delimiter = sniff_delimiter(
        raw[:4000]
    )

    rows = list(
        csv.reader(
            raw.splitlines(),
            delimiter=delimiter
        )
    )

    header_idx = find_header(rows)

    if header_idx is None:
        warnings.append(
            f"[{path.name}] nenhuma coluna de ID "
            f"encontrada, arquivo ignorado"
        )

        return 0

    mapping = map_columns(
        rows[header_idx]
    )

    count = 0

    for row in rows[header_idx + 1:]:

        if not any(
            c.strip()
            for c in row
        ):
            continue

        model_id = get(
            row,
            mapping,
            "id"
        )

        if not model_id:
            creator = get(
                row,
                mapping,
                "creator"
            )

            desc = get(
                row,
                mapping,
                "description"
            )

            warnings.append(
                f"[{path.name}] linha sem ID ignorada "
                f"-> creator={creator!r} "
                f"desc={desc!r}"
            )

            continue

        creator_raw = get(
            row,
            mapping,
            "creator"
        )

        creator = re.sub(
            r"#\d{2,6}$",
            "",
            creator_raw
        ).strip()

        desc_raw = get(
            row,
            mapping,
            "description"
        )

        category_raw = get(
            row,
            mapping,
            "category"
        )

        category = ""

        if category_raw:
            category = CATEGORY_ALIASES.get(
                category_raw.lower(),
                category_raw
            )

        # Mantém a data antiga.
        #
        # Se o ID ainda não existir no models.json,
        # ele recebe a data de hoje.
        date_added = previous_dates.get(
            model_id,
            TODAY
        )

        models.append({
            "id": model_id,

            "creator": (
                creator
                if creator
                else None
            ),

            "description": (
                clean_desc(desc_raw)
                if desc_raw
                else None
            ),

            "category": (
                category
                if category
                else None
            ),

            "dateAdded": date_added,
        })

        count += 1

    return count


def score(mod):
    """
    Usado somente para decidir qual registro
    manter quando existem IDs duplicados.
    """

    s = 0

    if mod.get("category"):
        s += 2

    if mod.get("description"):
        s += 1

    if mod.get("creator"):
        s += 1

    if mod.get("dateAdded"):
        s += 1

    return s


# --------------------------------------------------
# CARREGAMENTO
# --------------------------------------------------

files = sorted(
    set(SCRIPT_DIR.glob("*.txt"))
    |
    set(SCRIPT_DIR.glob("*.csv"))
)


if not files:

    print(
        "Nenhum arquivo .txt ou .csv "
        "encontrado nesta pasta."
    )

else:

    # Guarda as datas existentes antes
    # de sobrescrever o models.json.
    previous_dates = load_previous_dates()

    per_file_counts = {}

    for f in files:
        per_file_counts[f.name] = load_file(
            f,
            previous_dates
        )


    # --------------------------------------------------
    # REMOVER DUPLICADOS
    # --------------------------------------------------

    by_id = {}
    dupes = 0

    for mod in models:

        mid = mod["id"]

        if mid not in by_id:
            by_id[mid] = mod
            continue

        dupes += 1

        if score(mod) > score(
            by_id[mid]
        ):
            by_id[mid] = mod


    models = list(
        by_id.values()
    )


    # --------------------------------------------------
    # ORDENAR
    # --------------------------------------------------

    # Mais novos primeiro.
    models.sort(
        key=lambda model: (
            model.get("dateAdded")
            or "",
            str(model.get("id", ""))
        ),
        reverse=True
    )


    # --------------------------------------------------
    # SALVAR
    # --------------------------------------------------

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


    # --------------------------------------------------
    # RELATÓRIO
    # --------------------------------------------------

    print("Arquivos encontrados:")

    for name, n in per_file_counts.items():
        print(
            f"  - {name}: {n} modelos"
        )

    print(
        f"Duplicados removidos: {dupes}"
    )

    print(
        f"Total (sem duplicados): "
        f"{len(models)} modelos"
    )

    print(
        f"Modelos com data preservada: "
        f"{sum(1 for m in models if m['id'] in previous_dates)}"
    )

    print(
        f"Modelos novos: "
        f"{sum(1 for m in models if m['id'] not in previous_dates)}"
    )

    print(
        f"Data usada para novos modelos: "
        f"{TODAY}"
    )

    print(
        f"Avisos (linhas sem ID ignoradas): "
        f"{len(warnings)}"
    )

    for warning in warnings[:20]:
        print(
            " -",
            warning
        )