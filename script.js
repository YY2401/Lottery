// --------------------
// 全域資料
// --------------------
let prizes = [];
let thumbnailSize = 80; // 縮圖尺寸
let enlargedSize = 300; // 放大尺寸

// --------------------
// 載入設定 (onload)
// --------------------
window.onload = () => {
    loadSettings();
    adjustProbabilities();
    updateHistoryDisplay();
};

// 讀取 localStorage
function loadSettings() {
    prizes = JSON.parse(localStorage.getItem("prizes")) || [];
    prizes.forEach(p => {
        if (!p.displayMode) p.displayMode = "name"; // 若舊資料沒有 displayMode
    });
    thumbnailSize = parseInt(localStorage.getItem("thumbnailSize")) || 80;
    enlargedSize  = parseInt(localStorage.getItem("enlargedSize"))  || 300;
    document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

    updateHistoryDisplay();
    updateStorageSize();
}

// --------------------
// 抽獎
// --------------------
function draw(times) {
    const playerName = document.getElementById("player-name").value.trim();
    if (!playerName) {
        Swal.fire('請輸入抽獎者名稱！', '', 'warning');
        return;
    }

    // 計算總機率
    let totalProb = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    if (totalProb <= 0 || !prizes.length) {
        Swal.fire('獎池為空或已抽完！', '請先添加獎項', 'warning');
        return;
    }

    let result = [];
    for (let i = 0; i < times; i++) {
        const rand = Math.random() * totalProb;
        let cumulative = 0;
        for (const p of prizes) {
            if (p.quantity > 0) {
                cumulative += p.probability;
                if (rand <= cumulative) {
                    p.quantity--;
                    result.push({ ...p, player: playerName });
                    adjustProbabilities();
                    totalProb = prizes.reduce((sum, x) => sum + (x.quantity > 0 ? x.probability : 0), 0);
                    break;
                }
            }
        }
    }

    // 先跳出一個視窗顯示結果
    const resultHtml = generateDrawResultHTML(result);
    Swal.fire({
        title: '抽獎結果',
        html: resultHtml,
        confirmButtonText: '確認'
    }).then(() => {
        // 彈窗關閉後，再將結果顯示到畫面 & 寫入歷史紀錄
        showResultOnPage(result);
        saveToHistory(result);
        updateHistoryDisplay();
        updateStorageSize();
    });
}

// --------------------
// 產生抽獎結果清單的 HTML (用於彈窗)
// --------------------
function generateDrawResultHTML(result) {
    // 也可以顯示小圖 or 名稱
    // 這裡大約模擬顯示
    let html = '<div style="text-align:left;">';
    result.forEach((item, idx) => {
        html += `<div style="margin-bottom:8px;">• `;
        // 同樣考慮 displayMode
        if (item.displayMode === "image") {
            if (item.image && item.image.trim() !== "") {
                html += `<img src="${item.image}" style="width:40px; vertical-align:middle;"> `;
            } else {
                html += '[無圖片] ';
            }
        } else if (item.displayMode === "all") {
            if (item.image && item.image.trim() !== "") {
                html += `<img src="${item.image}" style="width:40px; vertical-align:middle;"> `;
            } else {
                html += '[無圖片] ';
            }
            html += (item.customText || item.name);
        } else {
            // "name"
            html += (item.customText || item.name);
        }
        html += '</div>';
    });
    html += '</div>';
    return html;
}

// --------------------
// 把結果顯示到畫面
// --------------------
function showResultOnPage(result) {
    // 先顯示 cat face
    const minProb = result.reduce((min, cur) => cur.probability < min.probability ? cur : min, result[0]);
    document.getElementById("animation-container").innerHTML = getCatFaceSVG(
        minProb.probability, 
        minProb.bgColor, 
        minProb.textColor
    );

    // 塞到 #result 區塊
    const resultDiv = document.getElementById("result");
    if (!resultDiv) return;
    resultDiv.innerHTML = "";
    result.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.style.color = item.textColor || '#333';
        div.style.backgroundColor = item.bgColor || '#fff';

        // 根據 displayMode
        if (item.displayMode === "image") {
            if (item.image && item.image.trim() !== "") {
                div.innerHTML = `<img src="${item.image}" alt="${item.name}">`;
                div.addEventListener("click", () => {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
                div.style.cursor = "pointer";
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
                div.style.cursor = "pointer";
            }
        } else {
            // 預設 "name"
            div.innerHTML = `<div class="result-text">${item.customText || item.name}</div>`;
        }
        resultDiv.appendChild(div);
    });
}

// --------------------
// 顯示放大圖片
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
// 寫入歷史紀錄
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

    if (history.length > 1000) {
        history = history.slice(0, 1000);
    }
    try {
        localStorage.setItem("lotteryHistory", JSON.stringify(history));
    } catch (e) {
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
                <tr style="color:${item.textColor || '#333'}">
                    <td>${item.player}</td>
                    <td>${item.customText || item.name}</td>
                    <td>${item.time}</td>
                </tr>
            `;
        }
    });
    html += '</tbody></table>';
    historyDiv.innerHTML = html;
}
document.getElementById("history-search")?.addEventListener("input", e => {
    updateHistoryDisplay(e.target.value);
});

// --------------------
// 複製歷史紀錄到剪貼簿
// --------------------
function copyHistoryToClipboard() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let csv = "抽獎者,獎項,時間\n";
    history.forEach(item => {
        if (!item.isSeparator) {
            csv += `${item.player},${item.customText || item.name},${item.time}\n`;
        }
    });
    navigator.clipboard.writeText(csv).then(() => {
        Swal.fire('成功！', '歷史紀錄已複製到剪貼簿。', 'success');
    }).catch(() => {
        Swal.fire('錯誤！', '複製失敗，請檢查瀏覽器權限。', 'error');
    });
    updateHistoryDisplay();
}
document.getElementById("copy-btn")?.addEventListener("click", copyHistoryToClipboard);

// --------------------
// 匯出歷史紀錄為 Excel
// --------------------
function exportHistoryToExcel() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const data = history.filter(x => !x.isSeparator).map(item => ({
        抽獎者: item.player,
        獎項: item.customText || item.name,
        時間: item.time
    }));
    if (typeof XLSX === "undefined") {
        Swal.fire('缺少 SheetJS', '無法匯出 Excel', 'error');
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
        text: '此操作無法復原',
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
// 計算並顯示 localStorage 用量
// --------------------
function updateStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2);
        }
    }
    const kb = (total / 1024).toFixed(2);
    const mb = (total / (1024*1024)).toFixed(2);
    const el = document.getElementById("storage-size");
    if (el) {
        el.textContent = `紀錄使用空間: ${kb} KB (${mb} MB)`;
    }
}

// --------------------
// 自動分配機率
// --------------------
function distributeProbabilities() {
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

    let finalTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
    if (finalTotal !== 100) {
        // 小數誤差 → 補到 100
        const diff = 100 - finalTotal;
        const active = prizes.filter(x => x.quantity > 0);
        if (active.length) {
            active[0].probability += diff;
        }
    }

    const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
    probInputs.forEach(el => {
        const idx = el.getAttribute("data-index");
        el.value = prizes[idx].probability.toFixed(2);
    });

    finalTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
    const warnEl = document.getElementById("probability-warning");
    if (warnEl) {
        warnEl.textContent = (finalTotal === 100)
            ? "總機率為 100%"
            : `注意：目前總機率為 ${finalTotal.toFixed(2)}%，請調整至 100%`;
    }
}

// --------------------
// 調整機率（當 quantity=0 時平攤）
// --------------------
function adjustProbabilities() {
    // 若有 quantity=0 的獎項，把機率分給其他
    const totalProb = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    const remain = prizes.filter(p => p.quantity > 0);
    if (!remain.length) return;

    const zeroed = prizes.filter(p => p.quantity === 0);
    if (zeroed.length) {
        const redistributed = zeroed.reduce((s, z) => s + z.probability, 0) / remain.length;
        prizes.forEach(p => {
            if (p.quantity === 0) {
                p.probability = 0;
            } else {
                p.probability += redistributed;
            }
        });
    }
}

// --------------------
// 顯示設置彈窗
// --------------------
document.getElementById("settings-btn").addEventListener("click", () => {
    let html = `
        <h3>調整獎項設置</h3>
        <table class="prize-table">
            <thead>
                <tr>
                    <th>選取</th>
                    <th>名稱</th>
                    <th>機率 (%)</th>
                    <th>數量</th>
                    <th>顯示文字</th>
                    <th>文字顏色</th>
                    <th>背景顏色</th>
                    <th>顯示模式</th>
                </tr>
            </thead>
            <tbody>
    `;

    prizes.forEach((p, i) => {
        html += `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
                <td>${p.name}</td>
                <td><input type="number" class="prob-input" min="0" max="100" value="${p.probability}" data-index="${i}"></td>
                <td><input type="number" class="qty-input" min="0" value="${p.quantity}" data-qty-index="${i}"></td>
                <td><input type="text"   class="text-input" value="${p.customText || p.name}" data-text-index="${i}"></td>
                <td><input type="color"  value="${p.textColor || '#333333'}" data-text-color-index="${i}" class="color-input"></td>
                <td><input type="color"  value="${p.bgColor || '#ffffff'}"  data-bg-color-index="${i}"  class="color-input"></td>
                <td>
                    <select data-mode-index="${i}" class="mode-select">
                        <option value="name"  ${p.displayMode === 'name'  ? 'selected' : ''}>名稱</option>
                        <option value="image" ${p.displayMode === 'image' ? 'selected' : ''}>圖片</option>
                        <option value="all"   ${p.displayMode === 'all'   ? 'selected' : ''}>全部</option>
                    </select>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <button type="button" onclick="deleteSelectedPrizes()" class="action-btn">刪除選中</button>
        <button type="button" onclick="showAddPrizeModal()" class="action-btn">增加獎池</button>
        <!-- 自動分配機率按鈕 -->
        <button type="button" onclick="distributeProbabilities()" class="action-btn">自動分配機率</button>

        <div>縮圖尺寸(px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>
        <div>放大尺寸(px): <input type="number" min="100" max="800" value="${enlargedSize}"  id="enlarged-size"></div>
        <p id="probability-warning"></p>
    `;

    Swal.fire({
        html,
        showCancelButton: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        focusConfirm: false,
        width: '900px',
        preConfirm: () => {
            // 讀取輸入值
            const probInputs  = document.querySelectorAll(".swal2-modal .prob-input");
            const qtyInputs   = document.querySelectorAll(".swal2-modal .qty-input");
            const textInputs  = document.querySelectorAll(".swal2-modal .text-input");
            const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
            const bgColorInputs   = document.querySelectorAll(".swal2-modal [data-bg-color-index]");
            const modeSelects     = document.querySelectorAll(".swal2-modal .mode-select");

            probInputs.forEach(el => {
                const idx = el.getAttribute("data-index");
                prizes[idx].probability = parseFloat(el.value) || 0;
            });
            qtyInputs.forEach(el => {
                const idx = el.getAttribute("data-qty-index");
                prizes[idx].quantity = parseInt(el.value) || 0;
            });
            textInputs.forEach(el => {
                const idx = el.getAttribute("data-text-index");
                prizes[idx].customText = el.value.trim() || prizes[idx].name;
            });
            textColorInputs.forEach(el => {
                const idx = el.getAttribute("data-text-color-index");
                prizes[idx].textColor = el.value;
            });
            bgColorInputs.forEach(el => {
                const idx = el.getAttribute("data-bg-color-index");
                prizes[idx].bgColor = el.value;
            });
            modeSelects.forEach(el => {
                const idx = el.getAttribute("data-mode-index");
                prizes[idx].displayMode = el.value;
            });

            // 檢查機率
            const total = prizes.reduce((sum, p) => sum + p.probability, 0);
            if (total !== 100) {
                Swal.fire({
                    title: '機率總和不等於 100%！',
                    text: '請點「自動分配機率」或自行調整至 100%',
                    icon: 'warning',
                    confirmButtonText: '確定'
                });
                return false;
            }

            // 更新尺寸
            thumbnailSize = parseInt(document.getElementById("thumbnail-size").value) || 80;
            enlargedSize  = parseInt(document.getElementById("enlarged-size").value)  || 300;
            localStorage.setItem("thumbnailSize", thumbnailSize);
            localStorage.setItem("enlargedSize", enlargedSize);
            document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

            // 寫回 localStorage
            localStorage.setItem("prizes", JSON.stringify(prizes));
            adjustProbabilities();
        }
    }).then(r => {
        if (r.isConfirmed) {
            Swal.fire('設置已保存！', '', 'success');
        }
    });

    // 顯示目前總機率
    const total = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    const warn = document.getElementById("probability-warning");
    if (warn) {
        warn.textContent = (total === 100)
            ? "總機率為 100%"
            : `注意：目前總機率為 ${total.toFixed(2)}%，請調整至 100%`;
    }
});

// 刪除選中
function deleteSelectedPrizes() {
    const checks = document.querySelectorAll(".swal2-modal .delete-check:checked");
    const toDelete = Array.from(checks).map(cb => parseInt(cb.getAttribute("data-index")));
    if (!toDelete.length) {
        Swal.showValidationMessage('請至少選中一個獎項！');
        return;
    }
    prizes = prizes.filter((_, i) => !toDelete.includes(i));

    // 重新渲染表格
    const tbody = Swal.getPopup().querySelector(".prize-table tbody");
    if (tbody) {
        tbody.innerHTML = prizes.map((p, i) => `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
                <td>${p.name}</td>
                <td><input type="number" class="prob-input" min="0" max="100" value="${p.probability}" data-index="${i}"></td>
                <td><input type="number" class="qty-input" min="0" value="${p.quantity}" data-qty-index="${i}"></td>
                <td><input type="text"   class="text-input" value="${p.customText || p.name}" data-text-index="${i}"></td>
                <td><input type="color"  value="${p.textColor || '#333333'}"  data-text-color-index="${i}" class="color-input"></td>
                <td><input type="color"  value="${p.bgColor || '#ffffff'}"   data-bg-color-index="${i}"   class="color-input"></td>
                <td>
                    <select data-mode-index="${i}" class="mode-select">
                        <option value="name"  ${p.displayMode === 'name'  ? 'selected' : ''}>名稱</option>
                        <option value="image" ${p.displayMode === 'image' ? 'selected' : ''}>圖片</option>
                        <option value="all"   ${p.displayMode === 'all'   ? 'selected' : ''}>全部</option>
                    </select>
                </td>
            </tr>
        `).join('');
    }
}

// 新增獎項 (彈窗)
function showAddPrizeModal() {
    Swal.fire({
        title: '選擇獎項圖片',
        html: `
            <input type="file" id="prize-image" accept=".png,.jpg" style="margin:10px 0;">
            <div>機率(%): <input type="number" id="new-prob" min="0" max="100" value="10" style="margin:10px 0;"></div>
            <div>數量:   <input type="number" id="new-qty" min="0" value="5"  style="margin:10px 0;"></div>
            <div>顯示文字: <input type="text" id="new-text" placeholder="預設為檔案名稱" style="margin:10px 0;"></div>
            <div>文字顏色: <input type="color" id="text-color" value="#333333" style="margin:10px 0;"></div>
            <div>背景顏色: <input type="color" id="bg-color"   value="#ffffff" style="margin:10px 0;"></div>
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
                Swal.fire('請選擇一個圖片檔案！', '', 'warning');
                return false;
            }
            const file = fileInput.files[0];
            const fName = file.name.toLowerCase();
            if (!fName.endsWith('.png') && !fName.endsWith('.jpg')) {
                Swal.fire('僅支援 .png / .jpg 格式！', '', 'warning');
                return false;
            }

            // 讀取成 Base64
            const reader = new FileReader();
            return new Promise(resolve => {
                reader.onload = e => {
                    const name = file.name.split('.')[0];
                    prizes.push({
                        name,
                        image: e.target.result,
                        probability,
                        quantity,
                        customText: customText || name,
                        textColor,
                        bgColor,
                        displayMode: mode
                    });
                    localStorage.setItem("prizes", JSON.stringify(prizes));
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }).then(r => {
        if (r.isConfirmed) {
            Swal.fire('獎項已添加！', '', 'success');
        }
    });
}

// 自動分配機率 (依比例壓縮至總和=100%)
function distributeProbabilities() {
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

    let finalTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
    // 若因小數誤差 != 100 → 補到 100
    if (finalTotal !== 100) {
        const diff = 100 - finalTotal;
        const active = prizes.filter(x => x.quantity > 0);
        if (active.length) {
            active[0].probability += diff;
        }
    }

    // 更新 Swal 裡的輸入框
    const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
    probInputs.forEach(el => {
        const idx = el.getAttribute("data-index");
        el.value = prizes[idx].probability.toFixed(2);
    });

    finalTotal = prizes.reduce((sum, p) => sum + p.probability, 0);
    const warn = document.getElementById("probability-warning");
    if (warn) {
        warn.textContent = (finalTotal === 100)
            ? "總機率為 100%"
            : `注意：目前總機率為 ${finalTotal.toFixed(2)}%，請調整至 100%`;
    }
}
