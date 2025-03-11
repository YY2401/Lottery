// 初始獎池（從 localStorage 加載或預設為空）
let prizes = [];

// 預設縮圖與放大圖尺寸
let thumbnailSize = 80;
let enlargedSize = 300;

// 加載設置
function loadSettings() {
    prizes = JSON.parse(localStorage.getItem("prizes")) || [];
    if (prizes.length === 0) {
        prizes = [];
    }
    thumbnailSize = parseInt(localStorage.getItem("thumbnailSize")) || 80;
    enlargedSize = parseInt(localStorage.getItem("enlargedSize")) || 300;
    document.documentElement.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);

    updateHistoryDisplay(); // 初始顯示歷史紀錄並更新列數
    updateStorageSize();    // 初始顯示 storage 空間
}

// 調整機率（當數量歸零時平攤）
function adjustProbabilities() {
    const totalProbability = prizes.reduce(function(sum, prize) {
        return sum + (prize.quantity > 0 ? prize.probability : 0);
    }, 0);
    const remainingPrizes = prizes.filter(function(prize) {
        return prize.quantity > 0;
    });
    if (remainingPrizes.length === 0) return;

    const zeroedPrizes = prizes.filter(function(prize) {
        return prize.quantity === 0;
    });
    if (zeroedPrizes.length > 0) {
        const redistributedProb = zeroedPrizes.reduce(function(sum, prize) {
            return sum + prize.probability;
        }, 0) / remainingPrizes.length;
        prizes.forEach(function(prize) {
            if (prize.quantity === 0) {
                prize.probability = 0;
            } else {
                prize.probability += redistributedProb;
            }
        });
    }
}

// 根據機率選擇貓臉 SVG 動畫
function getCatFaceSVG(probability, bgColor, textColor) {
    let svgClass, svgContent;
    const defaultTextColor = textColor || '#000';

    if (probability < 20) {
        svgClass = 'sad';
        svgContent = `
            <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="${bgColor || '#fff'}" />
                <circle cx="35" cy="40" r="10" fill="${defaultTextColor}" />
                <circle cx="65" cy="40" r="10" fill="${defaultTextColor}" />
                <path d="M 35 60 Q 50 70 65 60" fill="none" stroke="${defaultTextColor}" stroke-width="3" />
            </svg>
        `;
    } else if (probability <= 50) {
        svgClass = 'neutral';
        svgContent = `
            <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="${bgColor || '#fff'}" />
                <line x1="30" y1="40" x2="40" y2="40" stroke="${defaultTextColor}" stroke-width="3" />
                <line x1="60" y1="40" x2="70" y2="40" stroke="${defaultTextColor}" stroke-width="3" />
                <line x1="35" y1="60" x2="65" y2="60" stroke="${defaultTextColor}" stroke-width="3" />
            </svg>
        `;
    } else {
        svgClass = 'happy';
        svgContent = `
            <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="${bgColor || '#fff'}" />
                <circle cx="35" cy="40" r="10" fill="${defaultTextColor}" />
                <circle cx="65" cy="40" r="10" fill="${defaultTextColor}" />
                <path d="M 35 60 Q 50 50 65 60" fill="none" stroke="${defaultTextColor}" stroke-width="3" />
            </svg>
        `;
    }
    return `<div class="${svgClass}">${svgContent}</div>`;
}

// 抽獎函數
function draw(times) {
    const playerName = document.getElementById("player-name").value.trim();
    if (!playerName) {
        Swal.fire('請輸入抽獎者名稱！', '', 'warning');
        return;
    }

    let result = [];
    let totalProbability = prizes.reduce(function(sum, prize) {
        return sum + (prize.quantity > 0 ? prize.probability : 0);
    }, 0);
    if (totalProbability <= 0 || prizes.length === 0) {
        Swal.fire('獎池為空或所有獎項已抽完！', '請在設置中添加獎項', 'warning');
        return;
    }

    for (let i = 0; i < times; i++) {
        const random = Math.random() * totalProbability;
        let cumulative = 0;
        for (const prize of prizes) {
            if (prize.quantity > 0) {
                cumulative += prize.probability;
                if (random <= cumulative) {
                    prize.quantity -= 1;
                    result.push({ ...prize, player: playerName });
                    adjustProbabilities();
                    totalProbability = prizes.reduce(function(sum, p) {
                        return sum + (p.quantity > 0 ? p.probability : 0);
                    }, 0);
                    break;
                }
            }
        }
    }

    // 以抽到機率最小的獎項來決定貓臉表情
    const minProbPrize = result.reduce(function(min, current) {
        return current.probability < min.probability ? current : min;
    }, result[0]);

    const animationContainer = document.getElementById("animation-container");
    animationContainer.innerHTML = getCatFaceSVG(
        minProbPrize.probability, 
        minProbPrize.bgColor, 
        minProbPrize.textColor
    );

    setTimeout(function() {
        const resultDiv = document.getElementById("result");
        if (resultDiv) {
            resultDiv.innerHTML = "";
            result.forEach(function(item) {
                const div = document.createElement("div");
                div.className = "result-item";
                div.style.color = item.textColor || '#333';
                div.style.backgroundColor = item.bgColor || '#fff';
                div.innerHTML = `<img src="${item.image}" alt="${item.name}" style="max-width: 100%; height: auto;">`;
                div.addEventListener("click", function() {
                    showEnlargedImage(item.image, item.customText || item.name);
                });
                resultDiv.appendChild(div);
            });
        }
        saveToHistory(result);
        updateHistoryDisplay(); // 抽獎後更新歷史紀錄和筆數
        updateStorageSize();    // 更新儲存空間顯示
        animationContainer.innerHTML = '';
    }, 2000);
}

// 顯示放大圖片
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

// 保存歷史紀錄
function saveToHistory(result) {
    let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const timestamp = new Date().toLocaleString();

    // 插入分隔線（可視需求自行調整）
    history.unshift({ isSeparator: true });
    result.forEach(function(item) {
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

    // 控制歷史紀錄最大筆數
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

// 更新歷史紀錄顯示（確保即時更新筆數）
function updateHistoryDisplay(searchQuery) {
    if (typeof searchQuery === 'undefined' || searchQuery === null) {
        searchQuery = '';
    }
    
    const historyDiv = document.getElementById("history");
    if (historyDiv) {
        const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
        let filteredHistory = history;

        // 過濾歷史紀錄
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filteredHistory = history.filter(function(item) {
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
        filteredHistory.forEach(function(item) {
            if (item.isSeparator) {
                html += '<tr class="separator"><td colspan="3"></td></tr>';
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

        // 點擊某筆歷史紀錄，若和獎池的 name 相符，則可放大圖片
        filteredHistory.forEach(function(item, index) {
            if (!item.isSeparator) {
                const row = historyDiv.querySelector(`tbody tr:nth-child(${index + 1})`);
                const prize = prizes.find(function(p) { return p.name === item.name; });
                if (row && prize) {
                    row.addEventListener("click", function() {
                        showEnlargedImage(prize.image, item.customText || item.name);
                    });
                }
            }
        });
    }

    // 更新歷史紀錄列數
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const recordCount = history.filter(function(item) { return !item.isSeparator; }).length;
    const recordCountElement = document.getElementById("record-count");
    if (recordCountElement) {
        // 如需顯示：recordCountElement.textContent = `歷史紀錄: ${recordCount} 筆`;
    }
}

// 監聽搜尋輸入
document.getElementById("history-search")?.addEventListener("input", function(e) {
    const searchQuery = (e.target).value;
    updateHistoryDisplay(searchQuery);
});

// 計算並顯示 localStorage 使用空間
function updateStorageSize() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2); // 每字元約 2 byte
        }
    }
    const sizeInKB = (total / 1024).toFixed(2);
    const sizeInMB = (total / (1024 * 1024)).toFixed(2);
    const storageSizeElement = document.getElementById("storage-size");
    if (storageSizeElement) {
        storageSizeElement.textContent = `紀錄使用空間: ${sizeInKB} KB (${sizeInMB} MB)`;
    }
}

// 複製歷史紀錄到剪貼簿
function copyHistoryToClipboard() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    let csvContent = "抽獎者,獎項,時間\n";
    
    history.forEach(function(item) {
        if (!item.isSeparator) {
            csvContent += `${item.player},${item.customText || item.name},${item.time}\n`;
        }
    });

    navigator.clipboard.writeText(csvContent).then(function() {
        Swal.fire('成功！', '歷史紀錄已複製到剪貼簿，可貼至 Excel。', 'success');
    }).catch(function(err) {
        Swal.fire('錯誤！', '複製失敗，請檢查瀏覽器權限。', 'error');
    });
    updateHistoryDisplay();
}

// 匯出歷史紀錄為 Excel 檔案
function exportHistoryToExcel() {
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const data = history.filter(function(item) { return !item.isSeparator; }).map(function(item) {
        return {
            抽獎者: item.player,
            獎項: item.customText || item.name,
            時間: item.time
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LotteryHistory");
    XLSX.writeFile(wb, "lottery_history.xlsx");
    Swal.fire('成功！', '歷史紀錄已匯出為 Excel 檔案。', 'success');
    updateHistoryDisplay();
}

// 綁定按鈕事件
document.getElementById("copy-btn")?.addEventListener("click", copyHistoryToClipboard);
document.getElementById("export-btn")?.addEventListener("click", exportHistoryToExcel);

// 清空歷史紀錄
function clearHistory() {
    Swal.fire({
        title: '確定清空歷史紀錄？',
        text: '此操作無法復原！',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消'
    }).then(function(result) {
        if (result.isConfirmed) {
            localStorage.removeItem("lotteryHistory");
            updateHistoryDisplay();
            updateStorageSize();
            Swal.fire('歷史紀錄已清空！', '', 'success');
        }
    });
}

// 顯示新增獎項彈窗
function showAddPrizeModal() {
    Swal.fire({
        title: '選擇獎項圖片',
        html: `
            <input type="file" id="prize-image" accept=".png,.jpg" style="margin: 10px 0;">
            <div>機率 (%): <input type="number" min="0" max="100" value="10" id="new-prob" style="margin: 10px 0;"></div>
            <div>數量: <input type="number" min="0" value="5" id="new-qty" style="margin: 10px 0;"></div>
            <div>顯示文字: <input type="text" id="new-text" placeholder="預設為檔案名稱" style="margin: 10px 0;"></div>
            <div>文字顏色: <input type="color" id="text-color" value="#333333" style="margin: 10px 0;"></div>
            <div>背景顏色: <input type="color" id="bg-color" value="#ffffff" style="margin: 10px 0;"></div>
        `,
        showCancelButton: true,
        confirmButtonText: '添加',
        cancelButtonText: '取消',
        preConfirm: function() {
            const fileInput = document.getElementById("prize-image");
            const probability = parseFloat(document.getElementById("new-prob").value) || 10;
            const quantity = parseInt(document.getElementById("new-qty").value) || 5;
            const customText = document.getElementById("new-text").value.trim();
            const textColor = document.getElementById("text-color").value;
            const bgColor = document.getElementById("bg-color").value;

            if (!fileInput.files || fileInput.files.length === 0) {
                Swal.fire('請選擇一個圖片檔案！', '', 'warning');
                return;
            }

            const file = fileInput.files[0];
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.png') && !fileName.endsWith('.jpg')) {
                Swal.fire('僅支援 .png 或 .jpg 格式！', '', 'warning');
                return;
            }

            const reader = new FileReader();
            return new Promise(function(resolve) {
                reader.onload = function(e) {
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
    }).then(function(result) {
        if (result.isConfirmed) {
            Swal.fire('獎項已添加！', '', 'success');
        }
    });
}

// 分配機率讓總和為 100%
function distributeProbabilities() {
    const currentTotal = prizes.reduce(function(sum, prize) {
        return sum + prize.probability;
    }, 0);
    if (currentTotal === 0) return;

    const scaleFactor = 100 / currentTotal;
    prizes.forEach(function(prize) {
        if (prize.quantity > 0) {
            prize.probability = parseFloat((prize.probability * scaleFactor).toFixed(2));
        } else {
            prize.probability = 0;
        }
    });

    const finalTotal = prizes.reduce(function(sum, prize) {
        return sum + prize.probability;
    }, 0);
    if (finalTotal !== 100) {
        const diff = 100 - finalTotal;
        const activePrizes = prizes.filter(function(p) { return p.quantity > 0; });
        if (activePrizes.length > 0) {
            activePrizes[0].probability += diff;
        }
    }

    document.querySelectorAll(".swal2-modal .prob-input").forEach(function(input) {
        const index = input.getAttribute("data-index");
        input.value = prizes[index].probability.toFixed(2);
    });

    const updatedTotal = prizes.reduce(function(sum, prize) {
        return sum + prize.probability;
    }, 0);
    document.getElementById("probability-warning").textContent = 
        updatedTotal === 100
            ? "總機率為 100%"
            : `注意：目前總機率為 ${updatedTotal.toFixed(2)}%，請調整至 100%`;
}

// 按比例調整機率至 100%
function adjustProbabilitiesTo100() {
    const currentTotal = prizes.reduce(function(sum, prize) {
        return sum + prize.probability;
    }, 0);
    if (currentTotal === 0) return;

    const scaleFactor = 100 / currentTotal;
    prizes.forEach(function(prize) {
        if (prize.quantity > 0) {
            prize.probability = parseFloat((prize.probability * scaleFactor).toFixed(2));
        } else {
            prize.probability = 0;
        }
    });

    const finalTotal = prizes.reduce(function(sum, prize) {
        return sum + prize.probability;
    }, 0);
    if (finalTotal !== 100) {
        const diff = 100 - finalTotal;
        const activePrizes = prizes.filter(function(p) { return p.quantity > 0; });
        if (activePrizes.length > 0) {
            activePrizes[0].probability += diff;
        }
    }

    document.querySelectorAll(".swal2-modal .prob-input").forEach(function(input) {
        const index = input.getAttribute("data-index");
        input.value = prizes[index].probability.toFixed(2);
    });
}

// 刪除選中獎項
function deleteSelectedPrizes() {
    const checkboxes = document.querySelectorAll(".swal2-modal .delete-check:checked");
    const indicesToDelete = Array.from(checkboxes).map(function(cb) {
        return parseInt(cb.getAttribute("data-index"));
    });
    if (indicesToDelete.length === 0) {
        Swal.showValidationMessage('請至少選中一個獎項！');
        return;
    }

    prizes = prizes.filter(function(_, index) {
        return !indicesToDelete.includes(index);
    });
    Swal.getPopup().querySelector(".prize-table tbody").innerHTML = prizes.map(function(prize, index) {
        return `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${index}"></td>
                <td>${prize.name}</td>
                <td><input type="number" min="0" max="100" value="${prize.probability}" data-index="${index}" class="prob-input"></td>
                <td><input type="number" min="0" value="${prize.quantity}" data-qty-index="${index}" class="qty-input"></td>
                <td><input type="text" value="${prize.customText || prize.name}" data-text-index="${index}" class="text-input"></td>
                <td><input type="color" value="${prize.textColor || '#333333'}" data-text-color-index="${index}" class="color-input"></td>
                <td><input type="color" value="${prize.bgColor || '#ffffff'}" data-bg-color-index="${index}" class="color-input"></td>
            </tr>
        `;
    }).join('');
}

// --- 新增：匯出獎池設定 ---
function exportPrizesToExcel() {
    // 將目前的 prizes 轉成適合匯出的物件陣列
    const data = prizes.map(prize => ({
        名稱: prize.name,
        機率: prize.probability,
        數量: prize.quantity,
        顯示文字: prize.customText || "",
        文字顏色: prize.textColor || "#333333",
        背景顏色: prize.bgColor || "#ffffff"
        // 若要包含圖片，可加上 imageBase64: prize.image
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PrizeSettings");
    XLSX.writeFile(wb, "prizes_settings.xlsx");
    Swal.fire('成功！', '設定已匯出為 Excel 檔案。', 'success');
}

// --- 新增：顯示匯入介面 ---
function importPrizesFromExcelUI() {
    Swal.fire({
        title: '匯入 Excel',
        html: `
            <input type="file" id="prizeFile" accept=".xlsx, .xls" />
            <p style="font-size:14px;color:#666;">請選擇包含「名稱、機率、數量、顯示文字、文字顏色、背景顏色」欄位的Excel</p>
        `,
        showCancelButton: true,
        confirmButtonText: '匯入',
        cancelButtonText: '取消',
        preConfirm: () => {
            const fileInput = document.getElementById("prizeFile");
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                Swal.showValidationMessage('請先選擇檔案！');
                return false;
            }
            return fileInput.files[0];
        }
    }).then(result => {
        if (result.isConfirmed && result.value) {
            const file = result.value;
            handlePrizesFile(file);
        }
    });
}

// --- 新增：讀取上傳的 Excel 並更新 prizes ---
function handlePrizesFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            // 只讀第一個工作表
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // jsonData[0] 通常是標題列
            let headerRow = jsonData[0];
            if (!headerRow || headerRow.length === 0) {
                Swal.fire('匯入失敗！', 'Excel 格式不正確或沒有標題列。', 'error');
                return;
            }
            // 找出欄位索引
            const nameIndex = headerRow.indexOf("名稱");
            const probIndex = headerRow.indexOf("機率");
            const qtyIndex  = headerRow.indexOf("數量");
            const textIndex = headerRow.indexOf("顯示文字");
            const txtColorIndex = headerRow.indexOf("文字顏色");
            const bgColorIndex  = headerRow.indexOf("背景顏色");

            if (nameIndex === -1 || probIndex === -1 || qtyIndex === -1) {
                Swal.fire('匯入失敗！', 'Excel 欄位至少要有「名稱、機率、數量」。', 'error');
                return;
            }

            // 清空原獎項（或自行考慮是否要合併）
            prizes = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                const nameVal     = row[nameIndex];
                const probVal     = parseFloat(row[probIndex]) || 0;
                const qtyVal      = parseInt(row[qtyIndex]) || 0;
                const customText  = (textIndex >= 0 && row[textIndex]) ? row[textIndex] : "";
                const textColor   = (txtColorIndex >= 0 && row[txtColorIndex]) ? row[txtColorIndex] : "#333333";
                const bgColor     = (bgColorIndex  >= 0 && row[bgColorIndex])  ? row[bgColorIndex]  : "#ffffff";

                prizes.push({
                    name: String(nameVal),
                    probability: probVal,
                    quantity: qtyVal,
                    customText: customText,
                    textColor: textColor,
                    bgColor: bgColor,
                    image: "" // 可加預設圖片或空值
                });
            }

            localStorage.setItem("prizes", JSON.stringify(prizes));
            adjustProbabilities();
            Swal.fire('成功！', '已從 Excel 匯入設定。', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('匯入失敗！', '讀取檔案時發生錯誤，請確認 Excel 格式。', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 顯示「設置」彈窗
document.getElementById("settings-btn").addEventListener("click", function() {
    let html = '<h3>調整獎項設置</h3>';
    html += `
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

    prizes.forEach(function(prize, index) {
        html += `
            <tr>
                <td><input type="checkbox" class="delete-check" data-index="${index}"></td>
                <td>${prize.name}</td>
                <td><input type="number" min="0" max="100" value="${prize.probability}" data-index="${index}" class="prob-input"></td>
                <td><input type="number" min="0" value="${prize.quantity}" data-qty-index="${index}" class="qty-input"></td>
                <td><input type="text" value="${prize.customText || prize.name}" data-text-index="${index}" class="text-input"></td>
                <td><input type="color" value="${prize.textColor || '#333333'}" data-text-color-index="${index}" class="color-input"></td>
                <td><input type="color" value="${prize.bgColor || '#ffffff'}" data-bg-color-index="${index}" class="color-input"></td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <button type="button" onclick="deleteSelectedPrizes()" class="action-btn">刪除選中</button>
        <button type="button" onclick="showAddPrizeModal()" class="action-btn">增加獎池</button>
        <button type="button" onclick="distributeProbabilities()" class="action-btn">分配機率</button>
        <div>縮圖尺寸 (px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>
        <div>放大尺寸 (px): <input type="number" min="100" max="800" value="${enlargedSize}" id="enlarged-size"></div>
        <p id="probability-warning"></p>
        <!-- 新增匯出/匯入設定按鈕 -->
        <button type="button" onclick="exportPrizesToExcel()" class="action-btn">匯出設定</button>
        <button type="button" onclick="importPrizesFromExcelUI()" class="action-btn">匯入設定</button>
    `;

    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        focusConfirm: false,
        width: '900px',
        preConfirm: function() {
            const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
            const qtyInputs = document.querySelectorAll(".swal2-modal .qty-input");
            const textInputs = document.querySelectorAll(".swal2-modal .text-input");
            const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
            const bgColorInputs = document.querySelectorAll(".swal2-modal [data-bg-color-index]");

            probInputs.forEach(function(input) {
                const index = input.getAttribute("data-index");
                prizes[index].probability = parseFloat(input.value) || 0;
            });
            qtyInputs.forEach(function(input) {
                const index = input.getAttribute("data-qty-index");
                prizes[index].quantity = parseInt(input.value) || 0;
            });
            textInputs.forEach(function(input) {
                const index = input.getAttribute("data-text-index");
                prizes[index].customText = input.value.trim() || prizes[index].name;
            });
            textColorInputs.forEach(function(input) {
                const index = input.getAttribute("data-text-color-index");
                prizes[index].textColor = input.value;
            });
            bgColorInputs.forEach(function(input) {
                const index = input.getAttribute("data-bg-color-index");
                prizes[index].bgColor = input.value;
            });

            const total = prizes.reduce(function(sum, prize) {
                return sum + prize.probability;
            }, 0);
            if (total !== 100) {
                Swal.fire({
                    title: '機率總和不等於 100%！',
                    text: `當前總機率為 ${total.toFixed(2)}%，請點擊「分配機率」按鈕或自行調整。`,
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
    }).then(function(result) {
        if (result.isConfirmed) {
            Swal.fire('設置已保存！', '', 'success');
        }
    });

    // 顯示當前機率總和提示
    const total = prizes.reduce(function(sum, prize) {
        return sum + (prize.quantity > 0 ? prize.probability : 0);
    }, 0);
    document.getElementById("probability-warning").textContent = 
        total === 100
            ? "總機率為 100%"
            : `注意：目前總機率為 ${total.toFixed(2)}%，請調整至 100%`;
});

// 頁面加載時初始化
window.onload = function() {
    loadSettings();
    adjustProbabilities();
    updateHistoryDisplay();
};

// 暴露全域函式（若有需要）
window.globalFunctions = {
    showAddPrizeModal: showAddPrizeModal,
    deleteSelectedPrizes: deleteSelectedPrizes,
    distributeProbabilities: distributeProbabilities,
    adjustProbabilitiesTo100: adjustProbabilitiesTo100
};
