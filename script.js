const prizes = ["金奖", "银奖", "铜奖", "谢谢参与"];

function draw(times) {
    let result = [];
    for (let i = 0; i < times; i++) {
        const randomIndex = Math.floor(Math.random() * prizes.length);
        result.push(prizes[randomIndex]);
    }
    
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = "<h2>抽奖结果：</h2>" + result.join("<br>");
}

document.getElementById("result").innerHTML = "";