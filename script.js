/************************************************
 * IndexedDB 部分：初始化 / 讀取 / 儲存 / 清空
 ************************************************/
let db = null; // 全域：IndexedDB 的資料庫連線

/**
 * 建立 / 開啟 IndexedDB
 *  - dbName: 'lotteryDB'
 *  - version: 1
 *  - objectStore: 'prizes'
 */
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('lotteryDB', 1);
        request.onerror = e => {
            console.error('無法開啟 IndexedDB:', e.target.error);
            reject(e.target.error);
        };
        request.onsuccess = e => {
            db = e.target.result;
            resolve(db);
        };
        request.onupgradeneeded = e => {
            const upgradeDB = e.target.result;
            // 若尚未建立 'prizes' store，就建立一個 keyPath='id' 並自動遞增
            // 或可改用 keyPath='name' 依專案需求
            if (!upgradeDB.objectStoreNames.contains('prizes')) {
                const store = upgradeDB.createObjectStore('prizes', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                // 如果你確定 name 唯一，也可直接以 name 為 keyPath
                // const store = upgradeDB.createObjectStore('prizes', { keyPath: 'name' });
            }
        };
    });
}

/**
 * 從 IndexedDB 讀取所有獎項 (prizes)
 */
function getAllPrizes() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['prizes'], 'readonly');
        const store = tx.objectStore('prizes');
        const request = store.getAll(); // 取得整個資料表
        request.onsuccess = e => {
            resolve(e.target.result);
        };
        request.onerror = e => {
            reject(e.target.error);
        };
    });
}

/**
 * 將 prizes 全量寫入 IndexedDB
 *  - 寫入前會先清除 store
 */
function saveAllPrizes(prizesArray) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['prizes'], 'readwrite');
        const store = tx.objectStore('prizes');

        // 1) 先清空
        const clearReq = store.clear();
        clearReq.onsuccess = () => {
            // 2) 全部重新 add
            let remaining = prizesArray.length;
            if (remaining === 0) {
                return resolve(); // 沒有要寫入的資料
            }
            prizesArray.forEach(prize => {
                // 注意：如果 keyPath='name'，需保證 name 不重複
                // 若 keyPath='id' 自動增量，就可自由新增
                const addReq = store.add(prize);
                addReq.onsuccess = () => {
                    remaining--;
                    if (remaining === 0) {
                        resolve();
                    }
                };
                addReq.onerror = err => {
                    reject(err.target.error);
                };
            });
        };
        clearReq.onerror = e => {
            reject(e.target.error);
        };
    });
}

/***********************************************
 * 原本的全域資料與函式
 ***********************************************/
let prizes = [];             // 原本放在 localStorage 的獎項，改由 IndexedDB 管理
let thumbnailSize = 80;
let enlargedSize = 300;

// --------------------
// 頁面載入
// --------------------
window.onload = async () => {
    // 1) 初始化 IndexedDB
    try {
        await initDB();
    } catch (err) {
        console.error('IndexedDB 初始化失敗:', err);
        Swal.fire('錯誤', 'IndexedDB 無法使用，部分功能可能無法運作。', 'error');
    }

    // 2) 從 IndexedDB 讀取 prizes
    try {
        const data = await getAllPrizes();
        // data 會是一個陣列，例如 [{id:1, name:'xxx', ...}, {id:2, ...}, ...]
        prizes = data || [];
    } catch (err) {
        console.error('讀取 IndexedDB 失敗:', err);
        prizes = [];
    }

    // 3) 讀取其他設定 (仍放 localStorage，小型資料不易爆)
    thumbnailSize = parseInt(localStorage.getItem("thumbnailSize")) || 80;
    enlargedSize  = parseInt(localStorage.getItem("enlargedSize"))  || 300;
    document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

    // 4) 其餘初始化
    adjustProbabilities();
    updateHistoryDisplay();
    updateStorageSize();
};

// --------------------
// 抽獎
// --------------------
async function draw(times) {
    const playerName = document.getElementById("player-name").value.trim();
    if (!playerName) {
        Swal.fire('請輸入抽獎者名稱！', '', 'warning');
        return;
    }
    let totalProb = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    if (totalProb <= 0 || !prizes.length) {
        Swal.fire('獎池為空或已抽完！', '請在設置中添加獎項', 'warning');
        return;
    }

    let drawResult = [];
    for (let i = 0; i < times; i++) {
        const rand = Math.random() * totalProb;
        let cumulative = 0;
        for (const p of prizes) {
            if (p.quantity > 0) {
                cumulative += p.probability;
                if (rand <= cumulative) {
                    // 抽中
                    p.quantity--;
                    drawResult.push({ ...p, player: playerName });
                    adjustProbabilities();
                    totalProb = prizes.reduce((sum, x) => sum + (x.quantity > 0 ? x.probability : 0), 0);
                    break;
                }
            }
        }
    }

    // 以抽到機率最小的獎項決定貓臉
    const minProb = drawResult.reduce((min, cur) => cur.probability < min.probability ? cur : min, drawResult[0]);
    document.getElementById("animation-container").innerHTML = getCatFaceSVG(
        minProb.probability,
        minProb.bgColor,
        minProb.textColor
    );

    // 顯示結果到 #result
    const resultDiv = document.getElementById("result");
    if (!resultDiv) return;
    resultDiv.innerHTML = "";
    drawResult.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.style.color = item.textColor || "#333";
        div.style.backgroundColor = item.bgColor || "#fff";

        // 根據 displayMode
        if (item.displayMode === "image") {
            if (item.image && item.image.trim() !== "") {
                div.innerHTML = `<img src="${item.image}" alt="${item.name}">`;
                div.addEventListener("click", () => {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
            } else {
                div.innerHTML = `<div class="result-text">無圖片</div>`;
            }
        } else if (item.displayMode === "all") {
            const imgPart = (item.image && item.image.trim() !== "")
                ? `<img src="${item.image}" alt="${item.name}">`
                : `<div class="result-text">無圖片</div>`;
            const textPart = `<div class="result-text">${item.customText || item.name}</div>`;
            div.innerHTML = imgPart + textPart;

            if (item.image && item.image.trim() !== "") {
                div.addEventListener("click", () => {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
            }
        } else {
            // displayMode === "name"
            div.innerHTML = `<div class="result-text">${item.customText || item.name}</div>`;
            // 如果有圖片，也可以點擊後彈出
            if (item.image && item.image.trim() !== "") {
                div.addEventListener("click", () => {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
                div.style.cursor = "pointer";
            }
        }
        resultDiv.appendChild(div);
    });

    // 寫入歷史紀錄
    saveToHistory(drawResult);
    updateHistoryDisplay();
    updateStorageSize();

    // 同步更新 IndexedDB 的最新獎項資料
    try {
        await saveAllPrizes(prizes);
    } catch (e) {
        console.error('更新 IndexedDB 失敗:', e);
        Swal.fire('錯誤', '儲存獎項資料時發生錯誤。', 'error');
    }
}

// --------------------
// cat face SVG
// --------------------
function getCatFaceSVG(prob, bgColor, txtColor) {
    let svgClass, svgContent;
    const defaultText = txtColor || '#000';
    if (prob < 20) {
        svgClass = 'sad';
        svgContent = `
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="${bgColor||'#fff'}"/>
            <circle cx="35" cy="40" r="10" fill="${defaultText}"/>
            <circle cx="65" cy="40" r="10" fill="${defaultText}"/>
            <path d="M 35 60 Q 50 70 65 60" fill="none" stroke="${defaultText}" stroke-width="3"/>
          </svg>
        `;
    } else if (prob <= 50) {
        svgClass = 'neutral';
        svgContent = `
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="${bgColor||'#fff'}"/>
            <line x1="30" y1="40" x2="40" y2="40" stroke="${defaultText}" stroke-width="3"/>
            <line x1="60" y1="40" x2="70" y2="40" stroke="${defaultText}" stroke-width="3"/>
            <line x1="35" y1="60" x2="65" y2="60" stroke="${defaultText}" stroke-width="3"/>
          </svg>
        `;
    } else {
        svgClass = 'happy';
        svgContent = `
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="${bgColor||'#fff'}"/>
            <circle cx="35" cy="40" r="10" fill="${defaultText}"/>
            <circle cx="65" cy="40" r="10" fill="${defaultText}"/>
            <path d="M 35 60 Q 50 50 65 60" fill="none" stroke="${defaultText}" stroke-width="3"/>
          </svg>
        `;
    }
    return `<div class="${svgClass}">${svgContent}</div>`;
}

// --------------------
// 放大圖片 (SweetAlert2)
// --------------------
function showEnlargedImage(imgSrc, name) {
    Swal.fire({
        title: name,
        imageUrl: imgSrc,
        imageWidth: enlargedSize,
        imageHeight: enlargedSize,
        imageAlt: name,
        showConfirmButton: false,
        backdrop: true,
        padding: '1em'
    });
}

// --------------------
// 寫入歷史紀錄 (仍存 localStorage)
// --------------------
function saveToHistory(result) {
    let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const now = new Date().toLocaleString();

    history.unshift({ isSeparator: true });
    result.forEach(item => {
        history.unshift({
            name: item.name,
            player: item.player,
            customText: item.customText,
            probability: item.probability,
            textColor: item.textColor,
            bgColor: item.bgColor,
            time: now
        });
    });
    history.unshift({ isSeparator: true });
    if (history.length > 1000) history = history.slice(0,1000);

    try {
        localStorage.setItem("lotteryHistory", JSON.stringify(history));
    } catch(e) {
        if (e.name === "QuotaExceededError") {
            Swal.fire('儲存空間已滿！', '', 'error');
            localStorage.removeItem("lotteryHistory");
            history = [];
        }
    }
}

// --------------------
// 顯示歷史紀錄
// --------------------
function updateHistoryDisplay(query) {
    if (!query) query = "";
    const historyDiv = document.getElementById("history");
    if (!historyDiv) return;

    const allHistory = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let filtered = allHistory;
    if (query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = allHistory.filter(item => {
            if (item.isSeparator) return false;
            return item.player.toLowerCase().includes(q) ||
                   (item.customText || item.name).toLowerCase().includes(q);
        });
    }

    let html = `
        <table class="history-table">
          <thead>
            <tr>
              <th>抽獎者</th>
              <th>獎項</th>
              <th>時間</th>
            </tr>
          </thead>
          <tbody>
    `;
    filtered.forEach(item => {
        if (item.isSeparator) {
            html += `<tr class="separator"><td colspan="3"></td></tr>`;
        } else {
            html += `
                <tr style="color: ${item.textColor || '#333'}">
                  <td>${item.player}</td>
                  <td>${item.customText || item.name}</td>
                  <td>${item.time}</td>
                </tr>
            `;
        }
    });
    html += `</tbody></table>`;
    historyDiv.innerHTML = html;
}
document.getElementById("history-search")?.addEventListener("input", e => {
    updateHistoryDisplay(e.target.value);
});

// --------------------
// 複製歷史紀錄到剪貼簿
// --------------------
function copyHistoryToClipboard() {
    const hist = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let csv = "抽獎者,獎項,時間\n";
    hist.forEach(item => {
        if (!item.isSeparator) {
            csv += `${item.player},${item.customText || item.name},${item.time}\n`;
        }
    });
    navigator.clipboard.writeText(csv).then(()=>{
        Swal.fire('成功！', '歷史紀錄已複製到剪貼簿。', 'success');
    }).catch(()=>{
        Swal.fire('錯誤！', '複製失敗', 'error');
    });
    updateHistoryDisplay();
}
document.getElementById("copy-btn")?.addEventListener("click", copyHistoryToClipboard);

// --------------------
// 匯出歷史紀錄 -> Excel (仍只讀 localStorage)
// --------------------
function exportHistoryToExcel() {
    const hist = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const data = hist.filter(x => !x.isSeparator).map(item => ({
        抽獎者: item.player,
        獎項: item.customText || item.name,
        時間: item.time
    }));
    if (typeof XLSX === "undefined") {
        Swal.fire('缺少 SheetJS', '', 'error');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LotteryHistory");
    XLSX.writeFile(wb, "lottery_history.xlsx");
    Swal.fire('成功！', '歷史紀錄已匯出為 Excel。', 'success');
    updateHistoryDisplay();
}
document.getElementById("export-btn")?.addEventListener("click", exportHistoryToExcel);

// --------------------
// 清空歷史
// --------------------
function clearHistory() {
    Swal.fire({
        title: '確定清空歷史紀錄？',
        text: '此操作無法復原！',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消'
    }).then(r => {
        if (r.isConfirmed) {
            localStorage.removeItem("lotteryHistory");
            updateHistoryDisplay();
            updateStorageSize();
            Swal.fire('歷史紀錄已清空！', '', 'success');
        }
    });
}

// --------------------
// 計算 localStorage 用量 (歷史紀錄 + 其他小型資料)
// --------------------
function updateStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2);
        }
    }
    const kb = (total/1024).toFixed(2);
    const mb = (total/1024/1024).toFixed(2);
    const el = document.getElementById("storage-size");
    if (el) {
        el.textContent = `紀錄使用空間: ${kb} KB (${mb} MB)`;
    }
}

// --------------------
// 調整機率：將 quantity=0 的機率平攤給其他
// --------------------
function adjustProbabilities() {
    const remainProb = prizes.reduce((sum, p) => sum + (p.quantity>0 ? p.probability : 0), 0);
    const active = prizes.filter(p => p.quantity>0);
    if (!active.length) return;

    // 如果有獎項 quantity=0，但他原先 probability>0，則把它分配給其他獎項
    const zeroed = prizes.filter(p => p.quantity===0);
    if (zeroed.length>0) {
        const add = zeroed.reduce((s,z)=> s+z.probability,0) / active.length;
        prizes.forEach(p=> {
            if (p.quantity===0) {
                p.probability = 0;
            } else {
                p.probability += add;
            }
        });
    }
}

// --------------------
// 自動分配機率 (一鍵壓到 100%)
// --------------------
async function distributeProbabilities() {
    const currentTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
    if (currentTotal === 0) return;

    const factor = 100 / currentTotal;
    prizes.forEach(p => {
        if (p.quantity > 0) {
            p.probability = parseFloat((p.probability * factor).toFixed(2));
        } else {
            p.probability = 0;
        }
    });

    let finalTotal = prizes.reduce((sum,p)=> sum + p.probability, 0);
    // 小數誤差 -> 補到 100
    if (finalTotal !== 100) {
        const diff = 100 - finalTotal;
        const active = prizes.filter(x => x.quantity > 0);
        if (active.length) {
            active[0].probability += diff;
        }
    }

    // 在設置彈窗中更新顯示
    refreshPrizeTableInModal();

    // 同步寫回 IndexedDB
    try {
        await saveAllPrizes(prizes);
    } catch(err) {
        console.error('儲存時發生錯誤:', err);
    }
}

// --------------------
// 新增獎項彈窗 (仍以 base64 存圖片)
// --------------------
function showAddPrizeModal() {
    Swal.fire({
        title: '選擇獎項圖片',
        html: `
          <input type="file" id="prize-image" accept=".png,.jpg,.jpeg" style="margin:10px 0;">
          <div>機率(%): <input type="number" id="new-prob" min="0" max="100" value="10" style="margin:10px 0;"></div>
          <div>數量: <input type="number" id="new-qty" min="0" value="5" style="margin:10px 0;"></div>
          <div>顯示文字: <input type="text" id="new-text" placeholder="預設為檔案名稱" style="margin:10px 0;"></div>
          <div>文字顏色: <input type="color" id="text-color" value="#333333" style="margin:10px 0;"></div>
          <div>背景顏色: <input type="color" id="bg-color" value="#ffffff" style="margin:10px 0;"></div>
          <div>顯示模式:
            <select id="display-mode">
              <option value="name">名稱</option>
              <option value="image">圖片</option>
              <option value="all">全部</option>
            </select>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '添加',
        cancelButtonText: '取消',
        preConfirm: () => {
            const fileInput   = document.getElementById("prize-image");
            const probability = parseFloat(document.getElementById("new-prob").value) || 10;
            const quantity    = parseInt(document.getElementById("new-qty").value) || 5;
            const customText  = document.getElementById("new-text").value.trim();
            const textColor   = document.getElementById("text-color").value;
            const bgColor     = document.getElementById("bg-color").value;
            const mode        = document.getElementById("display-mode").value;

            if (!fileInput.files || fileInput.files.length === 0) {
                Swal.fire('請選擇圖片檔案！','', 'warning');
                return false;
            }
            const file = fileInput.files[0];
            const fName = file.name.toLowerCase();
            if (!fName.endsWith('.png') && !fName.endsWith('.jpg') && !fName.endsWith('.jpeg')) {
                Swal.fire('僅支援 .png / .jpg / .jpeg','', 'warning');
                return false;
            }
            const reader = new FileReader();
            return new Promise(resolve => {
                reader.onload = e => {
                    const base64 = e.target.result;
                    const name = file.name.split('.')[0];
                    // 加入 prizes 陣列
                    prizes.push({
                        // 若 keyPath='id'，id 會自動生成，這裡只需存其他欄位
                        name,
                        image: base64,
                        probability,
                        quantity,
                        customText: customText || name,
                        textColor,
                        bgColor,
                        displayMode: mode
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }).then(async (r) => {
        if (r.isConfirmed) {
            // 成功新增後儲存到 IndexedDB
            try {
                await saveAllPrizes(prizes);
                Swal.fire('獎項已添加！','', 'success').then(()=>{
                    refreshPrizeTableInModal();
                });
            } catch(err) {
                console.error('儲存獎項時發生錯誤:', err);
                Swal.fire('錯誤', '儲存時發生錯誤，請嘗試縮小圖片或減少數量。', 'error');
            }
        }
    });
}

// --------------------
// 匯出獎項 -> Excel (不含圖片的 base64)
// --------------------
function exportPrizesToExcel() {
    // 只要把 prizes 陣列中欄位轉成適合 Excel 就好
    const data = prizes.map(p => ({
        名稱: p.name,
        機率: p.probability,
        數量: p.quantity,
        顯示文字: p.customText,
        文字顏色: p.textColor,
        背景顏色: p.bgColor,
        顯示模式: p.displayMode
        // 圖片 p.image 太大，預設不輸出
    }));
    if (typeof XLSX === "undefined") {
        Swal.fire('錯誤','未加載 SheetJS','error');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PrizeSettings");
    XLSX.writeFile(wb, "prizes_settings.xlsx");
    Swal.fire('成功！','獎項已匯出為 Excel。','success');
}

// --------------------
// 匯入獎項 (Excel) -> 只匯入基本資訊，不含圖片
// --------------------
function importPrizesFromExcelUI() {
    Swal.fire({
        title: '匯入 Excel',
        html: `<input type="file" id="prizeFile" accept=".xlsx, .xls" />`,
        showCancelButton: true,
        confirmButtonText: '匯入',
        cancelButtonText: '取消',
        preConfirm: () => {
            const fileInput = document.getElementById("prizeFile");
            if (!fileInput.files || fileInput.files.length === 0) {
                Swal.showValidationMessage('請先選擇檔案！');
                return false;
            }
            return fileInput.files[0];
        }
    }).then(r => {
        if (r.isConfirmed && r.value) {
            handlePrizesFile(r.value);
        }
    });
}
async function handlePrizesFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // 2D array

        const header = jsonData[0];
        if (!header || !header.length) {
            Swal.fire('匯入失敗','Excel 沒有標題列','error');
            return;
        }
        // 找到各欄 index
        const nameIdx   = header.indexOf("名稱");
        const probIdx   = header.indexOf("機率");
        const qtyIdx    = header.indexOf("數量");
        const textIdx   = header.indexOf("顯示文字");
        const txtColorIdx = header.indexOf("文字顏色");
        const bgColorIdx  = header.indexOf("背景顏色");
        const modeIdx     = header.indexOf("顯示模式");

        if (nameIdx < 0 || probIdx < 0 || qtyIdx < 0) {
            Swal.fire('匯入失敗','至少需要「名稱、機率、數量」欄','error');
            return;
        }

        // 清空再重建
        prizes = [];

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row.length) continue;

            const nameVal     = row[nameIdx];
            const probVal     = parseFloat(row[probIdx]) || 0;
            const qtyVal      = parseInt(row[qtyIdx]) || 0;
            const customText  = (textIdx >= 0 && row[textIdx])      ? row[textIdx]      : "";
            const textColor   = (txtColorIdx >= 0 && row[txtColorIdx]) ? row[txtColorIdx] : "#333333";
            const bgColor     = (bgColorIdx >= 0 && row[bgColorIdx])   ? row[bgColorIdx]  : "#ffffff";
            const mode        = (modeIdx >= 0 && row[modeIdx])         ? row[modeIdx]     : "name";

            prizes.push({
                // 如果你的 keyPath='id' 自動增量，這裡不需要 id
                name: String(nameVal),
                image: "", // Excel 不包含圖片
                probability: probVal,
                quantity: qtyVal,
                customText,
                textColor,
                bgColor,
                displayMode: mode
            });
        }
        await saveAllPrizes(prizes);
        adjustProbabilities();
        Swal.fire('成功','已從Excel匯入獎項','success').then(()=>{
            refreshPrizeTableInModal();
        });
    } catch(err) {
        console.error(err);
        Swal.fire('匯入失敗','讀取檔案時發生錯誤','error');
    }
}

// --------------------
// 重新生成獎項表格 (用於後臺管理彈窗內)
// --------------------
function refreshPrizeTableInModal() {
    const tbody = document.getElementById("prize-table-tbody");
    if (!tbody) return;

    tbody.innerHTML = prizes.map((p, i) => {
        return `
          <tr>
            <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
            <td>${p.name}</td>
            <td><input type="number" class="prob-input" min="0" max="100" value="${p.probability}" data-index="${i}"></td>
            <td><input type="number" class="qty-input" min="0" value="${p.quantity}" data-qty-index="${i}"></td>
            <td><input type="text" class="text-input" value="${p.customText || p.name}" data-text-index="${i}"></td>
            <td><input type="color" class="color-input" value="${p.textColor || '#333333'}" data-text-color-index="${i}"></td>
            <td><input type="color" class="color-input" value="${p.bgColor || '#ffffff'}" data-bg-color-index="${i}"></td>
            <td>
              <select data-mode-index="${i}" class="mode-select">
                <option value="name"  ${p.displayMode==='name'?'selected':''}>名稱</option>
                <option value="image" ${p.displayMode==='image'?'selected':''}>圖片</option>
                <option value="all"   ${p.displayMode==='all'  ?'selected':''}>全部</option>
              </select>
            </td>
            <td>
              <!-- 縮小預覽 -->
              <div style="margin-bottom:5px;">
                ${
                    p.image
                    ? `<img src="${p.image}" alt="preview" style="width:40px;height:40px;object-fit:cover;">`
                    : 'N/A'
                }
              </div>
              <button type="button" class="action-btn" style="padding:5px;" onclick="updatePrizeImage(${i})">
                更換圖片
              </button>
            </td>
          </tr>
        `;
    }).join('');

    // 更新「總機率」提示文字
    const tot = prizes.reduce((sum,p)=> sum + (p.quantity>0?p.probability:0),0);
    const warnEl = document.getElementById("probability-warning");
    if(warnEl){
        warnEl.textContent= (tot===100)
          ? "總機率為 100%"
          : `注意：目前總機率為 ${tot.toFixed(2)}%，請調整至 100%`;
    }
}

// --------------------
// 用於更換圖片
// --------------------
function updatePrizeImage(index) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.png,.jpg,.jpeg';

    fileInput.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            // 更新 prizes
            prizes[index].image = ev.target.result; // base64
            try {
                await saveAllPrizes(prizes);
                refreshPrizeTableInModal();
            } catch (err) {
                console.error('更新圖片時發生錯誤:', err);
                Swal.fire('錯誤', '儲存圖片時發生錯誤，請嘗試壓縮圖片。', 'error');
            }
        };
        reader.readAsDataURL(file);
    };
    fileInput.click();
}

// --------------------
// 後臺管理 (設置) 按鈕事件
// --------------------
document.getElementById("settings-btn").addEventListener("click", () => {
    let html = `
        <h3>調整獎項設置</h3>
        <table class="prize-table">
            <thead>
                <tr>
                    <th>選取</th>
                    <th>名稱</th>
                    <th>機率(%)</th>
                    <th>數量</th>
                    <th>顯示文字</th>
                    <th>文字顏色</th>
                    <th>背景顏色</th>
                    <th>顯示模式</th>
                    <th>圖片</th>
                </tr>
            </thead>
            <tbody id="prize-table-tbody">
            </tbody>
        </table>
        <button type="button" onclick="deleteSelectedPrizes()" class="action-btn">刪除選中</button>
        <button type="button" onclick="showAddPrizeModal()" class="action-btn">增加獎池</button>
        <button type="button" onclick="distributeProbabilities()" class="action-btn">自動分配機率</button>
        <button type="button" onclick="importPrizesFromExcelUI()" class="action-btn">匯入獎項</button>
        <button type="button" onclick="exportPrizesToExcel()" class="action-btn">匯出獎項</button>

        <div>縮圖尺寸(px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>
        <div>放大尺寸(px): <input type="number" min="100" max="800" value="${enlargedSize}" id="enlarged-size"></div>
        <p id="probability-warning"></p>
    `;

    Swal.fire({
        html,
        showCancelButton:true,
        confirmButtonText:'保存',
        cancelButtonText:'取消',
        focusConfirm:false,
        width:'900px',
        preConfirm: async () => {
            // 讀取表單
            const probInputs  = document.querySelectorAll(".swal2-modal .prob-input");
            const qtyInputs   = document.querySelectorAll(".swal2-modal .qty-input");
            const textInputs  = document.querySelectorAll(".swal2-modal .text-input");
            const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
            const bgColorInputs   = document.querySelectorAll(".swal2-modal [data-bg-color-index]");
            const modeSelects     = document.querySelectorAll(".swal2-modal .mode-select");

            probInputs.forEach(el=> {
                const idx = el.getAttribute("data-index");
                prizes[idx].probability = parseFloat(el.value)||0;
            });
            qtyInputs.forEach(el=> {
                const idx = el.getAttribute("data-qty-index");
                prizes[idx].quantity = parseInt(el.value)||0;
            });
            textInputs.forEach(el=> {
                const idx = el.getAttribute("data-text-index");
                prizes[idx].customText = el.value.trim()||prizes[idx].name;
            });
            textColorInputs.forEach(el=> {
                const idx = el.getAttribute("data-text-color-index");
                prizes[idx].textColor = el.value;
            });
            bgColorInputs.forEach(el=> {
                const idx = el.getAttribute("data-bg-color-index");
                prizes[idx].bgColor = el.value;
            });
            modeSelects.forEach(el=> {
                const idx= el.getAttribute("data-mode-index");
                prizes[idx].displayMode= el.value;
            });

            // 機率檢查
            const total = prizes.reduce((sum,p)=> sum + p.probability, 0);
            if (Math.round(total) !== 100) {
                Swal.fire('機率總和不等於 100%！','請先「自動分配機率」或自行調整','warning');
                return false;
            }

            // 更新尺寸
            thumbnailSize = parseInt(document.getElementById("thumbnail-size").value)||80;
            enlargedSize  = parseInt(document.getElementById("enlarged-size").value)||300;
            localStorage.setItem("thumbnailSize", thumbnailSize);
            localStorage.setItem("enlargedSize", enlargedSize);
            document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

            // 同步儲存 prizes
            try {
                await saveAllPrizes(prizes);
            } catch(err) {
                console.error('儲存發生錯誤:', err);
                Swal.fire('錯誤', '儲存獎項時發生錯誤，請嘗試縮小圖片或其他方式。', 'error');
                return false;
            }
        }
    }).then(r=>{
        if(r.isConfirmed) {
            Swal.fire('設置已保存！','','success');
        }
    });

    // 彈窗生成後，填充表格
    setTimeout(() => {
        refreshPrizeTableInModal();
    }, 50);
});

// --------------------
// 刪除選中
// --------------------
async function deleteSelectedPrizes() {
    const checks = document.querySelectorAll(".swal2-modal .delete-check:checked");
    const toDelete = Array.from(checks).map(cb => parseInt(cb.getAttribute("data-index")));
    if(!toDelete.length) {
        Swal.showValidationMessage('請至少選中一個獎項！');
        return;
    }
    prizes = prizes.filter((_, i) => !toDelete.includes(i));

    // 更新畫面 & 同步寫回 IndexedDB
    try {
        await saveAllPrizes(prizes);
        refreshPrizeTableInModal();
    } catch (err) {
        console.error('刪除獎項時發生錯誤:', err);
        Swal.fire('錯誤', '寫入資料庫時發生錯誤。', 'error');
    }
}
