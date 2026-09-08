const DATA_URL = "data/models.json";
const BATCH_SIZE = 48;
const NO_CATEGORY = "__none__";

let allModels = [];
let filteredModels = [];
let renderedCount = 0;
let activeCategory = "all";
let recentOnly = false;
let searchTerm = "";

const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const categoryChips = document.getElementById("categoryChips");
const recentCheckbox = document.getElementById("featuredOnly");
const visibleCount = document.getElementById("visibleCount");
const sentinel = document.getElementById("sentinel");
const toast = document.getElementById("toast");

init();

async function init() {
    try {
        const res = await fetch(DATA_URL);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const raw = await res.json();

        allModels = raw.filter((model) => {
            if (!model || !model.id || String(model.id).trim() === "") {
                console.warn("Model without ID:", model);
                return false;
            }

            return true;
        });

        buildCategoryChips();
        applyFilters();

        searchInput.addEventListener("input", (event) => {
            searchTerm = event.target.value.trim().toLowerCase();
            applyFilters();
        });

        searchButton?.addEventListener("click", applyFilters);

        recentCheckbox.addEventListener("change", (event) => {
            recentOnly = event.target.checked;
            applyFilters();
        });

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    renderNextBatch();
                }
            },
            {
                rootMargin: "300px"
            }
        );

        observer.observe(sentinel);
    } catch (error) {
        console.error("Failed to load models.json:", error);

        grid.innerHTML = `
            <p class="empty-state col-span-full text-center py-12">
                Couldn't load data/models.json.
            </p>
        `;
    }
}

function buildCategoryChips() {
    const counts = new Map();

    allModels.forEach((model) => {
        const category = model.category || NO_CATEGORY;
        counts.set(category, (counts.get(category) || 0) + 1);
    });

    const categories = [...counts.keys()]
        .filter((category) => category !== NO_CATEGORY)
        .sort((a, b) => a.localeCompare(b));

    if (counts.has(NO_CATEGORY)) {
        categories.push(NO_CATEGORY);
    }

    const allChip = makeChip(
        "all",
        "All Models",
        allModels.length
    );

    allChip.classList.add("active");
    categoryChips.appendChild(allChip);

    categories.forEach((category) => {
        categoryChips.appendChild(
            makeChip(
                category,
                category === NO_CATEGORY
                    ? "Uncategorized"
                    : category,
                counts.get(category)
            )
        );
    });
}

function makeChip(value, label, count) {
    const chip = document.createElement("button");

    chip.className = "chip";
    chip.type = "button";
    chip.dataset.value = value;

    chip.innerHTML = `
        <span>${escapeHtml(label)}</span>
        <span class="count">${count}</span>
    `;

    chip.addEventListener("click", () => {
        activeCategory = value;

        [...categoryChips.children].forEach((element) => {
            element.classList.remove("active");
        });

        chip.classList.add("active");
        applyFilters();
    });

    return chip;
}

function applyFilters() {
    filteredModels = allModels.filter((model) => {
        if (activeCategory !== "all") {
            const category = model.category || NO_CATEGORY;

            if (category !== activeCategory) {
                return false;
            }
        }

        const isRecent = model.recent ?? model.featured ?? false;

        if (recentOnly && !isRecent) {
            return false;
        }

        if (searchTerm) {
            const text = `
                ${model.id}
                ${model.creator || ""}
                ${model.description || ""}
                ${model.category || ""}
            `.toLowerCase();

            if (!text.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    renderedCount = 0;
    grid.innerHTML = "";

    emptyState.hidden = filteredModels.length !== 0;

    updateVisibleCount();
    updateCategoryTitle();

    renderNextBatch();
}

function updateVisibleCount() {
    if (!visibleCount) {
        return;
    }

    visibleCount.textContent = `${filteredModels.length} models`;
}

function updateCategoryTitle() {
    const title = document.getElementById("currentCategoryTitle");

    if (!title) {
        return;
    }

    if (activeCategory === "all") {
        title.textContent = recentOnly
            ? "Recent Models"
            : "All Models";

        return;
    }

    title.textContent =
        activeCategory === NO_CATEGORY
            ? "Uncategorized"
            : activeCategory;
}

function renderNextBatch() {
    if (renderedCount >= filteredModels.length) {
        return;
    }

    const next = filteredModels.slice(
        renderedCount,
        renderedCount + BATCH_SIZE
    );

    const fragment = document.createDocumentFragment();

    next.forEach((model) => {
        fragment.appendChild(buildModelRow(model));
    });

    grid.appendChild(fragment);

    renderedCount += next.length;
}

function buildModelRow(model) {
    const item = document.createElement("article");

    item.className = "model-row";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute(
        "aria-label",
        `Copy ID ${model.id}`
    );

    const main = document.createElement("div");
    main.className = "model-main";

    const title = document.createElement("div");
    title.className = "model-title";

    const isRecent = model.recent ?? model.featured ?? false;

    if (isRecent) {
        const badge = document.createElement("span");

        badge.className = "badge-recent";
        badge.textContent = "RECENT";
        badge.title = "Recently added model";

        title.appendChild(badge);
    }

    const description = document.createElement("span");

    description.className = "model-description";
    description.textContent =
        model.description || "No Description";

    title.appendChild(description);

    const creator = document.createElement("div");

    creator.className = "model-creator";
    creator.textContent = `by ${
        model.creator && model.creator.trim()
            ? model.creator
            : "Anonymous"
    }`;

    main.appendChild(title);
    main.appendChild(creator);

    const category = document.createElement("div");

    category.className = "model-category";
    category.textContent =
        model.category || "Uncategorized";

    const id = document.createElement("div");

    id.className = "model-id";
    id.textContent = `ID: ${model.id}`;

    item.appendChild(main);
    item.appendChild(category);
    item.appendChild(id);

    const activate = () => {
        copyId(model.id, item);
    };

    item.addEventListener("click", activate);

    item.addEventListener("keydown", (event) => {
        if (
            event.key === "Enter" ||
            event.key === " "
        ) {
            event.preventDefault();
            activate();
        }
    });

    return item;
}

async function copyId(id, item) {
    try {
        await navigator.clipboard.writeText(
            String(id)
        );
    } catch (error) {
        const textarea =
            document.createElement("textarea");

        textarea.value = String(id);
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);

        textarea.select();
        document.execCommand("copy");

        textarea.remove();
    }

    showToast(`Copied ID: ${id}`);

    item.classList.add("copied");

    setTimeout(() => {
        item.classList.remove("copied");
    }, 700);
}

let toastTimer;

function showToast(message) {
    if (!toast) {
        return;
    }

    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 1600);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}