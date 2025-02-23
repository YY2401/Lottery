// 奖池，包含名称和图片文件名
const prizes = [
    { name: "1", image: "1/gold.png" },
    { name: "2", image: "2/silver.png" },
    { name: "3", image: "3/bronze.png" },
    { name: "4", image: "4/none.png" },
    { name: "5", image: "5/none.png" },
    { name: "6", image: "6/none.png" },
    { name: "7", image: "7/none.png" },
    { name: "8", image: "8/none.png" },
    { name: "9", image: "9/none.png" },
    { name: "10", image: "10/none.png" },
];

// 抽奖函数
function draw(times) {
    let result = [];
    for (let i = 0; i < times; i++) {
        const randomIndex = Math.floor(Math.random() * prizes.length);
        result.push(prizes[randomIndex]);
    }
    
    // 显示抽奖结果
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = ""; // 清空之前结果
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

// 保存历史记录到 localStorage
function saveToHistory(result) {
    let history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    const timestamp = new Date().toLocaleString();
    result.forEach(item => {
        history.unshift({ name: item.name, image: item.image, time: timestamp }); // 新记录插入开头
    });
    if (history.length > 50) {
        history = history.slice(0, 50); // 保留前50条
    }
    localStorage.setItem("lotteryHistory", JSON.stringify(history));
}

// 更新历史记录显示
function updateHistoryDisplay() {
    const historyDiv = document.getElementById("history");
    const history = JSON.parse(localStorage.getItem("lotteryHistory")) || [];
    historyDiv.innerHTML = ""; // 清空之前内容
    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `<img src="${item.image}" alt="${item.name}"><span>${item.name} - ${item.time}</span>`;
        historyDiv.appendChild(div);
    });
}

// 页面加载时显示历史记录
window.onload = function() {
    updateHistoryDisplay();
};