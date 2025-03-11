// --------------------
// 初始獎池（LocalStorage 讀取）
// --------------------
let prizes = [];

// 預設縮放尺寸
let thumbnailSize = 80;
let enlargedSize = 300;

// 頁面載入時執行
window.onload = function() {
    loadSettings();
    adjustProbabilities();
    updateHistoryDisplay();
};

// --------------------
// 讀取設置
// --------------------
function loadSettings() {
    prizes = JSON.parse(localStorage.getItem("prizes")) || [];
    if (!prizes || prizes.length === 0) {
        prizes = [];
    }
    thumbnailSize = parseInt(localStorage.getItem("thumbnailSize")) || 80;
    enlargedSize = parseInt(localStorage.getItem("enlargedSize")) || 300;
    document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

    updateHistoryDisplay();
    updateStorageSize();
}

// --------------------
// 抽獎機制
// --------------------
function draw(times) {
    const playerName = document.getElementById("player-name").value.trim();
    if (!playerName) {
        Swal.fire('請輸入抽獎者名稱！', '', 'warning');
        return;
    }

    let result = [];
    let totalProbability = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);

    if (totalProbability <= 0 || prizes.length === 0) {
        Swal.fire('獎池為空或所有獎項已抽完！', '請在設置中添加獎項', 'warning');
        return;
    }

    for (let i = 0; i < times; i++) {
        const random = Math.random() * totalProbability;
        let cumulative = 0;
        for (const p of prizes) {
            if (p.quantity > 0) {
                cumulative += p.probability;
                if (random <= cumulative) {
                    p.quantity -= 1;
                    result.push({ ...p, player: playerName });
                    adjustProbabilities();
                    totalProbability = prizes.reduce((sum, x) => sum + (x.quantity > 0 ? x.probability : 0), 0);
                    break;
                }
            }
        }
    }

    // 顯示抽獎結果到畫面 (不再顯示貓臉表情)
    setTimeout(() => {
        const resultDiv = document.getElementById("result");
        if (resultDiv) {
            resultDiv.innerHTML = "";
            result.forEach(item => {
                const div = document.createElement("div");
                div.className = "result-item";
                div.style.color = item.textColor || '#333';
                div.style.backgroundColor = item.bgColor || '#fff';
                div.innerHTML = `<img src="${item.image}" alt="${item.name}" style="max-width: 100%; height: auto;">`;
                div.addEventListener("click", () => {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
                resultDiv.appendChild(div);
            });
        }
        // 存歷史紀錄
        saveToHistory(result);
        updateHistoryDisplay();
        updateStorageSize();
    }, 200);
}

// --------------------
// 顯示放大圖片
// --------------------
function showEnlargedImage(imageSrc, name) {
    Swal.fire({
        title: name,
        imageUrl: imageSrc,
        imageWidth: enlargedSize,
        imageHeight: enlargedSize,
        imageAlt: name,
        showConfirmButton: false,
        backdrop: true,
        padding: '1em'
    });
}

// --------------------
// 儲存抽獎歷史
// --------------------
function saveToHistory(result) {
    let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const timestamp = new Date().toLocaleString();

    history.unshift({ isSeparator: true });
    result.forEach(item => {
        history.unshift({
            name: item.name,
            player: item.player,
            customText: item.customText,
            probability: item.probability,
            textColor: item.textColor,
            bgColor: item.bgColor,
            time: timestamp
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
            Swal.fire('儲存空間已滿！', '歷史紀錄無法保存，請清空紀錄後重試。', 'error');
            localStorage.removeItem("lotteryHistory");
            history = [];
        }
    }
    updateHistoryDisplay();
    updateStorageSize();
}

// --------------------
// 更新歷史紀錄顯示
// --------------------
function updateHistoryDisplay(searchQuery) {
    if (typeof searchQuery === 'undefined' || searchQuery === null) {
        searchQuery = '';
    }
    const historyDiv = document.getElementById("history");
    if (!historyDiv) return;

    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let filteredHistory = history;

    if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        filteredHistory = history.filter(item => {
            if (item.isSeparator) return false;
            return item.player.toLowerCase().includes(query) ||
                   (item.customText || item.name).toLowerCase().includes(query);
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
    filteredHistory.forEach(item => {
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
    html += '</tbody></table>';
    historyDiv.innerHTML = html;

    // 點擊歷史紀錄可顯示對應圖片
    filteredHistory.forEach((item, index) => {
        if (!item.isSeparator) {
            const row = historyDiv.querySelector(`tbody tr:nth-child(${index+1})`);
            const foundPrize = prizes.find(p => p.name === item.name);
            if (row && foundPrize) {
                row.addEventListener("click", () => {
                    showEnlargedImage(foundPrize.image, item.customText || item.name);
                });
            }
        }
    });

    // 記錄筆數
    const recordCount = history.filter(item => !item.isSeparator).length;
    const recordCountElement = document.getElementById("record-count");
    if (recordCountElement) {
        // recordCountElement.textContent = `歷史紀錄: ${recordCount} 筆`;
    }
}

// --------------------
// 搜尋輸入偵聽
// --------------------
document.getElementById("history-search")?.addEventListener("input", function(e) {
    updateHistoryDisplay(e.target.value);
});

// --------------------
// 計算 localStorage 使用空間
// --------------------
function updateStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2);
        }
    }
    const sizeInKB = (total / 1024).toFixed(2);
    const sizeInMB = (total / (1024 * 1024)).toFixed(2);
    const storageSizeElement = document.getElementById("storage-size");
    if (storageSizeElement) {
        storageSizeElement.textContent = `紀錄使用空間: ${sizeInKB} KB (${sizeInMB} MB)`;
    }
}

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
    }).then(result => {
        if (result.isConfirmed) {
            localStorage.removeItem("lotteryHistory");
            updateHistoryDisplay();
            updateStorageSize();
            Swal.fire('歷史紀錄已清空！', '', 'success');
        }
    });
}

// --------------------
// 複製歷史紀錄到剪貼簿
// --------------------
document.getElementById("copy-btn")?.addEventListener("click", copyHistoryToClipboard);
function copyHistoryToClipboard() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let csvContent = "抽獎者,獎項,時間\n";
    
    history.forEach(item => {
        if (!item.isSeparator) {
            csvContent += `${item.player},${item.customText || item.name},${item.time}\n`;
        }
    });

    navigator.clipboard.writeText(csvContent).then(() => {
        Swal.fire('成功！', '歷史紀錄已複製到剪貼簿，可貼至 Excel。', 'success');
    }).catch(err => {
        Swal.fire('錯誤！', '複製失敗，請檢查瀏覽器權限。', 'error');
    });
    updateHistoryDisplay();
}

// --------------------
// 匯出歷史紀錄為 Excel（可自行移除）
// --------------------
document.getElementById("export-btn")?.addEventListener("click", exportHistoryToExcel);
function exportHistoryToExcel() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const data = history
        .filter(item => !item.isSeparator)
        .map(item => ({
            抽獎者: item.player,
            獎項: item.customText || item.name,
            時間: item.time
        }));

    // 檢查有沒有載入 SheetJS
    if (typeof XLSX === "undefined") {
        Swal.fire('缺少 SheetJS', '請引入 SheetJS 才能匯出 Excel', 'error');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LotteryHistory");
    XLSX.writeFile(wb, "lottery_history.xlsx");
    Swal.fire('成功！', '歷史紀錄已匯出為 Excel 檔案。', 'success');
    updateHistoryDisplay();
}

// --------------------
// 調整機率 (數量=0時重新分攤)
// --------------------
function adjustProbabilities() {
    const totalProbability = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    const remainingPrizes = prizes.filter(p => p.quantity > 0);
    if (remainingPrizes.length === 0) return;

    const zeroed = prizes.filter(p => p.quantity === 0);
    if (zeroed.length > 0) {
        const redistributed = zeroed.reduce((sum, z) => sum + z.probability, 0) / remainingPrizes.length;
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
// 設定頁面（後臺）邏輯
// --------------------
document.getElementById("settings-btn").addEventListener("click", function() {
    let html = `
        <h3>獎項設置</h3>
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
                </tr>
            </thead>
            <tbody>
    `;
    prizes.forEach((p, i) => {
        html += `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
                <td>${p.name}</td>
                <td><input type="number" min="0" max="100" value="${p.probability}" data-index="${i}" class="prob-input"></td>
                <td><input type="number" min="0" value="${p.quantity}" data-qty-index="${i}" class="qty-input"></td>
                <td><input type="text" value="${p.customText || p.name}" data-text-index="${i}" class="text-input"></td>
                <td><input type="color" value="${p.textColor || '#333333'}" data-text-color-index="${i}" class="color-input"></td>
                <td><input type="color" value="${p.bgColor || '#ffffff'}" data-bg-color-index="${i}" class="color-input"></td>
            </tr>
        `;
    });
    html += `
            </tbody>
        </table>

        <button type="button" onclick="deleteSelectedPrizes()" class="action-btn">刪除選中</button>
        <button type="button" onclick="showAddPrizeModal()" class="action-btn">增加獎池</button>
        <div>縮圖尺寸 (px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>
        <div>放大尺寸 (px): <input type="number" min="100" max="800" value="${enlargedSize}" id="enlarged-size"></div>
        <p id="probability-warning"></p>

        <!-- 新增匯入/匯出 ZIP 按鈕 -->
        <button type="button" class="action-btn" onclick="exportDataAsZip()">匯出 ZIP</button>
        <button type="button" class="action-btn" onclick="importDataFromZipUI()">匯入 ZIP</button>
    `;

    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        focusConfirm: false,
        width: '900px',
        preConfirm: () => {
            const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
            const qtyInputs = document.querySelectorAll(".swal2-modal .qty-input");
            const textInputs = document.querySelectorAll(".swal2-modal .text-input");
            const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
            const bgColorInputs = document.querySelectorAll(".swal2-modal [data-bg-color-index]");

            probInputs.forEach(input => {
                const index = input.getAttribute("data-index");
                prizes[index].probability = parseFloat(input.value) || 0;
            });
            qtyInputs.forEach(input => {
                const index = input.getAttribute("data-qty-index");
                prizes[index].quantity = parseInt(input.value) || 0;
            });
            textInputs.forEach(input => {
                const index = input.getAttribute("data-text-index");
                prizes[index].customText = input.value.trim() || prizes[index].name;
            });
            textColorInputs.forEach(input => {
                const index = input.getAttribute("data-text-color-index");
                prizes[index].textColor = input.value;
            });
            bgColorInputs.forEach(input => {
                const index = input.getAttribute("data-bg-color-index");
                prizes[index].bgColor = input.value;
            });

            const total = prizes.reduce((sum, p) => sum + p.probability, 0);
            if (total !== 100) {
                Swal.fire({
                    title: '機率總和不等於 100%！',
                    text: `當前總機率為 ${total.toFixed(2)}%，請自行調整。`,
                    icon: 'warning',
                    confirmButtonText: '確定'
                });
                return false;
            }

            thumbnailSize = parseInt(document.getElementById("thumbnail-size").value) || 80;
            enlargedSize = parseInt(document.getElementById("enlarged-size").value) || 300;

            localStorage.setItem("prizes", JSON.stringify(prizes));
            localStorage.setItem("thumbnailSize", thumbnailSize);
            localStorage.setItem("enlargedSize", enlargedSize);
            document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

            adjustProbabilities();
        }
    }).then(result => {
        if (result.isConfirmed) {
            Swal.fire('設置已保存！', '', 'success');
        }
    });

    const total = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
    const warnEl = document.getElementById("probability-warning");
    if (warnEl) {
        warnEl.textContent = (total === 100) 
            ? "總機率為 100%" 
            : `注意：目前總機率為 ${total.toFixed(2)}%，請調整至 100%`;
    }
});

// --------------------
// 刪除選中獎項
// --------------------
function deleteSelectedPrizes() {
    const checkedBoxes = document.querySelectorAll(".swal2-modal .delete-check:checked");
    const indices = Array.from(checkedBoxes).map(cb => parseInt(cb.getAttribute("data-index")));

    if (indices.length === 0) {
        Swal.showValidationMessage('請至少選中一個獎項！');
        return;
    }

    prizes = prizes.filter((_, i) => !indices.includes(i));

    // 重新渲染 Swal 裡的表格
    const tbody = Swal.getPopup().querySelector(".prize-table tbody");
    if (tbody) {
        tbody.innerHTML = prizes.map((p, i) => `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${i}"></td>
                <td>${p.name}</td>
                <td><input type="number" min="0" max="100" value="${p.probability}" data-index="${i}" class="prob-input"></td>
                <td><input type="number" min="0" value="${p.quantity}" data-qty-index="${i}" class="qty-input"></td>
                <td><input type="text" value="${p.customText || p.name}" data-text-index="${i}" class="text-input"></td>
                <td><input type="color" value="${p.textColor || '#333333'}" data-text-color-index="${i}" class="color-input"></td>
                <td><input type="color" value="${p.bgColor || '#ffffff'}" data-bg-color-index="${i}" class="color-input"></td>
            </tr>
        `).join('');
    }
}

// --------------------
// 新增獎項
// --------------------
function showAddPrizeModal() {
    Swal.fire({
        title: '新增獎項',
        html: `
            <input type="file" id="prize-image" accept=".png,.jpg,.jpeg" style="margin: 10px 0;">
            <div>機率 (%): <input type="number" min="0" max="100" value="10" id="new-prob" style="margin: 10px 0;"></div>
            <div>數量: <input type="number" min="0" value="5" id="new-qty" style="margin: 10px 0;"></div>
            <div>顯示文字: <input type="text" id="new-text" placeholder="預設為檔案名稱" style="margin: 10px 0;"></div>
            <div>文字顏色: <input type="color" id="text-color" value="#333333" style="margin: 10px 0;"></div>
            <div>背景顏色: <input type="color" id="bg-color" value="#ffffff" style="margin: 10px 0;"></div>
        `,
        showCancelButton: true,
        confirmButtonText: '添加',
        cancelButtonText: '取消',
        preConfirm: () => {
            const fileInput = document.getElementById("prize-image");
            const probability = parseFloat(document.getElementById("new-prob").value) || 10;
            const quantity = parseInt(document.getElementById("new-qty").value) || 5;
            const customText = document.getElementById("new-text").value.trim();
            const textColor = document.getElementById("text-color").value;
            const bgColor = document.getElementById("bg-color").value;

            if (!fileInput.files || fileInput.files.length === 0) {
                Swal.fire('請選擇一個圖片檔案！', '', 'warning');
                return false;
            }

            const file = fileInput.files[0];
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.png') && !fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
                Swal.fire('支援 .png / .jpg / .jpeg 格式', '', 'warning');
                return false;
            }

            // 讀取圖片 -> Base64
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => {
                    const name = file.name.split('.')[0];
                    prizes.push({
                        name: name,
                        image: e.target.result,
                        probability: probability,
                        quantity: quantity,
                        customText: customText || name,
                        textColor: textColor,
                        bgColor: bgColor
                    });
                    localStorage.setItem("prizes", JSON.stringify(prizes));
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }).then(result => {
        if (result.isConfirmed) {
            Swal.fire('獎項已添加！', '', 'success');
        }
    });
}

// --------------------
// ZIP 匯出
// --------------------
async function exportDataAsZip() {
    try {
        const zip = new JSZip();
        const imagesFolder = zip.folder("images");

        // 要寫入到 prizes.json 的物件：不放 Base64，改放 "圖片檔名"
        const exportData = [];

        for (let i = 0; i < prizes.length; i++) {
            const p = prizes[i];
            let match = p.image.match(/^data:(image\/\w+);base64,(.*)$/);
            if (!match) {
                // 沒有圖片或不符合 base64
                exportData.push({
                    name: p.name,
                    probability: p.probability,
                    quantity: p.quantity,
                    customText: p.customText,
                    textColor: p.textColor,
                    bgColor: p.bgColor,
                    imageFile: ""
                });
                continue;
            }
            const mimeType = match[1]; // e.g. "image/png"
            const base64Data = match[2];

            // 檔名
            let ext = mimeType.split("/")[1]; // png / jpeg
            let fileName = `${p.name || 'prize'}_${i}.${ext}`;
            const imageBinary = b64ToUint8Array(base64Data);

            imagesFolder.file(fileName, imageBinary);

            exportData.push({
                name: p.name,
                probability: p.probability,
                quantity: p.quantity,
                customText: p.customText,
                textColor: p.textColor,
                bgColor: p.bgColor,
                imageFile: fileName
            });
        }

        zip.file("prizes.json", JSON.stringify(exportData, null, 2));

        const content = await zip.generateAsync({ type: "blob" });
        const blobUrl = URL.createObjectURL(content);

        // 下載
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = "prizes_export.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        Swal.fire("匯出成功", "已產生 ZIP 檔案供下載", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("錯誤", "匯出失敗，請查看主控台", "error");
    }
}

function b64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// --------------------
// ZIP 匯入
// --------------------
function importDataFromZipUI() {
    Swal.fire({
        title: "匯入 ZIP",
        html: `<input type="file" id="zipFile" accept=".zip" />`,
        showCancelButton: true,
        confirmButtonText: "匯入",
        cancelButtonText: "取消",
        preConfirm: () => {
            const fileInput = document.getElementById("zipFile");
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                Swal.showValidationMessage("請先選擇 ZIP 檔！");
                return false;
            }
            return fileInput.files[0];
        }
    }).then(result => {
        if (result.isConfirmed && result.value) {
            handleZipFile(result.value);
        }
    });
}

async function handleZipFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(arrayBuffer);

        const prizesJsonFile = unzipped.file("prizes.json");
        if (!prizesJsonFile) {
            Swal.fire("匯入失敗", "ZIP 中找不到 prizes.json", "error");
            return;
        }

        const prizesJsonText = await prizesJsonFile.async("text");
        const newPrizeData = JSON.parse(prizesJsonText);

        const rebuiltPrizes = [];
        for (let item of newPrizeData) {
            let imageBase64 = "";
            if (item.imageFile) {
                const imageFileInZip = unzipped.file(`images/${item.imageFile}`);
                if (imageFileInZip) {
                    const binaryData = await imageFileInZip.async("uint8array");
                    const mimeType = getMimeType(item.imageFile);
                    const base64Str = uint8ArrayToBase64(binaryData, mimeType);
                    imageBase64 = base64Str;
                }
            }
            // 重建獎項
            rebuiltPrizes.push({
                name: item.name,
                probability: item.probability,
                quantity: item.quantity,
                customText: item.customText,
                textColor: item.textColor,
                bgColor: item.bgColor,
                image: imageBase64
            });
        }

        // 直接覆蓋
        prizes = rebuiltPrizes;
        localStorage.setItem("prizes", JSON.stringify(prizes));
        adjustProbabilities();

        Swal.fire("匯入成功", "已成功從 ZIP 還原獎項資料", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("匯入失敗", "請查看主控台錯誤訊息", "error");
    }
}

function getMimeType(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    switch (ext) {
        case "png":  return "image/png";
        case "jpg":
        case "jpeg": return "image/jpeg";
        case "gif":  return "image/gif";
        default:     return "image/png";
    }
}

function uint8ArrayToBase64(u8arr, mimeType="image/png") {
    let binary = "";
    for (let i = 0; i < u8arr.length; i++) {
        binary += String.fromCharCode(u8arr[i]);
    }
    return `data:${mimeType};base64,` + btoa(binary);
}
