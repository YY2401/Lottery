// 奖池，包含名称、图片和默认概率（百分比）
let prizes = [
    { name: "1.jpg", image: "images/1.jpg", probability: 10 }, // 10%
    { name: "2.jpg", image: "images/2.jpg", probability: 10 }, // 10%
    { name: "3.jpg", image: "images/3.jpg", probability: 10 }, // 10%
    { name: "4.jpg", image: "images/4.jpg", probability: 10 }, // 10%
    { name: "5.jpg", image: "images/5.jpg", probability: 10 }, // 10%
    { name: "6.jpg", image: "images/6.jpg", probability: 10 }, // 10%
    { name: "7.jpg", image: "images/7.jpg", probability: 10 }, // 10%
    { name: "8.jpg", image: "images/8.jpg", probability: 10 }, // 10%
    { name: "9.jpg", image: "images/9.jpg", probability: 10 }, // 10%
    { name: "10.jpg", image: "images/10.jpg", probability: 10 }, // 10%
];

// 从 localStorage 加载保存的概率
function loadSavedProbabilities() {
    const saved = JSON.parse(localStorage.getItem("prizeProbabilities"));
    if (saved) {
        prizes.forEach((prize, index) => {
            prize.probability = saved[index] || prize.probability;
        });
    }
}

// 抽奖函数（根据概率）
function draw(times) {
    let result = [];
    const totalProbability = prizes.reduce((sum, prize) => sum + (prize.probability || 0), 0);
    for (let i = 0; i < times; i++) {
        const random = Math.random() * totalProbability;
        let cumulative = 0;
        for (const prize of prizes) {
            cumulative += prize.probability;
            if (random <= cumulative) {
                result.push(prize);
                break;
            }
        }
    }
    
    // 显示抽奖结果
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "";
    result.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.innerHTML = `<img src="${item.image}" alt="${item.name}"><span>${item.name}</span>`;
        resultDiv.appendChild(div);
    });

    // 保存到历史记录
    saveToHistory(result);
    updateHistoryDisplay();
}

// 保存历史记录
function saveToHistory(result) {
    let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const timestamp = new Date().toLocaleString();
    result.forEach(item => {
        history.unshift({ name: item.name, image: item.image, time: timestamp });
    });
    if (history.length > 50) {
        history = history.slice(0, 50);
    }
    localStorage.setItem("lotteryHistory", JSON.stringify(history));
}

// 更新历史记录显示
function updateHistoryDisplay() {
    const historyDiv = document.getElementById("history");
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    historyDiv.innerHTML = "";
    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<img src="${item.image}" alt="${item.name}"><span>${item.name} - ${item.time}</span>`;
        historyDiv.appendChild(div);
    });
}

// 显示设置弹窗
document.getElementById("settings-btn").addEventListener("click", function() {
    const modal = document.getElementById("settings-modal");
    const settingsDiv = document.getElementById("probability-settings");
    settingsDiv.innerHTML = "";
    
    prizes.forEach((prize, index) => {
        const div = document.createElement("div");
        div.innerHTML = `${prize.name}: <input type="number" min="0" max="100" value="${prize.probability}" data-index="${index}"> %`;
        settingsDiv.appendChild(div);
    });

    const total = prizes.reduce((sum, prize) => sum + prize.probability, 0);
    document.getElementById("probability-warning").textContent = 
        total !== 100 ? `注意：目前總機率為 ${total}%，建議調整為 100%` : "";
    
    modal.style.display = "block";
});

// 关闭弹窗
function closeModal() {
    document.getElementById("settings-modal").style.display = "none";
}

// 保存设置
function saveSettings() {
    const inputs = document.querySelectorAll("#probability-settings input");
    let newProbabilities = [];
    inputs.forEach(input => {
        const index = input.getAttribute("data-index");
        const value = parseFloat(input.value) || 0;
        prizes[index].probability = value;
        newProbabilities.push(value);
    });

    localStorage.setItem("prizeProbabilities", JSON.stringify(newProbabilities));
    closeModal();
}

// 页面加载时初始化
window.onload = function() {
    loadSavedProbabilities();
    updateHistoryDisplay();
};