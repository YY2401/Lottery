let db = null;
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lotteryDB", 1);
    request.onerror = (e) => {
      console.error("IndexedDB error:", e.target.error);
      reject(e.target.error);
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const upgradeDB = e.target.result;
      if (!upgradeDB.objectStoreNames.contains("prizes")) {
        upgradeDB.createObjectStore("prizes", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

function getAllPrizes() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["prizes"], "readonly");
    const store = tx.objectStore("prizes");
    const request = store.getAll();
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveAllPrizes(prizesArray) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["prizes"], "readwrite");
    const store = tx.objectStore("prizes");
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      let remaining = prizesArray.length;
      if (remaining === 0) return resolve();
      prizesArray.forEach((prize) => {
        const addReq = store.add(prize);
        addReq.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        addReq.onerror = (err) => reject(err.target.error);
      });
    };
    clearReq.onerror = (e) => reject(e.target.error);
  });
}

let prizes = [];
let thumbnailSize = 80;
let enlargedSize = 300;
let isDrawing = false;
let historyPage = 1;
const HISTORY_PAGE_SIZE = 50;

/***********************************************
 * Init
 ***********************************************/
window.onload = async () => {
  try {
    await initDB();
  } catch (err) {
    console.error("IndexedDB init failed:", err);
    Swal.fire("Error", "IndexedDB is unavailable. Some features may not work.", "error");
  }

  try {
    const data = await getAllPrizes();
    prizes = data || [];
  } catch (err) {
    console.error("Failed to read IndexedDB:", err);
    prizes = [];
  }

  thumbnailSize = parseInt(localStorage.getItem("thumbnailSize")) || 80;
  enlargedSize = parseInt(localStorage.getItem("enlargedSize")) || 300;
  document.documentElement.style.setProperty("--thumbnail-size", `${thumbnailSize}px`);

  adjustProbabilities();
  applyHistoryFilters();
  updateStorageSize();

  document.getElementById("test-draw-btn")?.addEventListener("click", () => {
    testDrawLottery();
  });

  // Button press animation
  document.querySelectorAll(".buttons button").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      if (typeof anime !== "undefined") {
        anime({
          targets: e.currentTarget,
          scale: [1, 0.92, 1],
          duration: 300,
          easing: "easeInOutQuad",
        });
      }
    });
  });
};

/***********************************************
 * Animation: Slot machine reel
 ***********************************************/
function playSlotAnimation(pickedItem, activeItems) {
  return new Promise((resolve) => {
    if (typeof anime === "undefined" || activeItems.length < 2) {
      resolve();
      return;
    }

    const container = document.getElementById("animation-container");
    if (!container) { resolve(); return; }

    container.classList.add("active");
    container.innerHTML = "";

    // Build reel: repeat prizes several times, end with picked item
    const reelNames = [];
    for (let i = 0; i < 4; i++) {
      activeItems.forEach((p) => reelNames.push(p.customText || p.name));
    }
    reelNames.push(pickedItem.customText || pickedItem.name);

    const reel = document.createElement("div");
    reel.className = "slot-reel";
    reelNames.forEach((name) => {
      const item = document.createElement("div");
      item.className = "slot-item";
      item.textContent = name;
      reel.appendChild(item);
    });
    container.appendChild(reel);

    const itemHeight = 80;
    const finalOffset = -(reelNames.length - 1) * itemHeight;

    anime({
      targets: reel,
      translateY: [0, finalOffset],
      duration: 2000,
      easing: "easeOutExpo",
      complete: () => {
        setTimeout(() => {
          container.classList.remove("active");
          container.innerHTML = "";
          resolve();
        }, 300);
      },
    });
  });
}

/***********************************************
 * Animation: Celebration particles
 ***********************************************/
function playCelebration() {
  if (typeof anime === "undefined") return;

  const container = document.getElementById("particle-container");
  if (!container) return;

  const colors = ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#5f27cd", "#01a3a4", "#f368e0"];
  const particles = [];

  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = Math.random() * 10 + 6;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = "50%";
    p.style.top = "40%";
    container.appendChild(p);
    particles.push(p);
  }

  anime({
    targets: particles,
    translateX: () => anime.random(-350, 350),
    translateY: () => anime.random(-400, 200),
    scale: [{ value: 1, duration: 0 }, { value: 0, duration: 800, delay: 400 }],
    opacity: [{ value: 1, duration: 0 }, { value: 0, duration: 600, delay: 600 }],
    rotate: () => anime.random(-180, 180),
    duration: 1200,
    easing: "easeOutExpo",
    delay: anime.stagger(15),
    complete: () => {
      particles.forEach((p) => p.remove());
    },
  });
}

/***********************************************
 * Animation: Stagger reveal for result items
 ***********************************************/
function animateResultItems() {
  if (typeof anime === "undefined") return;
  anime({
    targets: "#result .result-item",
    opacity: [0, 1],
    scale: [0, 1],
    delay: anime.stagger(120),
    duration: 400,
    easing: "easeOutBack",
  });
}

/***********************************************
 * Draw buttons lock
 ***********************************************/
function setDrawButtonsEnabled(enabled) {
  const btns = document.querySelectorAll(".buttons button");
  btns.forEach((b) => (b.disabled = !enabled));
  isDrawing = !enabled;
}

/***********************************************
 * Build result item DOM element
 ***********************************************/
function createResultItemElement(pickedItem) {
  const div = document.createElement("div");
  div.className = "result-item";
  div.style.color = pickedItem.textColor || "#333";
  div.style.backgroundColor = pickedItem.bgColor || "#fff";

  const hasImage = pickedItem.image && pickedItem.image.trim() !== "";
  const label = pickedItem.customText || pickedItem.name;

  if (pickedItem.displayMode === "image") {
    div.innerHTML = hasImage
      ? `<img src="${pickedItem.image}" alt="${pickedItem.name}">`
      : `<div class="result-text">No image</div>`;
  } else if (pickedItem.displayMode === "all") {
    const imgPart = hasImage
      ? `<img src="${pickedItem.image}" alt="${pickedItem.name}">`
      : `<div class="result-text">No image</div>`;
    div.innerHTML = imgPart + `<div class="result-text">${label}</div>`;
  } else {
    div.innerHTML = `<div class="result-text">${label}</div>`;
  }

  if (hasImage) {
    div.addEventListener("click", () => showEnlargedImage(pickedItem.image, label));
    div.style.cursor = "pointer";
  }

  return div;
}

/***********************************************
 * Draw: Single
 ***********************************************/
async function drawSingle() {
  if (isDrawing) return;
  clearResults();

  const playerName = document.getElementById("player-name")?.value.trim();
  if (!playerName) {
    Swal.fire("Please enter a player name.", "", "warning");
    return;
  }

  const activeItems = prizes.filter((p) => p.quantity > 0);
  if (!activeItems.length) {
    Swal.fire("No prizes left.", "Please add prizes in Settings.", "warning");
    return;
  }

  const totalProb = activeItems.reduce((sum, p) => sum + p.probability, 0);
  if (totalProb <= 0) {
    Swal.fire("All active prizes have 0 probability.", "", "warning");
    return;
  }

  setDrawButtonsEnabled(false);

  const rand = Math.random() * totalProb;
  let cumulative = 0;
  let pickedItem = null;

  for (const p of activeItems) {
    cumulative += p.probability;
    if (rand <= cumulative) {
      p.quantity--;
      pickedItem = { ...p, player: playerName };
      break;
    }
  }

  if (pickedItem) {
    // Slot animation
    await playSlotAnimation(pickedItem, activeItems);

    const resultDiv = document.getElementById("result");
    if (resultDiv) {
      resultDiv.appendChild(createResultItemElement(pickedItem));
      animateResultItems();
    }

    playCelebration();
    saveToHistory([pickedItem]);
  }

  adjustProbabilities();
  applyHistoryFilters();
  updateStorageSize();

  try {
    await saveAllPrizes(prizes);
  } catch (e) {
    console.error("Failed to save IndexedDB:", e);
    Swal.fire("Error", "Failed to save prize data.", "error");
  }

  setDrawButtonsEnabled(true);
}

/***********************************************
 * Draw: Multiple
 ***********************************************/
async function drawMultiple(count) {
  if (isDrawing) return;
  clearResults();

  const playerName = document.getElementById("player-name")?.value.trim();
  if (!playerName) {
    Swal.fire("Please enter a player name.", "", "warning");
    return;
  }

  setDrawButtonsEnabled(false);

  const allPicked = [];

  for (let i = 0; i < count; i++) {
    const activeItems = prizes.filter((p) => p.quantity > 0);
    if (!activeItems.length) {
      Swal.fire("No prizes left.", "Please add prizes in Settings.", "warning");
      break;
    }
    const totalProb = activeItems.reduce((sum, p) => sum + p.probability, 0);
    if (totalProb <= 0) {
      Swal.fire("All active prizes have 0 probability.", "", "warning");
      break;
    }

    const rand = Math.random() * totalProb;
    let cumulative = 0;
    let pickedItem = null;

    for (const p of activeItems) {
      cumulative += p.probability;
      if (rand <= cumulative) {
        p.quantity--;
        pickedItem = { ...p, player: playerName };
        break;
      }
    }

    if (pickedItem) {
      allPicked.push(pickedItem);
      saveToHistory([pickedItem]);
    }

    adjustProbabilities();

    try {
      await saveAllPrizes(prizes);
    } catch (e) {
      console.error("Failed to save IndexedDB:", e);
      Swal.fire("Error", "Failed to save prize data.", "error");
      break;
    }
  }

  // Show all results at once with stagger animation
  const resultDiv = document.getElementById("result");
  if (resultDiv && allPicked.length) {
    allPicked.forEach((item) => {
      resultDiv.appendChild(createResultItemElement(item));
    });
    animateResultItems();
    playCelebration();
  }

  applyHistoryFilters();
  updateStorageSize();
  setDrawButtonsEnabled(true);
}

function clearResults() {
  const resultDiv = document.getElementById("result");
  if (resultDiv) resultDiv.innerHTML = "";
}

function showEnlargedImage(imgSrc, name) {
  Swal.fire({
    title: name,
    imageUrl: imgSrc,
    imageWidth: enlargedSize,
    imageHeight: enlargedSize,
    imageAlt: name,
    showConfirmButton: false,
    backdrop: true,
    padding: "1em",
  });
}

/***********************************************
 * History: Save
 ***********************************************/
function saveToHistory(result) {
  if (!result || !result.length) return;
  let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
  const now = new Date().toLocaleString();
  const ts = Date.now();

  result.forEach((item) => {
    history.unshift({
      name: item.name,
      player: item.player,
      customText: item.customText,
      probability: item.probability,
      textColor: item.textColor,
      bgColor: item.bgColor,
      time: now,
      timestamp: ts,
    });
  });

  if (history.length > 2000) history = history.slice(0, 2000);

  try {
    localStorage.setItem("lotteryHistory", JSON.stringify(history));
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      Swal.fire("Storage full.", "History has been cleared.", "error");
      localStorage.removeItem("lotteryHistory");
    }
  }
}

/***********************************************
 * History: Display with filters, pagination, stats
 ***********************************************/
function updateHistoryDisplay(options) {
  options = options || {};
  const query = (options.query || "").trim().toLowerCase();
  const dateFrom = options.dateFrom || "";
  const dateTo = options.dateTo || "";
  const page = options.page || historyPage;

  const historyDiv = document.getElementById("history");
  if (!historyDiv) return;

  const allHistory = (JSON.parse(localStorage.getItem("lotteryHistory")) || [])
    .filter((item) => !item.isSeparator);

  let filtered = allHistory;

  // Text filter
  if (query) {
    filtered = filtered.filter((item) =>
      (item.player || "").toLowerCase().includes(query) ||
      (item.customText || item.name || "").toLowerCase().includes(query)
    );
  }

  // Date range filter
  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    filtered = filtered.filter((item) => {
      const itemDate = item.timestamp ? new Date(item.timestamp) : parseLocalDate(item.time);
      return itemDate >= from;
    });
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter((item) => {
      const itemDate = item.timestamp ? new Date(item.timestamp) : parseLocalDate(item.time);
      return itemDate <= to;
    });
  }

  // Stats
  updateHistoryStats(filtered);

  // Pagination
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / HISTORY_PAGE_SIZE));
  historyPage = Math.min(page, totalPages);
  const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const paged = filtered.slice(start, start + HISTORY_PAGE_SIZE);

  // Record count
  const countEl = document.getElementById("record-count");
  if (countEl) {
    if (totalItems === 0) {
      countEl.textContent = "無紀錄";
    } else {
      countEl.textContent = `顯示 ${start + 1}-${Math.min(start + HISTORY_PAGE_SIZE, totalItems)} / 共 ${totalItems} 筆`;
    }
  }

  // Render table
  let html = `
    <table class="history-table">
      <thead>
        <tr>
          <th>抽獎者</th>
          <th>獎品</th>
          <th>時間</th>
        </tr>
      </thead>
      <tbody>
  `;

  paged.forEach((item) => {
    const player = highlightText(item.player || "", query);
    const prize = highlightText(item.customText || item.name || "", query);
    html += `
      <tr style="color: ${item.textColor || "#333"}">
        <td>${player}</td>
        <td>${prize}</td>
        <td>${item.time}</td>
      </tr>
    `;
  });

  if (paged.length === 0) {
    html += `<tr><td colspan="3" style="color:#999;padding:20px;">無符合條件的紀錄</td></tr>`;
  }

  html += `</tbody></table>`;
  historyDiv.innerHTML = html;

  // Pagination controls
  renderPagination(totalPages);
}

function parseLocalDate(timeStr) {
  if (!timeStr) return new Date(0);
  const d = new Date(timeStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

function renderPagination(totalPages) {
  const pagDiv = document.getElementById("history-pagination");
  if (!pagDiv) return;

  if (totalPages <= 1) {
    pagDiv.innerHTML = "";
    return;
  }

  pagDiv.innerHTML = `
    <button class="page-btn" onclick="goHistoryPage(${historyPage - 1})" ${historyPage <= 1 ? "disabled" : ""}>上一頁</button>
    <span>第 ${historyPage} / ${totalPages} 頁</span>
    <button class="page-btn" onclick="goHistoryPage(${historyPage + 1})" ${historyPage >= totalPages ? "disabled" : ""}>下一頁</button>
  `;
}

function goHistoryPage(page) {
  historyPage = page;
  applyHistoryFilters();
}

/***********************************************
 * History: Stats
 ***********************************************/
function updateHistoryStats(items) {
  const statsDiv = document.getElementById("history-stats");
  if (!statsDiv) return;

  if (!items.length) {
    statsDiv.innerHTML = "";
    return;
  }

  const totalDraws = items.length;
  const players = new Set(items.map((i) => i.player));
  const prizeCount = {};
  items.forEach((i) => {
    const key = i.customText || i.name;
    prizeCount[key] = (prizeCount[key] || 0) + 1;
  });

  const sorted = Object.entries(prizeCount).sort((a, b) => b[1] - a[1]);
  const topPrize = sorted[0];

  statsDiv.innerHTML = `
    <div class="stat-item">總抽獎次數：<span class="stat-value">${totalDraws}</span></div>
    <div class="stat-item">抽獎者人數：<span class="stat-value">${players.size}</span></div>
    <div class="stat-item">獎品種類：<span class="stat-value">${sorted.length}</span></div>
    ${topPrize ? `<div class="stat-item">最常見獎項：<span class="stat-value">${topPrize[0]} (${topPrize[1]}次)</span></div>` : ""}
  `;
}

/***********************************************
 * History: Filter controls
 ***********************************************/
function applyHistoryFilters() {
  const query = document.getElementById("history-search")?.value || "";
  const dateFrom = document.getElementById("history-date-from")?.value || "";
  const dateTo = document.getElementById("history-date-to")?.value || "";
  updateHistoryDisplay({ query, dateFrom, dateTo, page: historyPage });
}

function resetHistoryFilters() {
  const search = document.getElementById("history-search");
  const from = document.getElementById("history-date-from");
  const to = document.getElementById("history-date-to");
  if (search) search.value = "";
  if (from) from.value = "";
  if (to) to.value = "";
  historyPage = 1;
  applyHistoryFilters();
}

document.getElementById("history-search")?.addEventListener("input", () => {
  historyPage = 1;
  applyHistoryFilters();
});

/***********************************************
 * History: Copy / Export / Clear
 ***********************************************/
function copyHistoryToClipboard() {
  const hist = (JSON.parse(localStorage.getItem("lotteryHistory")) || [])
    .filter((x) => !x.isSeparator);
  let csv = "Player,Prize,Time\n";
  hist.forEach((item) => {
    csv += `${item.player},${item.customText || item.name},${item.time}\n`;
  });
  navigator.clipboard
    .writeText(csv)
    .then(() => Swal.fire("Copied.", "History copied to clipboard.", "success"))
    .catch(() => Swal.fire("Error", "Copy failed.", "error"));
}
document.getElementById("copy-btn")?.addEventListener("click", copyHistoryToClipboard);

function exportHistoryToExcel() {
  const hist = (JSON.parse(localStorage.getItem("lotteryHistory")) || [])
    .filter((x) => !x.isSeparator);
  const data = hist.map((item) => ({
    Player: item.player,
    Prize: item.customText || item.name,
    Time: item.time,
  }));
  if (typeof XLSX === "undefined") {
    Swal.fire("Missing SheetJS.", "", "error");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LotteryHistory");
  XLSX.writeFile(wb, "lottery_history.xlsx");
  Swal.fire("Exported.", "History saved to Excel.", "success");
}
document.getElementById("export-btn")?.addEventListener("click", exportHistoryToExcel);

function clearHistory() {
  Swal.fire({
    title: "清空紀錄？",
    text: "此操作無法復原。",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "清空",
    cancelButtonText: "取消",
  }).then((r) => {
    if (r.isConfirmed) {
      localStorage.removeItem("lotteryHistory");
      historyPage = 1;
      applyHistoryFilters();
      updateStorageSize();
      Swal.fire("紀錄已清空。", "", "success");
    }
  });
}

/***********************************************
 * Storage size display
 ***********************************************/
function updateStorageSize() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += (localStorage[key].length + key.length) * 2;
    }
  }
  const kb = (total / 1024).toFixed(2);
  const mb = (total / 1024 / 1024).toFixed(2);
  const el = document.getElementById("storage-size");
  if (el) {
    el.textContent = `儲存空間：${kb} KB (${mb} MB)`;
  }
}

/***********************************************
 * Probability management
 ***********************************************/
function adjustProbabilities() {
  prizes.forEach((p) => {
    if (p.probability < 0) p.probability = 0;
  });
  const zeroed = prizes.filter((p) => p.quantity === 0);
  const active = prizes.filter((p) => p.quantity > 0);

  if (!active.length) return;

  const sumZeroProb = zeroed.reduce((acc, z) => acc + z.probability, 0);
  zeroed.forEach((z) => {
    z.probability = 0;
  });

  const sumActiveProb = active.reduce((acc, a) => acc + a.probability, 0);
  if (sumActiveProb <= 0) {
    const equalProb = parseFloat((100 / active.length).toFixed(2));
    active.forEach((a) => {
      a.probability = equalProb;
    });
    const total = active.reduce((acc, a) => acc + a.probability, 0);
    if (total !== 100) {
      active[0].probability += 100 - total;
    }
    return;
  }
  if (sumActiveProb > 0 && sumZeroProb > 0) {
    active.forEach((a) => {
      const ratio = a.probability / sumActiveProb;
      a.probability += sumZeroProb * ratio;
    });
  }
}

async function distributeProbabilities() {
  prizes.forEach((p) => {
    if (p.probability < 0) p.probability = 0;
  });
  let currentTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
  if (currentTotal <= 0) {
    const active = prizes.filter((p) => p.quantity > 0);
    if (!active.length) return;
    const equalProb = parseFloat((100 / active.length).toFixed(2));
    active.forEach((p) => {
      p.probability = equalProb;
    });
    const total = active.reduce((sum, p) => sum + p.probability, 0);
    if (total !== 100) {
      active[0].probability += 100 - total;
    }
    currentTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
  }

  const factor = 100 / currentTotal;
  prizes.forEach((p) => {
    if (p.quantity > 0) {
      p.probability = parseFloat((p.probability * factor).toFixed(2));
    } else {
      p.probability = 0;
    }
  });

  let finalTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
  if (finalTotal !== 100) {
    const diff = 100 - finalTotal;
    const active = prizes.filter((x) => x.quantity > 0);
    if (active.length) {
      active[0].probability += diff;
    }
  }

  refreshPrizeTableInModal();

  try {
    await saveAllPrizes(prizes);
  } catch (err) {
    console.error("Failed to normalize probabilities:", err);
  }
}

/***********************************************
 * Prize settings modal
 ***********************************************/
function showAddPrizeModal() {
  Swal.fire({
    title: "Add prize",
    html: `
      <input type="file" id="prize-image" accept=".png,.jpg,.jpeg" style="margin:10px 0;">
      <div>Probability(%): <input type="number" id="new-prob" min="0" max="100" value="10" style="margin:10px 0;"></div>
      <div>Quantity: <input type="number" id="new-qty" min="0" value="5" style="margin:10px 0;"></div>
      <div>Display text: <input type="text" id="new-text" placeholder="Optional label" style="margin:10px 0;"></div>
      <div>Text color: <input type="color" id="text-color" value="#333333" style="margin:10px 0;"></div>
      <div>Background color: <input type="color" id="bg-color" value="#ffffff" style="margin:10px 0;"></div>
      <div>Display mode:
        <select id="display-mode">
          <option value="name">Name</option>
          <option value="image">Image</option>
          <option value="all">Both</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Add",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const fileInput = document.getElementById("prize-image");
      const probability = parseFloat(document.getElementById("new-prob").value) || 10;
      const quantity = parseInt(document.getElementById("new-qty").value) || 5;
      const customText = document.getElementById("new-text").value.trim();
      const textColor = document.getElementById("text-color").value;
      const bgColor = document.getElementById("bg-color").value;
      const mode = document.getElementById("display-mode").value;

      if (probability < 0 || quantity < 0) {
        Swal.fire("Probability and quantity must be non-negative.", "", "warning");
        return false;
      }

      if (!fileInput.files || fileInput.files.length === 0) {
        Swal.fire("Please select an image file.", "", "warning");
        return false;
      }
      const file = fileInput.files[0];
      const fName = file.name.toLowerCase();
      if (!fName.endsWith(".png") && !fName.endsWith(".jpg") && !fName.endsWith(".jpeg")) {
        Swal.fire("Only .png, .jpg, .jpeg are supported.", "", "warning");
        return false;
      }
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = (e) => {
          const base64 = e.target.result;
          const name = file.name.split(".")[0];
          prizes.push({
            name,
            image: base64,
            probability,
            quantity,
            customText: customText || name,
            textColor,
            bgColor,
            displayMode: mode,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    },
  }).then(async (r) => {
    if (r.isConfirmed) {
      try {
        await saveAllPrizes(prizes);
        Swal.fire("Prize added.", "", "success").then(() => {
          refreshPrizeTableInModal();
        });
      } catch (err) {
        console.error("Failed to save prize data:", err);
        Swal.fire("Error", "Failed to save prize data. Try smaller images or fewer prizes.", "error");
      }
    }
  });
}

function exportPrizesToExcel() {
  const data = prizes.map((p) => ({
    Name: p.name,
    Probability: p.probability,
    Quantity: p.quantity,
    DisplayText: p.customText,
    TextColor: p.textColor,
    BackgroundColor: p.bgColor,
    DisplayMode: p.displayMode,
  }));
  if (typeof XLSX === "undefined") {
    Swal.fire("Error", "SheetJS is not loaded.", "error");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PrizeSettings");
  XLSX.writeFile(wb, "prizes_settings.xlsx");
  Swal.fire("Exported.", "Prize settings saved to Excel.", "success");
}

function importPrizesFromExcelUI() {
  Swal.fire({
    title: "Import Excel",
    html: `<input type="file" id="prizeFile" accept=".xlsx, .xls" />`,
    showCancelButton: true,
    confirmButtonText: "Import",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const fileInput = document.getElementById("prizeFile");
      if (!fileInput.files || fileInput.files.length === 0) {
        Swal.showValidationMessage("Please choose a file.");
        return false;
      }
      return fileInput.files[0];
    },
  }).then((r) => {
    if (r.isConfirmed && r.value) {
      handlePrizesFile(r.value);
    }
  });
}

async function handlePrizesFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const header = jsonData[0];
    if (!header || !header.length) {
      Swal.fire("Import failed.", "The Excel file has no header row.", "error");
      return;
    }
    const nameIdx = header.indexOf("Name");
    const probIdx = header.indexOf("Probability");
    const qtyIdx = header.indexOf("Quantity");
    const textIdx = header.indexOf("DisplayText");
    const txtColorIdx = header.indexOf("TextColor");
    const bgColorIdx = header.indexOf("BackgroundColor");
    const modeIdx = header.indexOf("DisplayMode");

    if (nameIdx < 0 || probIdx < 0 || qtyIdx < 0) {
      Swal.fire("Import failed.", "Required columns: Name, Probability, Quantity.", "error");
      return;
    }

    prizes = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row.length) continue;

      const nameVal = row[nameIdx];
      const probVal = parseFloat(row[probIdx]) || 0;
      const qtyVal = parseInt(row[qtyIdx]) || 0;
      const customText = textIdx >= 0 && row[textIdx] ? row[textIdx] : "";
      const textColor = txtColorIdx >= 0 && row[txtColorIdx] ? row[txtColorIdx] : "#333333";
      const bgColor = bgColorIdx >= 0 && row[bgColorIdx] ? row[bgColorIdx] : "#ffffff";
      const mode = modeIdx >= 0 && row[modeIdx] ? row[modeIdx] : "name";

      prizes.push({
        name: String(nameVal),
        probability: probVal,
        quantity: qtyVal,
        customText,
        textColor,
        bgColor,
        displayMode: mode,
        image: "",
      });
    }
    await saveAllPrizes(prizes);
    adjustProbabilities();
    Swal.fire("Imported.", "Prizes imported from Excel.", "success").then(() => {
      refreshPrizeTableInModal();
    });
  } catch (err) {
    console.error(err);
    Swal.fire("Import failed.", "Failed to read file.", "error");
  }
}

function refreshPrizeTableInModal() {
  const tbody = document.getElementById("prize-table-tbody");
  if (!tbody) return;

  tbody.innerHTML = prizes
    .map((p, i) => {
      return `
        <tr>
          <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
          <td>${p.name}</td>
          <td><input type="number" class="prob-input" min="0" max="100" value="${p.probability}" data-index="${i}"></td>
          <td><input type="number" class="qty-input" min="0" value="${p.quantity}" data-qty-index="${i}"></td>
          <td><input type="text" class="text-input" value="${p.customText || p.name}" data-text-index="${i}"></td>
          <td><input type="color" class="color-input" value="${p.textColor || "#333333"}" data-text-color-index="${i}"></td>
          <td><input type="color" class="color-input" value="${p.bgColor || "#ffffff"}" data-bg-color-index="${i}"></td>
          <td>
            <select data-mode-index="${i}" class="mode-select">
              <option value="name" ${p.displayMode === "name" ? "selected" : ""}>Name</option>
              <option value="image" ${p.displayMode === "image" ? "selected" : ""}>Image</option>
              <option value="all" ${p.displayMode === "all" ? "selected" : ""}>Both</option>
            </select>
          </td>
          <td>
            <div style="margin-bottom:5px;">
              ${p.image ? `<img src="${p.image}" alt="preview" style="width:40px;height:40px;object-fit:cover;">` : "N/A"}
            </div>
            <button type="button" class="action-btn" style="padding:5px;" onclick="updatePrizeImage(${i})">
              Update image
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  const tot = prizes
    .filter((x) => x.quantity > 0)
    .reduce((sum, p) => sum + p.probability, 0);

  const warnEl = document.getElementById("probability-warning");
  if (warnEl) {
    warnEl.textContent =
      Math.round(tot) === 100
        ? "Total probability is 100%"
        : `Warning: total probability is ${tot.toFixed(2)}%. Please normalize to 100%.`;
  }
}

function updatePrizeImage(index) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".png,.jpg,.jpeg";

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      prizes[index].image = ev.target.result;
      try {
        await saveAllPrizes(prizes);
        refreshPrizeTableInModal();
      } catch (err) {
        console.error("Failed to update image data:", err);
        Swal.fire("Error", "Failed to update image data.", "error");
      }
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

document.getElementById("settings-btn")?.addEventListener("click", () => {
  let html = `
    <h3>Prize settings</h3>
    <table class="prize-table">
      <thead>
        <tr>
          <th>Select</th>
          <th>Name</th>
          <th>Probability (%)</th>
          <th>Quantity</th>
          <th>Display text</th>
          <th>Text color</th>
          <th>Background color</th>
          <th>Display mode</th>
          <th>Image</th>
        </tr>
      </thead>
      <tbody id="prize-table-tbody">
      </tbody>
    </table>
    <button type="button" onclick="deleteSelectedPrizes()" class="action-btn">Delete selected</button>
    <button type="button" onclick="showAddPrizeModal()" class="action-btn">Add prize</button>
    <button type="button" onclick="distributeProbabilities()" class="action-btn">Normalize probabilities</button>
    <button type="button" onclick="importPrizesFromExcelUI()" class="action-btn">Import prizes</button>
    <button type="button" onclick="exportPrizesToExcel()" class="action-btn">Export prizes</button>

    <div>Thumbnail size (px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>
    <div>Enlarged size (px): <input type="number" min="100" max="800" value="${enlargedSize}" id="enlarged-size"></div>
    <p id="probability-warning"></p>
  `;

  Swal.fire({
    html,
    showCancelButton: true,
    confirmButtonText: "Save",
    cancelButtonText: "Cancel",
    focusConfirm: false,
    width: "1600px",
    preConfirm: async () => {
      const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
      const qtyInputs = document.querySelectorAll(".swal2-modal .qty-input");
      const textInputs = document.querySelectorAll(".swal2-modal .text-input");
      const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
      const bgColorInputs = document.querySelectorAll(".swal2-modal [data-bg-color-index]");
      const modeSelects = document.querySelectorAll(".swal2-modal .mode-select");

      probInputs.forEach((el) => {
        const idx = el.getAttribute("data-index");
        prizes[idx].probability = parseFloat(el.value) || 0;
      });
      qtyInputs.forEach((el) => {
        const idx = el.getAttribute("data-qty-index");
        prizes[idx].quantity = parseInt(el.value) || 0;
      });
      textInputs.forEach((el) => {
        const idx = el.getAttribute("data-text-index");
        prizes[idx].customText = el.value.trim() || prizes[idx].name;
      });
      textColorInputs.forEach((el) => {
        const idx = el.getAttribute("data-text-color-index");
        prizes[idx].textColor = el.value;
      });
      bgColorInputs.forEach((el) => {
        const idx = el.getAttribute("data-bg-color-index");
        prizes[idx].bgColor = el.value;
      });
      modeSelects.forEach((el) => {
        const idx = el.getAttribute("data-mode-index");
        prizes[idx].displayMode = el.value;
      });

      const hasNegative = prizes.some((p) => p.probability < 0 || p.quantity < 0);
      if (hasNegative) {
        Swal.fire("Probability and quantity must be non-negative.", "", "warning");
        return false;
      }

      const totalProb = prizes
        .filter((x) => x.quantity > 0)
        .reduce((sum, p) => sum + p.probability, 0);
      if (Math.abs(totalProb - 100) > 0.01) {
        Swal.fire(
          "Probability total must be 100%.",
          "Use Normalize Probabilities or adjust values manually.",
          "warning"
        );
        return false;
      }

      thumbnailSize = parseInt(document.getElementById("thumbnail-size").value) || 80;
      enlargedSize = parseInt(document.getElementById("enlarged-size").value) || 300;
      localStorage.setItem("thumbnailSize", thumbnailSize);
      localStorage.setItem("enlargedSize", enlargedSize);
      document.documentElement.style.setProperty("--thumbnail-size", `${thumbnailSize}px`);

      try {
        await saveAllPrizes(prizes);
      } catch (err) {
        console.error("Failed to save prize data:", err);
        Swal.fire("Error", "Failed to save prize data. Try smaller images or fewer prizes.", "error");
        return false;
      }
    },
  }).then((r) => {
    if (r.isConfirmed) {
      Swal.fire("Settings saved.", "", "success");
    }
  });

  setTimeout(() => {
    refreshPrizeTableInModal();
  }, 50);
});

async function deleteSelectedPrizes() {
  const checks = document.querySelectorAll(".swal2-modal .delete-check:checked");
  const toDelete = Array.from(checks).map((cb) => parseInt(cb.getAttribute("data-index")));
  if (!toDelete.length) {
    Swal.showValidationMessage("Select at least one prize.");
    return;
  }
  prizes = prizes.filter((_, i) => !toDelete.includes(i));

  try {
    await saveAllPrizes(prizes);
    refreshPrizeTableInModal();
  } catch (err) {
    console.error("Failed to delete prizes:", err);
    Swal.fire("Error", "Failed to save prize data.", "error");
  }
}

/***********************************************
 * Test draw simulation
 ***********************************************/
function simulateDraws(count) {
  const clonedPrizes = JSON.parse(JSON.stringify(prizes));

  function adjustProbForCloned() {
    const zeroed = clonedPrizes.filter((p) => p.quantity === 0);
    const active = clonedPrizes.filter((p) => p.quantity > 0);
    if (!active.length) return;
    const sumZeroProb = zeroed.reduce((acc, z) => acc + z.probability, 0);
    zeroed.forEach((z) => {
      z.probability = 0;
    });
    const sumActiveProb = active.reduce((acc, a) => acc + a.probability, 0);
    if (sumActiveProb > 0 && sumZeroProb > 0) {
      active.forEach((a) => {
        const ratio = a.probability / sumActiveProb;
        a.probability += sumZeroProb * ratio;
      });
    }
  }

  adjustProbForCloned();

  const distribution = {};

  for (let i = 0; i < count; i++) {
    const activeItems = clonedPrizes.filter((p) => p.quantity > 0);
    if (!activeItems.length) break;

    const totalProb = activeItems.reduce((sum, p) => sum + p.probability, 0);
    if (totalProb <= 0) break;

    const rand = Math.random() * totalProb;
    let cumulative = 0;
    let picked = null;
    for (const p of activeItems) {
      cumulative += p.probability;
      if (rand <= cumulative) {
        p.quantity--;
        picked = p;
        break;
      }
    }
    if (picked) {
      distribution[picked.name] = (distribution[picked.name] || 0) + 1;
    }

    adjustProbForCloned();
  }

  return distribution;
}

function buildDistributionTable(dist, totalDraws) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  let html = `
    <table class="history-table" style="margin:0 auto;">
      <thead>
        <tr>
          <th>Prize</th>
          <th>Hits</th>
          <th>Rate (%)</th>
        </tr>
      </thead>
      <tbody>
  `;
  entries.forEach(([prizeName, count]) => {
    const ratio = ((count / totalDraws) * 100).toFixed(2);
    html += `
      <tr>
        <td>${prizeName}</td>
        <td>${count}</td>
        <td>${ratio}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  return html;
}

function testDrawLottery() {
  const dist100 = simulateDraws(100);
  const dist1000 = simulateDraws(1000);

  const table100 = buildDistributionTable(dist100, 100);
  const table1000 = buildDistributionTable(dist1000, 1000);

  const html = `
    <h3>Simulation: 100 draws</h3>
    ${table100}
    <hr/>
    <h3>Simulation: 1000 draws</h3>
    ${table1000}
  `;

  Swal.fire({
    title: "Simulation results",
    html,
    width: "800px",
    showConfirmButton: true,
    confirmButtonText: "OK",
  });
}
