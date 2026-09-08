import csv
import json
import re
from datetime import date
from pathlib import Path

BASE_DIR=Path(__file__).resolve().parent
MASTERLIST_FILE=BASE_DIR/"masterlist.csv"
DISCORD_FILE=BASE_DIR/"discord.csv"
OUTPUT_FILE=BASE_DIR/"data"/"models.json"
TODAY=date.today().isoformat()

def load_previous_dates():
    if not OUTPUT_FILE.exists():
        return {}
    try:
        with OUTPUT_FILE.open("r",encoding="utf-8") as file:
            old_models=json.load(file)
    except (json.JSONDecodeError,OSError):
        print("Warning: Could not read the existing models.json.")
        return {}
    previous_dates={}
    for model in old_models:
        if not isinstance(model,dict):
            continue
        model_id=str(model.get("id","")).strip()
        date_added=str(model.get("dateAdded","")).strip()
        if model_id and date_added:
            previous_dates[model_id]=date_added
    return previous_dates

def clean_text(value):
    return "" if value is None else str(value).strip()

def clean_creator(value):
    return re.sub(r"#\d{4}$","",clean_text(value)).strip()

def normalize_id(value):
    value=clean_text(value)
    if re.fullmatch(r"\d+\.0",value):
        value=value[:-2]
    return value

def find_column(fieldnames,names):
    if not fieldnames:
        return None
    normalized={}
    for field in fieldnames:
        normalized[re.sub(r"[\s_]+","",field.lower())]=field
    for name in names:
        key=re.sub(r"[\s_]+","",name.lower())
        if key in normalized:
            return normalized[key]
    return None

def load_csv(path,previous_dates,source_name):
    models=[]
    skipped=0
    if not path.exists():
        print(f"Warning: {path.name} was not found.")
        return models
    try:
        with path.open("r",encoding="utf-8-sig",newline="") as file:
            reader=csv.DictReader(file)
            if not reader.fieldnames:
                print(f"Warning: {path.name} has no header.")
                return models

            id_column=find_column(reader.fieldnames,["id","model id","asset id","assetid"])
            creator_column=find_column(reader.fieldnames,["creator","author","owner","username","user"])
            description_column=find_column(reader.fieldnames,["description","name","model name","title"])
            category_column=find_column(reader.fieldnames,["category","categories","type"])

            if not id_column:
                print(f"Warning: No ID column found in {path.name}.")
                return models

            for row in reader:
                model_id=normalize_id(row.get(id_column,""))
                if not model_id:
                    skipped+=1
                    continue

                creator=clean_creator(row.get(creator_column,"") if creator_column else "")
                description=clean_text(row.get(description_column,"") if description_column else "")
                category=clean_text(row.get(category_column,"") if category_column else "")
                date_added=previous_dates.get(model_id,TODAY)

                models.append({
                    "id":model_id,
                    "creator":creator,
                    "description":description,
                    "category":category,
                    "dateAdded":date_added
                })

    except UnicodeDecodeError:
        print(f"Error: Could not decode {path.name} as UTF-8.")
    except OSError as error:
        print(f"Error reading {path.name}: {error}")

    print(f"{source_name}: {len(models)} models loaded, {skipped} rows skipped.")
    return models

def main():
    previous_dates=load_previous_dates()
    print(f"Existing dates preserved: {len(previous_dates)}")
    print(f"New models will receive: {TODAY}")

    masterlist_models=load_csv(MASTERLIST_FILE,previous_dates,"Masterlist")
    discord_models=load_csv(DISCORD_FILE,previous_dates,"Discord")
    all_models=masterlist_models+discord_models

    unique_models={}

    for model in all_models:
        model_id=model["id"]

        if model_id not in unique_models:
            unique_models[model_id]=model
        else:
            existing=unique_models[model_id]

            if not existing["creator"] and model["creator"]:
                existing["creator"]=model["creator"]
            if not existing["description"] and model["description"]:
                existing["description"]=model["description"]
            if not existing["category"] and model["category"]:
                existing["category"]=model["category"]

    models=list(unique_models.values())

    models.sort(
        key=lambda model:(model.get("dateAdded",""),model.get("id","")),
        reverse=True
    )

    OUTPUT_FILE.parent.mkdir(parents=True,exist_ok=True)

    with OUTPUT_FILE.open("w",encoding="utf-8") as file:
        json.dump(models,file,ensure_ascii=False,indent=2)

    new_models=sum(1 for model in models if model.get("dateAdded")==TODAY)
    old_models=len(models)-new_models

    print(f"Total models: {len(models)}")
    print(f"Existing models: {old_models}")
    print(f"New models: {new_models}")
    print(f"Output: {OUTPUT_FILE}")
    print("Done!")

if __name__=="__main__":
    main()