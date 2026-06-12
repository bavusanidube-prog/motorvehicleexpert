document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("mve-search");
  const resultsBox = document.getElementById("mve-search-results");

  if (!input || !resultsBox) {
    console.warn("MVE search box not found on this page.");
    return;
  }

  let searchIndex = [];

  function normalise(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function scoreItem(item, query) {
    const q = normalise(query);
    const title = normalise(item.title);
    const category = normalise(item.category);
    const keywords = normalise(item.keywords);
    const url = normalise(item.url);

    let score = 0;

    if (title === q) score += 100;
    if (title.startsWith(q)) score += 70;
    if (title.includes(q)) score += 45;
    if (url.includes(q)) score += 35;
    if (category.includes(q)) score += 25;
    if (keywords.includes(q)) score += 20;

    q.split(" ").forEach(word => {
      if (!word) return;
      if (title.includes(word)) score += 12;
      if (keywords.includes(word)) score += 7;
      if (category.includes(word)) score += 5;
      if (url.includes(word)) score += 5;
    });

    return score;
  }

  function renderResults(items, query) {
    if (!query || query.trim().length < 2) {
      resultsBox.style.display = "none";
      resultsBox.innerHTML = "";
      return;
    }

    if (!items.length) {
      resultsBox.innerHTML = `
        <div class="mve-search-empty">
          No results found. Try P0420, engine light, MOT, coolant, battery or used car.
        </div>
      `;
      resultsBox.style.display = "block";
      return;
    }

    resultsBox.innerHTML = items.slice(0, 8).map(item => `
      <a href="${item.url}" role="option">
        <span class="mve-search-title">${item.title}</span>
        <small>${item.category}</small>
      </a>
    `).join("");

    resultsBox.style.display = "block";
  }

  function runSearch() {
    const query = input.value;

    const matches = searchIndex
      .map(item => ({ item, score: scoreItem(item, query) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(result => result.item);

    renderResults(matches, query);
  }

  fetch("/search.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("search.json not found");
      return response.json();
    })
    .then(data => {
      searchIndex = Array.isArray(data) ? data : [];
      console.log("MVE search loaded:", searchIndex.length, "pages");
    })
    .catch(error => {
      console.error("MVE search failed:", error);
    });

  input.addEventListener("input", runSearch);

  document.addEventListener("click", event => {
    if (!event.target.closest(".mve-global-search")) {
      resultsBox.style.display = "none";
    }
  });
});
