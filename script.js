const DATA_URL="data/models.json";
const PAGE_SIZE=30;
const NO_CATEGORY="__none__";

let allModels=[];
let filteredModels=[];
let activeCategory="all";
let recentOnly=false;
let searchTerm="";
let currentPage=1;

const grid=document.getElementById("grid");
const emptyState=document.getElementById("emptyState");
const searchInput=document.getElementById("searchInput");
const searchButton=document.getElementById("searchButton");
const categoryChips=document.getElementById("categoryChips");
const recentCheckbox=document.getElementById("featuredOnly");
const visibleCount=document.getElementById("visibleCount");
const sentinel=document.getElementById("sentinel");
const toast=document.getElementById("toast");

const clickSound = new Audio("assets/sounds/click.ogg");
clickSound.volume = 1.0;
clickSound.preload = "auto";

const RECENT_DAYS = 30;

document.addEventListener("click", (event) => {
    const target = event.target.closest(
        "button, input, textarea, select, a, label, .model-row, .chip, .page-button"
    );

    if (!target) return;

    clickSound.currentTime = 0;
    clickSound.play().catch(error => {
        console.error("Erro ao tocar click.ogg:", error);
    });
});

function parseDateAdded(value){
    if(!value)return null;

    const date=new Date(`${value}T00:00:00`);

    if(Number.isNaN(date.getTime())){
        return null;
    }

    return date;
}

function isRecentModel(model){
    const addedDate=parseDateAdded(model.dateAdded);

    if(!addedDate){
        return false;
    }

    const now=new Date();

    const diffMs=now.getTime()-addedDate.getTime();
    const diffDays=diffMs/(1000*60*60*24);

    return diffDays>=0 && diffDays<=RECENT_DAYS;
}

init();

async function init(){
    try{
        const res=await fetch(DATA_URL);

        if(!res.ok)throw new Error(`HTTP ${res.status}`);

        const raw=await res.json();
        const uniqueModels=new Map();

        raw.forEach(model=>{
            if(!model||!model.id||String(model.id).trim()===""){
                console.warn("Model without ID:",model);
                return;
            }

            const id=String(model.id).trim();

            if(!uniqueModels.has(id)){
                uniqueModels.set(id,{
                    ...model,
                    id
                });
            }
        });

        allModels=[...uniqueModels.values()];

        buildCategoryChips();
        applyFilters();

        searchInput.addEventListener("input",event=>{
            searchTerm=event.target.value.trim().toLowerCase();
            applyFilters();
        });

        searchButton?.addEventListener("click",applyFilters);

        recentCheckbox.addEventListener("change",event=>{
            recentOnly=event.target.checked;
            applyFilters();
        });

    }catch(error){
        console.error("Failed to load models.json:",error);

        grid.innerHTML=`
            <p class="empty-state text-center py-12">
                Couldn't load data/models.json.
            </p>
        `;
    }
}

function buildCategoryChips(){
    const counts=new Map();

    allModels.forEach(model=>{
        const category=model.category||NO_CATEGORY;
        counts.set(category,(counts.get(category)||0)+1);
    });

    const categories=[...counts.keys()]
        .filter(category=>category!==NO_CATEGORY)
        .sort((a,b)=>a.localeCompare(b));

    if(counts.has(NO_CATEGORY))categories.push(NO_CATEGORY);

    const allChip=makeChip("all","All Models",allModels.length);

    allChip.classList.add("active");
    categoryChips.appendChild(allChip);

    categories.forEach(category=>{
        categoryChips.appendChild(
            makeChip(
                category,
                category===NO_CATEGORY?"Uncategorized":category,
                counts.get(category)
            )
        );
    });
}

function makeChip(value,label,count){
    const chip=document.createElement("button");

    chip.className="chip";
    chip.type="button";
    chip.dataset.value=value;

    chip.innerHTML=`
        <span>${escapeHtml(label)}</span>
        <span class="count">${count}</span>
    `;

    chip.addEventListener("click",()=>{
        activeCategory=value;

        [...categoryChips.children].forEach(element=>{
            element.classList.remove("active");
        });

        chip.classList.add("active");
        applyFilters();
    });

    return chip;
}

function applyFilters(){
    filteredModels=allModels.filter(model=>{
        if(activeCategory!=="all"){
            const category=model.category||NO_CATEGORY;

            if(category!==activeCategory)return false;
        }

      const isRecent=isRecentModel(model);

      if(recentOnly&&!isRecent){
          return false;
      }

        if(searchTerm){
            const text=`
                ${model.id}
                ${model.creator||""}
                ${model.description||""}
                ${model.category||""}
            `.toLowerCase();

            if(!text.includes(searchTerm))return false;
        }

        return true;
    });

    currentPage=1;

    emptyState.hidden=filteredModels.length!==0;

    updateVisibleCount();
    updateCategoryTitle();
    renderPage();
    updatePagination();
}

function updateVisibleCount(){
    if(!visibleCount)return;

    visibleCount.textContent=`${filteredModels.length} models`;
}

function updateCategoryTitle(){
    const title=document.getElementById("currentCategoryTitle");

    if(!title)return;

    if(activeCategory==="all"){
        title.textContent=recentOnly?"Recent Models":"All Models";
        return;
    }

    title.textContent=
        activeCategory===NO_CATEGORY
            ?"Uncategorized"
            :activeCategory;
}

function renderPage(){
    grid.innerHTML="";

    const start=(currentPage-1)*PAGE_SIZE;
    const end=start+PAGE_SIZE;
    const models=filteredModels.slice(start,end);

    const fragment=document.createDocumentFragment();

    models.forEach(model=>{
        fragment.appendChild(buildModelRow(model));
    });

    grid.appendChild(fragment);
}

function updatePagination(){
    let pagination=document.getElementById("pagination");

    if(!pagination){
        pagination=document.createElement("div");
        pagination.id="pagination";
        pagination.className="pagination";
        grid.parentElement.appendChild(pagination);
    }

    pagination.innerHTML="";

    const totalPages=Math.ceil(filteredModels.length/PAGE_SIZE);

    if(totalPages<=1)return;

    const previous=document.createElement("button");

    previous.className="page-button";
    previous.textContent="« Previous";
    previous.disabled=currentPage===1;

    previous.addEventListener("click",()=>{
        if(currentPage>1){
            currentPage--;
            renderPage();
            updatePagination();
            window.scrollTo({top:0,behavior:"smooth"});
        }
    });

    pagination.appendChild(previous);

    const pages=document.createElement("div");
    pages.className="page-numbers";

    for(let page=1;page<=totalPages;page++){
        const button=document.createElement("button");

        button.className="page-button";

        if(page===currentPage)button.classList.add("active");

        button.textContent=page;

        button.addEventListener("click",()=>{
            currentPage=page;
            renderPage();
            updatePagination();
            window.scrollTo({top:0,behavior:"smooth"});
        });

        pages.appendChild(button);
    }

    pagination.appendChild(pages);

    const next=document.createElement("button");

    next.className="page-button";
    next.textContent="Next »";
    next.disabled=currentPage===totalPages;

    next.addEventListener("click",()=>{
        if(currentPage<totalPages){
            currentPage++;
            renderPage();
            updatePagination();
            window.scrollTo({top:0,behavior:"smooth"});
        }
    });

    pagination.appendChild(next);
}

function buildModelRow(model){
    const item=document.createElement("article");
    item.className="model-row";
    item.tabIndex=0;
    item.setAttribute("role","button");
    item.setAttribute(
        "aria-label",
        `Copy ID ${model.id}`
    );

    const main=document.createElement("div");
    main.className="model-main";

    const title=document.createElement("div");
    title.className="model-title";

    const isRecent=isRecentModel(model);

    if(isRecent){
        const badge=document.createElement("span");
        badge.className="badge-recent";
        badge.textContent="RECENT";
        badge.title="Recently added model";
        title.appendChild(badge);
    }

    const description=document.createElement("span");
    description.className="model-description";
    description.textContent=model.description||"No Description";
    title.appendChild(description);

    const creator=document.createElement("div");
    creator.className="model-creator";
    creator.textContent=
        `by ${model.creator&&model.creator.trim()
            ? model.creator
            : "Anonymous"}`;

    main.appendChild(title);
    main.appendChild(creator);

    const category=document.createElement("div");
    category.className="model-category";
    category.textContent=
        model.category||"Uncategorized";

    const id=document.createElement("div");
    id.className="model-id";
    id.textContent=`ID: ${model.id}`;

    item.appendChild(main);
    item.appendChild(category);
    item.appendChild(id);

    item.addEventListener("click",event=>{
        if(event.ctrlKey){
            copyModelData(model,item);
        }else{
            copyId(model.id,item);
        }
    });

    item.addEventListener("keydown",event=>{
        if(event.key==="Enter"){
            event.preventDefault();
            copyId(model.id,item);
        }

        if(event.key===" "){
            event.preventDefault();
            copyId(model.id,item);
        }
    });

    return item;
}


async function copyId(id,item){
    try{
        await navigator.clipboard.writeText(
            String(id)
        );
    }catch(error){
        const textarea=document.createElement("textarea");

        textarea.value=String(id);
        textarea.style.position="fixed";
        textarea.style.opacity="0";

        document.body.appendChild(textarea);

        textarea.select();
        document.execCommand("copy");

        textarea.remove();
    }

    showToast(`Copied ID: ${id}`);

    item.classList.add("copied");

    setTimeout(()=>{
        item.classList.remove("copied");
    },700);
}


async function copyModelData(model,item){
    const recent=isRecentModel(model);

    const data=[
        `Creator: ${model.creator||"Anonymous"}`,
        `ID: ${model.id}`,
        `Description: ${model.description||"No Description"}`,
        `Category: ${model.category||"Uncategorized"}`,
        `Date Added: ${model.dateAdded||"Unknown"}`,
        `Recent: ${recent}`
    ].join("\n");

    try{
        await navigator.clipboard.writeText(data);
    }catch(error){
        const textarea=document.createElement("textarea");

        textarea.value=data;
        textarea.style.position="fixed";
        textarea.style.opacity="0";

        document.body.appendChild(textarea);

        textarea.select();
        document.execCommand("copy");

        textarea.remove();
    }

    showToast(`Copied data: ${model.id}`);

    item.classList.add("copied");

    setTimeout(()=>{
        item.classList.remove("copied");
    },700);
}

let toastTimer;

function showToast(message){
    if(!toast)return;

    clearTimeout(toastTimer);

    toast.textContent=message;
    toast.classList.add("show");

    toastTimer=setTimeout(()=>{
        toast.classList.remove("show");
    },1600);
}

function escapeHtml(value){
    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}