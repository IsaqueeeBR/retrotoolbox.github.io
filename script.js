const DATA_URL = "data/models.json";
const BATCH_SIZE = 48;
const NO_CATEGORY = "__none__";

let allModels = [];
let filteredModels = [];
let renderedCount = 0;
let activeCategory = "all";
let featuredOnly = false;
let searchTerm = "";

const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const categoryChips = document.getElementById("categoryChips");
const featuredCheckbox = document.getElementById("featuredOnly");
const sentinel = document.getElementById("sentinel");
const toast = document.getElementById("toast");

init();

async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json();

    allModels = raw.filter((m) => {
      if (!m || !m.id || String(m.id).trim() === "") {
        console.warn("Model without ID:", m);
        return false;
      }
      return true;
    });

    buildCategoryChips();
    applyFilters();

    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      applyFilters();
    });

    searchButton?.addEventListener("click", applyFilters);

    featuredCheckbox.addEventListener("change", (e) => {
      featuredOnly = e.target.checked;
      applyFilters();
    });

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) renderNextBatch();
    }, { rootMargin: "300px" });

    observer.observe(sentinel);
  } catch (err) {
    console.error("Failed to load models.json:", err);
    grid.innerHTML = `
      <p class="empty-state col-span-full text-center py-12">
        Couldn't load data/models.json.
      </p>
    `;
  }
}

function buildCategoryChips() {
  const counts = new Map();

  allModels.forEach((m) => {
    const key = m.category || NO_CATEGORY;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const categories = [...counts.keys()]
    .filter((c) => c !== NO_CATEGORY)
    .sort((a, b) => a.localeCompare(b));

  if (counts.has(NO_CATEGORY)) categories.push(NO_CATEGORY);

  const allChip = makeChip("all", "All Items", allModels.length);
  allChip.classList.add("active");
  categoryChips.appendChild(allChip);

  categories.forEach((cat) => {
    categoryChips.appendChild(
      makeChip(
        cat,
        cat === NO_CATEGORY ? "Uncategorized" : cat,
        counts.get(cat)
      )
    );
  });
}

function makeChip(value, label, count) {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.type = "button";
  chip.dataset.value = value;
  chip.innerHTML = `<span>${escapeHtml(label)}</span><span class="count">${count}</span>`;

  chip.addEventListener("click", () => {
    activeCategory = value;

    [...categoryChips.children].forEach((c) =>
      c.classList.remove("active")
    );

    chip.classList.add("active");
    applyFilters();
  });

  return chip;
}

function applyFilters() {
  filteredModels = allModels.filter((m) => {
    if (activeCategory !== "all") {
      const category = m.category || NO_CATEGORY;
      if (category !== activeCategory) return false;
    }

    if (featuredOnly && !m.featured) return false;

    if (searchTerm) {
      const text = `${m.id} ${m.creator || ""} ${m.description || ""} ${m.category || ""}`.toLowerCase();
      if (!text.includes(searchTerm)) return false;
    }

    return true;
  });

  renderedCount = 0;
  grid.innerHTML = "";
  emptyState.hidden = filteredModels.length !== 0;
  renderNextBatch();
}

function renderNextBatch() {
  const next = filteredModels.slice(
    renderedCount,
    renderedCount + BATCH_SIZE
  );

  const frag = document.createDocumentFragment();

  next.forEach((m) => frag.appendChild(buildCard(m)));

  grid.appendChild(frag);
  renderedCount += next.length;
}

function buildCard(model) {
  const item = document.createElement("article");
  item.className = "model-row";
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `Copy ID ${model.id}`);

  const main = document.createElement("div");
  main.className = "model-main";

  const title = document.createElement("div");
  title.className = "model-title";

  if (model.recent) {
    const badge = document.createElement("span");
    badge.className = "badge-recent";
    badge.textContent = "RECENT";
    title.appendChild(badge);
  }

  const desc = document.createElement("span");
  desc.className = "model-description";
  desc.textContent = model.description || "No Description";

  title.appendChild(desc);

  const creator = document.createElement("div");
  creator.className = "model-creator";
  creator.textContent = `by ${
    model.creator && model.creator.trim()
      ? model.creator
      : "Anonymous"
  }`;

  main.appendChild(title);
  main.appendChild(creator);

  const info = document.createElement("div");
  info.className = "model-info";

  const category = document.createElement("span");
  category.className = "model-category";
  category.textContent = model.category || "Uncategorized";

  const id = document.createElement("span");
  id.className = "model-id";
  id.textContent = `ID: ${model.id}`;

  info.appendChild(category);
  info.appendChild(id);

  item.appendChild(main);
  item.appendChild(info);

  const activate = () => copyId(model.id, item);

  item.addEventListener("click", activate);

  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });

  return item;
}

async function copyId(id, card) {
  try {
    await navigator.clipboard.writeText(String(id));
  } catch (err) {
    const tmp = document.createElement("textarea");
    tmp.value = String(id);
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    document.body.removeChild(tmp);
  }

  showToast(`Copied ID: ${id}`);
  card.classList.add("copied");
  setTimeout(() => card.classList.remove("copied"), 700);
}

let toastTimer;

function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add("show");
  toastTimer = setTimeout(
    () => toast.classList.remove("show"),
    1600
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}