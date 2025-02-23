// 初始獎池（從 localStorage 加載或預設為空）
let prizes = [];

// 默认尺寸
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
}

// 調整機率（當數量歸零時平攤）
function adjustProbabilities() {
    const totalProbability = prizes.reduce((sum, prize) => sum + (prize.quantity > 0 ? prize.probability : 0), 0);
    const remainingPrizes = prizes.filter(prize => prize.quantity > 0);
    if (remainingPrizes.length === 0) return;

    const zeroedPrizes = prizes.filter(prize => prize.quantity === 0);
    if (zeroedPrizes.length > 0) {
        const redistributedProb = zeroedPrizes.reduce((sum, prize) => sum + prize.probability, 0) / remainingPrizes.length;
        prizes.forEach(prize => {
            if (prize.quantity === 0) {
                prize.probability = 0;
            } else {
                prize.probability += redistributedProb;
            }
        });
    }
}

// 抽獎函數
function draw(times) {
    const playerName = document.getElementById("player-name").value.trim();
    if (!playerName) {
        Swal.fire('請輸入抽獎者名稱！', '', 'warning');
        return;
    }

    let result = [];
    let totalProbability = prizes.reduce((sum, prize) => sum + (prize.quantity > 0 ? prize.probability : 0), 0);
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
                    totalProbability = prizes.reduce((sum, p) => sum + (p.quantity > 0 ? p.probability : 0), 0);
                    break;
                }
            }
        }
    }

    const resultDiv = document.getElementById("result");
    if (resultDiv) {
        resultDiv.innerHTML = "";
        result.forEach(item => {
            const div = document.createElement("div");
            div.className = "result-item";
            div.style.color = item.textColor || '#333';
            div.style.backgroundColor = item.bgColor || '#fff';
            div.innerHTML = `<img src="${item.image}" alt="${item.name}"><span>${item.customText || item.name}</span>`;
            div.addEventListener("click", () => showEnlargedImage(item.image, item.customText || item.name));
            resultDiv.appendChild(div);
        });
    }

    saveToHistory(result);
    updateHistoryDisplay();
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

    if (history.length > 50) {
        history = history.slice(0, 50);
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
}

// 更新歷史紀錄顯示
function updateHistoryDisplay() {
    const historyDiv = document.getElementById("history");
    if (historyDiv) {
        const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
        historyDiv.innerHTML = "";
        history.forEach(item => {
            const div = document.createElement("div");
            if (item.isSeparator) {
                div.className = "history-item separator";
            } else {
                div.className = "history-item";
                div.style.color = item.textColor || '#333';
                div.style.backgroundColor = item.bgColor || 'transparent';
                div.innerHTML = `<span>${item.player} 抽到 ${item.customText || item.name} - ${item.time}</span>`;
                const prize = prizes.find(p => p.name === item.name);
                if (prize) {
                    div.addEventListener("click", () => showEnlargedImage(prize.image, item.customText || item.name));
                }
            }
            historyDiv.appendChild(div);
        });
    }
}

// 清空歷史紀錄
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
            Swal.fire('歷史紀錄已清空！', '', 'success');
        }
    });
}

// 增加獎池彈窗
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
        preConfirm: () => {
            const fileInput = document.getElementById("prize-image");
            const probability = parseFloat(document.getElementById("new-prob").value) || 10;
            const quantity = parseInt(document.getElementById("new-qty").value) || 5;
            const customText = document.getElementById("new-text").value.trim();
            const textColor = document.getElementById("text-color").value;
            const bgColor = document.getElementById("bg-color").value;

            if (!fileInput.files || fileInput.files.length === 0) {
                Swal.showValidationMessage('請選擇一個圖片檔案！');
                return;
            }

            const file = fileInput.files[0];
            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith('.png') && !fileName.endsWith('.jpg')) {
                Swal.showValidationMessage('僅支援 .png 或 .jpg 格式！');
                return;
            }

            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onload = (e) => {
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

// 隨機分配機率
function distributeProbabilities() {
    const total = prizes.reduce((sum, prize) => sum + prize.probability, 0);
    if (total >= 100) return;

    const remaining = 100 - total;
    const activePrizes = prizes.filter(p => p.quantity > 0);
    if (activePrizes.length === 0) return;

    const baseIncrement = remaining / activePrizes.length;
    activePrizes.forEach(prize => {
        const randomAdjust = (Math.random() - 0.5) * baseIncrement * 0.2;
        prize.probability += baseIncrement + randomAdjust;
        if (prize.probability < 0) prize.probability = 0;
    });

    const newTotal = prizes.reduce((sum, prize) => sum + prize.probability, 0);
    const adjustment = (100 - newTotal) / activePrizes.length;
    activePrizes.forEach(prize => prize.probability += adjustment);

    document.querySelectorAll(".swal2-modal .prob-input").forEach(input => {
        const index = input.getAttribute("data-index");
        input.value = prizes[index].probability.toFixed(2);
    });

    const updatedTotal = prizes.reduce((sum, prize) => sum + prize.probability, 0);
    document.getElementById("probability-warning").textContent = 
        updatedTotal !== 100 ? `注意：目前總機率為 ${updatedTotal.toFixed(2)}%，已自動調整` : "總機率為 100%";
}

// 顯示設置彈窗
document.getElementById("settings-btn").addEventListener("click", () => {
    let html = '<h3>調整獎項設置</h3>';
    html += '<div class="prize-list">';
    prizes.forEach((prize, index) => {
        html += `
            <div class="prize-item">
                <input type="checkbox" class="delete-check" data-index="${index}">
                ${prize.name}: 
                <input type="number" min="0" max="100" value="${prize.probability}" data-index="${index}" class="prob-input"> % | 
                數量: <input type="number" min="0" value="${prize.quantity}" data-qty-index="${index}" class="qty-input"> | 
                文字: <input type="text" value="${prize.customText || prize.name}" data-text-index="${index}" class="text-input"> | 
                文字顏色: <input type="color" value="${prize.textColor || '#333333'}" data-text-color-index="${index}" class="color-input"> | 
                背景顏色: <input type="color" value="${prize.bgColor || '#ffffff'}" data-bg-color-index="${index}" class="color-input">
            </div>`;
    });
    html += '</div>';
    html += '<button type="button" onclick="deleteSelectedPrizes()" class="action-btn">刪除選中</button>';
    html += '<button type="button" onclick="showAddPrizeModal()" class="action-btn">增加獎池</button>';
    html += '<button type="button" onclick="distributeProbabilities()" class="action-btn">分配機率</button>';
    html += `<div>縮圖尺寸 (px): <input type="number" min="20" max="200" value="${thumbnailSize}" id="thumbnail-size"></div>`;
    html += `<div>放大尺寸 (px): <input type="number" min="100" max="800" value="${enlargedSize}" id="enlarged-size"></div>`;
    html += `<p id="probability-warning"></p>`;

    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        focusConfirm: false,
        width: '1200px',
        preConfirm: () => {
            const probInputs = document.querySelectorAll(".swal2-modal .prob-input");
            const qtyInputs = document.querySelectorAll(".swal2-modal .qty-input");
            const textInputs = document.querySelectorAll(".swal2-modal .text-input");
            const textColorInputs = document.querySelectorAll(".swal2-modal [data-text-color-index]");
            const bgColorInputs = document.querySelectorAll(".swal2-modal [data-bg-color-index]");
            probInputs.forEach(input => {
                const index = input.getAttribute("data-index");
                const value = parseFloat(input.value) || 0;
                prizes[index].probability = value;
            });
            qtyInputs.forEach(input => {
                const index = input.getAttribute("data-qty-index");
                const value = parseInt(input.value) || 0;
                prizes[index].quantity = value;
            });
            textInputs.forEach(input => {
                const index = input.getAttribute("data-text-index");
                const value = input.value.trim();
                prizes[index].customText = value || prizes[index].name;
            });
            textColorInputs.forEach(input => {
                const index = input.getAttribute("data-text-color-index");
                prizes[index].textColor = input.value;
            });
            bgColorInputs.forEach(input => {
                const index = input.getAttribute("data-bg-color-index");
                prizes[index].bgColor = input.value;
            });
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

    const total = prizes.reduce((sum, prize) => sum + (prize.quantity > 0 ? prize.probability : 0), 0);
    document.getElementById("probability-warning").textContent = 
        total !== 100 ? `注意：目前總機率為 ${total}%，可點擊“分配機率”調整` : "總機率為 100%";
});

// 刪除選中獎項
function deleteSelectedPrizes() {
    const checkboxes = document.querySelectorAll(".swal2-modal .delete-check:checked");
    const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute("data-index")));
    if (indicesToDelete.length === 0) {
        Swal.showValidationMessage('請至少選中一個獎項！');
        return;
    }

    prizes = prizes.filter((_, index) => !indicesToDelete.includes(index));
    Swal.getPopup().querySelector(".prize-list").innerHTML = prizes.map((prize, index) => `
        <div class="prize-item">
            <input type="checkbox" class="delete-check" data-index="${index}">
            ${prize.name}: 
            <input type="number" min="0" max="100" value="${prize.probability}" data-index="${index}" class="prob-input"> % | 
            數量: <input type="number" min="0" value="${prize.quantity}" data-qty-index="${index}" class="qty-input"> | 
            文字: <input type="text" value="${prize.customText || prize.name}" data-text-index="${index}" class="text-input"> | 
            文字顏色: <input type="color" value="${prize.textColor || '#333333'}" data-text-color-index="${index}" class="color-input"> | 
            背景顏色: <input type="color" value="${prize.bgColor || '#ffffff'}" data-bg-color-index="${index}" class="color-input">
        </div>
    `).join('');
}

// 暴露全局函數
window.globalFunctions = {
    showAddPrizeModal: showAddPrizeModal,
    deleteSelectedPrizes: deleteSelectedPrizes,
    distributeProbabilities: distributeProbabilities
};

// 頁面加載時初始化
window.onload = function() {
    loadSettings();
    adjustProbabilities();
    updateHistoryDisplay();
};