document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("mve-search");
  const resultsBox = document.getElementById("mve-search-results");

  if (!input || !resultsBox) {
    return;
  }

  let searchIndex = [];
  let activeIndex = -1;
  let debounceTimer = null;

  /* ========================================================
     ACCESSIBILITY
  ======================================================== */

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "mve-search-results");
  input.setAttribute("aria-expanded", "false");

  resultsBox.setAttribute("role", "listbox");


  /* ========================================================
     TEXT NORMALISATION
  ======================================================== */

  function normalise(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }


  /* ========================================================
     HTML ESCAPING
  ======================================================== */

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* ========================================================
     SEARCH SCORING
  ======================================================== */

  function scoreItem(item, query) {

    const q = normalise(query);

    if (!q) {
      return 0;
    }

    const title = normalise(item.title);
    const category = normalise(item.category);
    const keywords = normalise(item.keywords);
    const url = normalise(item.url);

    const words = q
      .split(" ")
      .filter(word => word.length > 1);

    let score = 0;


    /* --------------------------------------------------------
       STRONG PHRASE MATCHES
    --------------------------------------------------------- */

    if (title === q) {
      score += 200;
    }

    if (title.startsWith(q)) {
      score += 120;
    }

    if (title.includes(q)) {
      score += 90;
    }

    if (keywords.includes(q)) {
      score += 55;
    }

    if (url.includes(q)) {
      score += 45;
    }

    if (category === q) {
      score += 40;
    }

    if (category.includes(q)) {
      score += 25;
    }


    /* --------------------------------------------------------
       INDIVIDUAL WORD MATCHES
    --------------------------------------------------------- */

    words.forEach(word => {

      if (title === word) {
        score += 30;
      }

      if (title.startsWith(word)) {
        score += 22;
      }

      if (title.includes(word)) {
        score += 18;
      }

      if (keywords.includes(word)) {
        score += 10;
      }

      if (category.includes(word)) {
        score += 7;
      }

      if (url.includes(word)) {
        score += 6;
      }

    });


    /* --------------------------------------------------------
       BONUS WHEN ALL QUERY WORDS MATCH
    --------------------------------------------------------- */

    if (
      words.length > 1 &&
      words.every(word =>
        title.includes(word) ||
        keywords.includes(word) ||
        category.includes(word) ||
        url.includes(word)
      )
    ) {
      score += 35;
    }

    return score;
  }


  /* ========================================================
     CLOSE RESULTS
  ======================================================== */

  function closeResults() {

    resultsBox.style.display = "none";
    resultsBox.innerHTML = "";

    activeIndex = -1;

    input.setAttribute("aria-expanded", "false");
  }


  /* ========================================================
     ACTIVE KEYBOARD RESULT
  ======================================================== */

  function updateActiveResult() {

    const links = Array.from(
      resultsBox.querySelectorAll("a[role='option']")
    );

    links.forEach((link, index) => {

      const active = index === activeIndex;

      link.classList.toggle(
        "mve-search-active",
        active
      );

      link.setAttribute(
        "aria-selected",
        active ? "true" : "false"
      );

      if (active) {
        link.scrollIntoView({
          block: "nearest"
        });
      }

    });

  }


  /* ========================================================
     RENDER RESULTS
  ======================================================== */

  function renderResults(items, query) {

    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      closeResults();
      return;
    }


    if (!items.length) {

      resultsBox.innerHTML = `
        <div class="mve-search-empty">
          No results found. Try P0420, engine light, MOT,
          coolant, battery, clutch or used car.
        </div>
      `;

      resultsBox.style.display = "block";

      input.setAttribute(
        "aria-expanded",
        "true"
      );

      activeIndex = -1;

      return;
    }


    const visibleItems = items.slice(0, 8);


    resultsBox.innerHTML = visibleItems
      .map((item, index) => {

        const title = escapeHTML(item.title);
        const category = escapeHTML(item.category);
        const url = escapeHTML(item.url);

        return `
          <a
            href="${url}"
            role="option"
            id="mve-search-option-${index}"
            aria-selected="false"
          >
            <span class="mve-search-title">
              ${title}
            </span>

            <small>
              ${category}
            </small>
          </a>
        `;

      })
      .join("");


    resultsBox.style.display = "block";

    input.setAttribute(
      "aria-expanded",
      "true"
    );

    activeIndex = -1;
  }


  /* ========================================================
     RUN SEARCH
  ======================================================== */

  function runSearch() {

    const query = input.value.trim();

    if (query.length < 2) {
      closeResults();
      return;
    }


    const matches = searchIndex
      .map(item => ({
        item,
        score: scoreItem(item, query)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => {

        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return String(a.item.title)
          .localeCompare(
            String(b.item.title),
            "en-GB"
          );

      })
      .map(result => result.item);


    renderResults(matches, query);
  }


  /* ========================================================
     LOAD SEARCH INDEX
  ======================================================== */

  fetch("/search.json")
    .then(response => {

      if (!response.ok) {
        throw new Error(
          `Unable to load search.json (${response.status})`
        );
      }

      return response.json();

    })

    .then(data => {

      if (!Array.isArray(data)) {
        throw new Error(
          "search.json does not contain a valid array."
        );
      }


      searchIndex = data.filter(item =>
        item &&
        typeof item.title === "string" &&
        typeof item.url === "string" &&
        typeof item.category === "string"
      );

    })

    .catch(error => {

      console.error(
        "Motor Vehicle Expert search failed:",
        error
      );

      searchIndex = [];

    });


  /* ========================================================
     INPUT SEARCH — DEBOUNCED
  ======================================================== */

  input.addEventListener("input", () => {

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      runSearch();
    }, 100);

  });


  /* ========================================================
     KEYBOARD NAVIGATION
  ======================================================== */

  input.addEventListener("keydown", event => {

    const links = Array.from(
      resultsBox.querySelectorAll(
        "a[role='option']"
      )
    );

    if (!links.length) {

      if (event.key === "Escape") {
        closeResults();
      }

      return;
    }


    if (event.key === "ArrowDown") {

      event.preventDefault();

      activeIndex =
        (activeIndex + 1) % links.length;

      updateActiveResult();

    }


    else if (event.key === "ArrowUp") {

      event.preventDefault();

      activeIndex =
        activeIndex <= 0
          ? links.length - 1
          : activeIndex - 1;

      updateActiveResult();

    }


    else if (event.key === "Enter") {

      if (activeIndex >= 0) {

        event.preventDefault();

        links[activeIndex].click();

      }

    }


    else if (event.key === "Escape") {

      closeResults();

      input.blur();

    }

  });


  /* ========================================================
     REOPEN RESULTS ON FOCUS
  ======================================================== */

  input.addEventListener("focus", () => {

    if (
      input.value.trim().length >= 2 &&
      resultsBox.innerHTML.trim()
    ) {

      resultsBox.style.display = "block";

      input.setAttribute(
        "aria-expanded",
        "true"
      );

    }

  });


  /* ========================================================
     CLOSE WHEN CLICKING OUTSIDE SEARCH
  ======================================================== */

  document.addEventListener("click", event => {

    if (
      !event.target.closest(
        ".mve-global-search"
      )
    ) {

      closeResults();

    }

  });

});
