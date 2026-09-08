const DATA_URL = "data/models.json";
const BATCH_SIZE = 48;
const NO_CATEGORY = "__none__";

let allModels = [];
let filteredModels = [];
let renderedCount = 0;
let activeCategory = "all";
let activeSource = "all";
let featuredOnly = false;
let searchTerm = "";

const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const itemCount = document.getElementById("itemCount");
const searchInput = document.getElementById("searchInput");
const categoryChips = document.getElementById("categoryChips");
const featuredCheckbox = document.getElementById("featuredOnly");
const sourceSelect = document.getElementById("sourceSelect");
const sentinel = document.getElementById("sentinel");
const toast = document.getElementById("toast");

init();

async function init() {
  itemCount.textContent = "loading...";
  let raw;
  try {
    const res = await fetch(DATA_URL);
    raw = await res.json();
  } catch (err) {
    itemCount.textContent = "load error";
    grid.innerHTML = `<p class="empty-state">Couldn't load data/models.json. Make sure the file exists and you're serving the site over http (not opening index.html straight from disk).</p>`;
    console.error("Failed to load models.json:", err);
    return;
  }

  allModels = raw.filter((m) => {
    if (!m.id || String(m.id).trim() === "") {
      console.warn("Model with no ID was hidden from the list:", m);
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

  featuredCheckbox.addEventListener("change", (e) => {
    featuredOnly = e.target.checked;
    applyFilters();
  });

  sourceSelect.addEventListener("change", (e) => {
    activeSource = e.target.value;
    applyFilters();
  });

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) renderNextBatch();
  });
  observer.observe(sentinel);
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
    const label = cat === NO_CATEGORY ? "Uncategorized" : cat;
    categoryChips.appendChild(makeChip(cat, label, counts.get(cat)));
  });
}

function makeChip(value, label, count) {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.dataset.value = value;
  chip.innerHTML = `<span>${label}</span><span class="count">${count}</span>`;
  chip.addEventListener("click", () => {
    activeCategory = value;
    [...categoryChips.children].forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    applyFilters();
  });
  return chip;
}

function applyFilters() {
  filteredModels = allModels.filter((m) => {
    if (activeCategory !== "all") {
      const cat = m.category || NO_CATEGORY;
      if (cat !== activeCategory) return false;
    }
    if (activeSource !== "all" && m.source !== activeSource) return false;
    if (featuredOnly && !m.featured) return false;
    if (searchTerm) {
      const haystack = `${m.id} ${m.creator || ""} ${m.description || ""}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  renderedCount = 0;
  grid.innerHTML = "";
  itemCount.textContent = `${filteredModels.length} item${filteredModels.length === 1 ? "" : "s"}`;
  emptyState.hidden = filteredModels.length !== 0;
  renderNextBatch();
}

function renderNextBatch() {
  const next = filteredModels.slice(renderedCount, renderedCount + BATCH_SIZE);
  const frag = document.createDocumentFragment();
  next.forEach((m) => frag.appendChild(buildCard(m)));
  grid.appendChild(frag);
  renderedCount += next.length;
}

function buildCard(model) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Copy ID ${model.id}`);

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const glyph = document.createElement("span");
  glyph.className = "thumb-glyph";
  glyph.textContent = (model.category || "?").charAt(0).toUpperCase();
  thumb.appendChild(glyph);

  if (model.featured) {
    const ribbon = document.createElement("span");
    ribbon.className = "ribbon";
    ribbon.textContent = "LIMITED";
    ribbon.title = "Marked as high quality in the original list";
    thumb.appendChild(ribbon);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const pill = document.createElement("span");
  pill.className = "category-pill";
  pill.textContent = model.category || "Uncategorized";
  body.appendChild(pill);

  const desc = document.createElement("p");
  const hasDesc = model.description && model.description.trim() !== "";
  desc.className = "card-desc" + (hasDesc ? "" : " placeholder");
  desc.textContent = hasDesc ? model.description : "No Description";
  body.appendChild(desc);

  const creator = document.createElement("p");
  creator.className = "card-creator";
  const creatorName = model.creator && model.creator.trim() !== "" ? model.creator : "Anonymous";
  creator.innerHTML = `by <span class="name"></span>`;
  creator.querySelector(".name").textContent = creatorName;
  body.appendChild(creator);

  const bottom = document.createElement("div");
  bottom.className = "card-bottom";

  const freeTag = document.createElement("span");
  freeTag.className = "free-tag";
  freeTag.textContent = "Free";

  const idWrap = document.createElement("span");
  idWrap.className = "card-id";
  idWrap.innerHTML = `<span class="label">ID</span>`;
  idWrap.appendChild(document.createTextNode(model.id));

  bottom.appendChild(freeTag);
  bottom.appendChild(idWrap);
  body.appendChild(bottom);

  const hint = document.createElement("p");
  hint.className = "copy-hint";
  hint.textContent = "click to copy ID";
  body.appendChild(hint);

  card.appendChild(thumb);
  card.appendChild(body);

  const activate = () => copyId(model.id, card);
  card.addEventListener("click", activate);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });

  return card;
}

async function copyId(id, card) {
  try {
    await navigator.clipboard.writeText(String(id));
  } catch (err) {
    console.warn("Clipboard API failed, using fallback:", err);
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
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}
