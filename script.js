document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const searchInput = document.getElementById("search");
    const resultsContainer = document.getElementById("results");
    const detailsContainer = document.getElementById("details-container");
    const detailsContent = document.getElementById("details-content");
    const backToResultsButton = document.getElementById("back-to-results");
    const scrollToTopButton = document.getElementById("scrollToTopButton");
    const searchContainer = document.getElementById("controls-container");
    const loadingIndicator = document.getElementById("loading");
    const errorMessage = document.getElementById("error-message");
    const workshopFilter = document.getElementById("workshop-filter");
    const lineFilter = document.getElementById("line-filter");
    const schematicModal = document.getElementById('schematic-modal');
    const schematicImage = document.getElementById('schematic-image');
    const closeModalButton = document.getElementById('close-modal');
    const homeLink = document.getElementById('home-link');
    const resetFiltersBtn = document.getElementById('reset-filters-btn'); // NEW

    // --- State ---
    let allData = [];
    let previousScrollPosition = 0;

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    async function initialize() {
        await loadData();
        setupEventListeners();
        applyUrlParamsOnLoad();
    }

    async function loadData() {
        // ... (без змін)
        loadingIndicator.classList.remove("hidden");
        try {
            const response = await fetch('./data/data.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allData = await response.json();
            populateFilters();
            loadingIndicator.classList.add("hidden");
            resultsContainer.classList.remove("hidden");
            resultsContainer.innerHTML = `<p class="text-center text-gray-500">Завантажено ${allData.length} елементів. Почніть пошук.</p>`;
        } catch (error) {
            console.error("Error loading JSON:", error);
            loadingIndicator.classList.add("hidden");
            errorMessage.classList.remove("hidden");
        }
    }

    const cleanseString = (str) => str.toString().toLowerCase().replace(/[\s\.,_-]/g, '');

    function itemMatchesQuery(item, query) {
        // ... (без змін)
        const cleansedQuery = cleanseString(query);
        if (!cleansedQuery) return true;
        const check = (value) => cleanseString(value).includes(cleansedQuery);
        for (const key in item) {
            if (key !== "ЕМ/КВПіА" && check(item[key])) return true;
        }
        return item["ЕМ/КВПіА"].some(em =>
            Object.values(em).some(val => {
                if (Array.isArray(val)) {
                    return val.some(kvp => Object.values(kvp).some(kvpVal => check(kvpVal)));
                }
                return check(val);
            })
        );
    }

    function findMatches(query, workshop, line) {
        // ... (без змін)
        return allData.filter(item => {
            const workshopMatch = !workshop || item["Цех"] === workshop;
            const lineMatch = !line || String(item["Лінія"]) === line;
            return workshopMatch && lineMatch && itemMatchesQuery(item, query);
        });
    }

    function handleSearchAndFilter() {
        const query = searchInput.value.trim();
        const selectedWorkshop = workshopFilter.value;
        const selectedLine = lineFilter.value;

        updateUrlState(query, selectedWorkshop, selectedLine);
        const results = findMatches(query, selectedWorkshop, selectedLine);
        displayResults(results, query);
        updateFiltersState(query, selectedWorkshop, selectedLine);
        updateControlsState(query, selectedWorkshop, selectedLine); // NEW
    }

    function displayResults(results, query) {
        resultsContainer.innerHTML = "";
        if (query.length === 0 && workshopFilter.value === "" && lineFilter.value === "") {
            resultsContainer.innerHTML = `<p class="text-center text-gray-500">Завантажено ${allData.length} елементів. Почніть пошук.</p>`;
            return;
        }
        if (results.length === 0) {
            resultsContainer.innerHTML = "<p class='text-center text-gray-500'>Нічого не знайдено</p>";
            return;
        }
        results.forEach((item, index) => { // Added index for animation
            const resultItem = document.createElement("div");
            resultItem.className = "p-4 border border-gray-200 rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-lg result-item";

            // NEW: Staggered animation delay
            resultItem.style.animationDelay = `${index * 50}ms`;

            const topLevelMatch = cleanseString(item["Код обладнання"]).includes(cleanseString(query)) || cleanseString(item["Назва обладнання (українською)"]).includes(cleanseString(query));
            let subItemsHtml;
            if (!topLevelMatch && query) {
                const contextMatches = [];
                item["ЕМ/КВПіА"]?.forEach(em => { if (Object.values(em).some(val => typeof val === 'string' && cleanseString(val).includes(cleanseString(query)))) contextMatches.push({ ...em, type: 'ЕМ' }); em["КВПіА"]?.forEach(kvp => { if (Object.values(kvp).some(val => typeof val === 'string' && cleanseString(val).includes(cleanseString(query)))) contextMatches.push({ ...kvp, type: 'КВПіА' }); }); });
                subItemsHtml = contextMatches.map(subItem => { if (subItem.type === 'ЕМ') return `<div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm"><b class="text-red-700">Збіг в ЕМ:</b> ${highlightMatch(subItem["ЕМ"], query)} | <b>Шафа:</b> ${highlightMatch(subItem["Номер шафи EM"] || '-', query)} | <b>Автомат:</b> ${highlightMatch(subItem["Номер Автомата"] || '-', query)}</div>`; if (subItem.type === 'КВПіА') return `<div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm"><b class="text-blue-700">Збіг в КВПіА:</b> ${highlightMatch(subItem["Назва датчика"], query)} | <b>Шафа:</b> ${highlightMatch(subItem["Номер шафи КВПіА"] || '-', query)} | <b>Сигнал:</b> ${highlightMatch(subItem["Номер сигналу"] || '-', query)}</div>`; return ''; }).join('');
            } else {
                subItemsHtml = item["ЕМ/КВПіА"]?.map(em => `<div class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><b>ЕМ:</b> ${highlightMatch(em["ЕМ"], query)} | <b>Шафа:</b> ${highlightMatch(em["Номер шафи EM"] || '-', query)} | <b>Автомат:</b> ${highlightMatch(em["Номер Автомата"] || '-', query)}</div>`).join('');
            }
            resultItem.innerHTML = `<div class="flex items-center space-x-2 font-semibold text-lg text-gray-800"><svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 10a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6z"></path></svg><span>${highlightMatch(item["Код обладнання"], query)}</span></div><p class="text-sm text-gray-600">${highlightMatch(item["Назва обладнання (українською)"], query)}</p><div class="text-sm text-gray-600 mt-2"><b>Лінія:</b> ${item["Лінія"] || '-'} | <b>Цех:</b> ${item["Цех"] || '-'}</div>${subItemsHtml}`;
            resultItem.addEventListener("click", () => showDetails(item, query));
            resultsContainer.appendChild(resultItem);
        });
    }

    // ... (highlightMatch та showDetails залишаються без змін)
    function highlightMatch(text, query) { if (!text || !query) return text; const cleansedQuery = cleanseString(query); if (!cleansedQuery) return text; const regex = new RegExp(cleansedQuery.split('').join('[\\s\\.,_-]*'), 'ig'); return text.toString().replace(regex, `<span class="highlight">$&</span>`); }
    function showDetails(item, query) { previousScrollPosition = window.scrollY; resultsContainer.classList.add("hidden"); detailsContainer.classList.remove("hidden"); searchContainer.classList.add("hidden"); backToResultsButton.classList.remove("hidden"); const createDetailRow = (label, value) => { if (value === null || value === undefined || value === '') return ''; if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) { return `<div><span class="font-semibold w-40 inline-block">${label}:</span><a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a></div>`; } if (typeof value === 'object') { const nestedDetails = Object.entries(value).map(([key, val]) => `<li><span class="font-medium">${key}:</span> ${highlightMatch(val, query)}</li>`).join(''); return `<div><span class="font-semibold w-40 inline-block">${label}:</span><ul class="list-disc list-inside ml-4 space-y-1">${nestedDetails}</ul></div>`; } return `<div><span class="font-semibold w-40 inline-block">${label}:</span><span>${highlightMatch(value, query)}</span></div>`; }; let detailsHtml = `<h3 class="text-2xl font-bold text-gray-800 mb-4">${item["Назва обладнання (українською)"] || '-'}</h3><div class="space-y-2 text-gray-700 mb-6 border-b pb-4">${Object.entries(item).filter(([key]) => key !== "ЕМ/КВПіА" && key !== "Назва обладнання (українською)").map(([key, value]) => createDetailRow(key, value)).join('')}</div>`; item["ЕМ/КВПіА"]?.forEach((em, index) => { const emId = `em-details-${index}`; const kvpiaId = `kvpia-details-${index}`; let emDetails = ''; for (const key in em) if (key !== "КВПіА") emDetails += createDetailRow(key, em[key]); const kvpiaHtml = (em["КВПіА"] && em["КВПіА"].length > 0) ? `<div class="mb-6 p-4 border rounded-xl shadow-sm kvpia-card"><button class="w-full text-left flex items-center justify-between text-blue-700 font-bold text-lg mb-2 toggle-details" data-target="${kvpiaId}"><div class="flex items-center space-x-2"><svg class="w-6 h-6 toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg><span class="font-bold">КВПіА</span></div><svg class="w-5 h-5 toggle-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button><div id="${kvpiaId}" class="collapsible-content space-y-4 text-sm text-gray-700 mt-2">${em["КВПіА"].map(kvp => `<div class="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">${Object.entries(kvp).map(([key, value]) => createDetailRow(key, value)).join('')}</div>`).join('')}</div></div>` : ''; detailsHtml += `<div class="mb-6 p-4 border rounded-xl shadow-sm em-card"><button class="w-full text-left flex items-center justify-between text-red-700 font-bold text-lg mb-2 toggle-details" data-target="${emId}"><div class="flex items-center space-x-2"><svg class="w-6 h-6 toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg><span class="font-bold">ЕМ:</span> <span>${highlightMatch(em["ЕМ"] || `Привід #${index + 1}`, query)}</span></div><svg class="w-5 h-5 toggle-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button><div id="${emId}" class="collapsible-content space-y-2 text-sm text-gray-700 mt-2">${emDetails}${em.schematic_image ? `<button data-schematic="${em.schematic_image}" class="open-schematic-btn mt-4 w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2 2 2h4a2 2 0 012 2v10a2 2 0 01-2 2z"></path></svg><span>Показати схему</span></button>` : ''}</div></div>${kvpiaHtml}`; }); detailsContent.innerHTML = detailsHtml; addToggleDetailsListeners(); addSchematicButtonListeners(); window.scrollTo({ top: 0, behavior: "smooth" }); }

    // ... (populateFilters, updateUrlState, applyUrlParamsOnLoad залишаються без змін)
    function populateFilters() { const workshops = [...new Set(allData.map(item => item["Цех"]))].sort(); const lines = [...new Set(allData.map(item => item["Лінія"]))].sort((a, b) => String(a).localeCompare(String(b))); workshopFilter.innerHTML = '<option value="">Усі цехи</option>'; lineFilter.innerHTML = '<option value="">Усі лінії</option>'; workshops.forEach(w => { const option = document.createElement('option'); option.value = w; option.textContent = `Цех ${w}`; option.dataset.baseText = `Цех ${w}`; workshopFilter.appendChild(option); }); lines.forEach(l => { const option = document.createElement('option'); option.value = l; option.textContent = `Лінія ${l}`; option.dataset.baseText = `Лінія ${l}`; lineFilter.appendChild(option); }); }
    function updateUrlState(query, tseh, line) { const params = new URLSearchParams(); if (query) params.set('q', query); if (tseh) params.set('tseh', tseh); if (line) params.set('line', line); const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname; window.history.pushState({ path: newUrl }, '', newUrl); }
    function applyUrlParamsOnLoad() { const params = new URLSearchParams(window.location.search); const query = params.get('q') || ''; const tseh = params.get('tseh') || ''; const line = params.get('line') || ''; searchInput.value = query; workshopFilter.value = tseh; lineFilter.value = line; if (query || tseh || line) { handleSearchAndFilter(); } }

    function updateFiltersState(query, selectedWorkshop, selectedLine) {
        // ... (без змін)
        const relevantForWorkshops = findMatches(query, '', selectedLine); const workshopCounts = {}; for (const item of relevantForWorkshops) { workshopCounts[item["Цех"]] = (workshopCounts[item["Цех"]] || 0) + 1; } workshopFilter.querySelectorAll('option').forEach(option => { const baseText = option.dataset.baseText; if (!baseText) return; const count = workshopCounts[option.value] || 0; option.textContent = count > 0 ? `${baseText} (${count})` : baseText; option.disabled = count === 0; }); const relevantForLines = findMatches(query, selectedWorkshop, ''); const lineCounts = {}; for (const item of relevantForLines) { lineCounts[item["Лінія"]] = (lineCounts[item["Лінія"]] || 0) + 1; } lineFilter.querySelectorAll('option').forEach(option => { const baseText = option.dataset.baseText; if (!baseText) return; const count = lineCounts[option.value] || 0; option.textContent = count > 0 ? `${baseText} (${count})` : baseText; option.disabled = count === 0; });
    }

    // NEW: Function to manage the state of controls (active filters, reset button)
    function updateControlsState(query, selectedWorkshop, selectedLine) {
        // Show/hide reset button
        const isFiltered = query || selectedWorkshop || selectedLine;
        resetFiltersBtn.classList.toggle('hidden', !isFiltered);

        // Highlight active filters
        workshopFilter.classList.toggle('filter-active', !!selectedWorkshop);
        lineFilter.classList.toggle('filter-active', !!selectedLine);
    }

    function resetApplicationState() {
        searchInput.value = '';
        workshopFilter.value = '';
        lineFilter.value = '';
        handleSearchAndFilter();
    }

    function setupEventListeners() {
        searchInput.addEventListener("input", debounce(handleSearchAndFilter, 300));
        workshopFilter.addEventListener("change", handleSearchAndFilter);
        lineFilter.addEventListener("change", handleSearchAndFilter);
        homeLink.addEventListener('click', (event) => { event.preventDefault(); resetApplicationState(); });
        resetFiltersBtn.addEventListener('click', resetApplicationState); // NEW

        window.addEventListener("scroll", () => scrollToTopButton.style.display = window.scrollY > 300 ? "block" : "none");
        scrollToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
        backToResultsButton.addEventListener("click", () => { detailsContainer.classList.add("hidden"); resultsContainer.classList.remove("hidden"); searchContainer.classList.remove("hidden"); backToResultsButton.classList.add("hidden"); window.scrollTo(0, previousScrollPosition); });

        // ... (addSchematicButtonListeners та closeModalButton залишаються без змін)
        function addSchematicButtonListeners() { document.querySelectorAll(".open-schematic-btn").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); const schematicFilename = button.dataset.schematic; if (schematicFilename) { schematicImage.src = `./${schematicFilename}`; schematicModal.classList.remove('hidden'); schematicModal.classList.add('flex'); } })); }
        closeModalButton.addEventListener('click', () => { schematicModal.classList.add('hidden'); schematicModal.classList.remove('flex'); schematicImage.src = ''; });
        schematicModal.addEventListener('click', e => e.target === schematicModal && closeModalButton.click());
    }

    // ... (addToggleDetailsListeners залишається без змін)
    function addToggleDetailsListeners() { document.querySelectorAll(".toggle-details").forEach(button => button.addEventListener("click", () => { const target = document.getElementById(button.dataset.target); const mainIcon = button.querySelector('.toggle-icon'); const arrowIcon = button.querySelector('.toggle-arrow'); if (!target || !arrowIcon) return; arrowIcon.classList.toggle('rotate-90'); mainIcon?.classList.toggle('rotate-90'); if (target.style.maxHeight) { target.style.maxHeight = null; } else { target.style.maxHeight = target.scrollHeight + "px"; } })); }

    // --- PWA Installation Logic ---
    const installBtn = document.getElementById('install-btn');
    let installPromptEvent;

    window.addEventListener('beforeinstallprompt', (event) => {
        // Не показуємо стандартний мінібанер (який і так не з'являється)
        event.preventDefault();
        // Зберігаємо подію, щоб викликати її пізніше
        installPromptEvent = event;
        // Показуємо нашу власну кнопку
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        if (!installPromptEvent) {
            return;
        }
        // Показуємо системне вікно встановлення
        const result = await installPromptEvent.prompt();
        console.log(`Результат встановлення: ${result.outcome}`);
        // Скидаємо подію, оскільки її можна використати лише раз
        installPromptEvent = null;
        // Ховаємо нашу кнопку
        installBtn.classList.add('hidden');
    });

    initialize();
});