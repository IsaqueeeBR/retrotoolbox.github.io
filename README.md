# Retro Toolbox

A small static website for browsing old free models from RetroStudio (Roblox).

Retro Toolbox collects model IDs from old lists shared through Retro Dev and the **Free Models Masterlist**, making it easier to search for a model and copy its ID.

There is no backend, database, or marketplace involved. Everything runs directly in the browser.

## Files

```text
index.html          Main page
style.css           Site styling
script.js           Search, filters, pagination, and copy functions
data/models.json    Model data used by the site
convert.py          Converts the original CSV files into models.json
```

## Running the site

No build process is required.

You can open the files locally or host the project using GitHub Pages.

### GitHub Pages

1. Create a repository and upload the project files.
2. Go to **Settings → Pages**.
3. Select the `main` branch and the root folder (`/`).
4. Save the settings.

The site should then be available at:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
```

## Updating the model list

If you get newer CSV files:

1. Put the CSV files in the same folder as `convert.py`.
2. Change the file paths at the top of `convert.py` if needed.
3. Run:

```bash
python convert.py
```

4. The new data will be written to:

```text
data/models.json
```

Upload the updated JSON to GitHub and the site will use it automatically.

### What `convert.py` does

* Removes entries without a model ID.
* Keeps track of how many invalid entries were skipped.
* Reads categories from the masterlist when available.
* Models without a category are shown as **Uncategorized**.
* Keeps the original `dateAdded` for models that were already in the previous JSON.
* Gives newly added models the current date.
* Removes Discord discriminator tags such as `username#1234`.
* Removes duplicate model IDs.

## Model list

The website supports:

* Searching by ID, creator, description, or category.
* Browsing models by category.
* Filtering recently added models.
* Pagination.
* Clicking a model to copy its ID.
* `Ctrl + Click` to copy the model's full information.

## License

This project is mainly intended as a simple archive/browser for the model lists and their IDs.
