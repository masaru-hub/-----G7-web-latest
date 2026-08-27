// --- kizuna-resonance.js: 絆の視覚化エンジン ---

window.drawKizunaResonance = function() {
    if (!ganttChart) return;

    // 1. 絆専用のオーバーレイキャンバスを作成/取得
    let kCanvas = document.getElementById('kizuna-layer');
    const container = document.querySelector('.gantt-container');
    
    if (!kCanvas && container) {
        kCanvas = document.createElement('canvas');
        kCanvas.id = 'kizuna-layer';
        kCanvas.style.position = 'absolute';
        kCanvas.style.top = '10px'; // コンテナのパディングに合わせる
        kCanvas.style.left = '10px';
        kCanvas.style.pointerEvents = 'none';
        kCanvas.style.zIndex = '10';
        container.style.position = 'relative';
        container.appendChild(kCanvas);
    }

    if (!kCanvas) return;

    const ctx = kCanvas.getContext('2d');
    const chartCanvas = ganttChart.canvas;
    
    // チャートの解像度に合わせる
    kCanvas.width = chartCanvas.width;
    kCanvas.height = chartCanvas.height;
    kCanvas.style.width = chartCanvas.style.width;
    kCanvas.style.height = chartCanvas.style.height;

    const xAxis = ganttChart.scales.x;
    const yAxis = ganttChart.scales.y;

    // 2. 全タスクのリストを抽出
    const allTasks = [];
    const day = getDayData(selectedDate);
    
    // 実績(tasks)と予定(plans)から、描画範囲内のものを抽出
    ['tasks', 'plans'].forEach(key => {
        const isPlan = (key === 'plans');
        day[key].forEach(t => {
            const sDec = timeToDec(t.start);
            let eDec = timeToDec(t.end);
            if (eDec <= sDec) eDec += 24;

            // 描画範囲外ならスキップ
            if (eDec < xAxis.min || sDec > xAxis.max) return;

            allTasks.push({
                worker: t.worker,
                name: (t.name || "").trim(),
                isPlan: isPlan,
                startX: xAxis.getPixelForValue(sDec),
                endX: xAxis.getPixelForValue(eDec),
                y: yAxis.getPixelForValue(t.worker.replace(/ \[.*?\]$/, ''))
            });
        });
    });

    // 3. 重なり判定と描画
    ctx.clearRect(0, 0, kCanvas.width, kCanvas.height);
    
    for (let i = 0; i < allTasks.length; i++) {
        for (let j = i + 1; j < allTasks.length; j++) {
            const t1 = allTasks[i];
            const t2 = allTasks[j];

            if (t1.worker === t2.worker) continue; // 同一人物はスキップ
            if (t1.name === '休憩' || t2.name === '休憩') continue; // 休憩は絆に含めない

            // 時間の重なり判定（ピクセルベース）
            const overlapStart = Math.max(t1.startX, t2.startX);
            const overlapEnd = Math.min(t1.endX, t2.endX);

            if (overlapStart < overlapEnd) {
                // 🌟 絆の描画（共鳴レベルの判定）
                const isStrongBond = (t1.name === t2.name && t1.name !== ""); 
                const color = isStrongBond ? 'rgba(245, 158, 11, 0.6)' : 'rgba(14, 165, 233, 0.25)';
                const blur = isStrongBond ? 12 : 4;
                const lineWidth = isStrongBond ? 2.5 : 1;

                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.shadowBlur = blur;
                ctx.shadowColor = color;

                // 重なりの中心点を計算
                const xPos = (overlapStart + overlapEnd) / 2;
                
                // 有機的な曲線を引く
                ctx.moveTo(xPos, t1.y);
                const cpY = (t1.y + t2.y) / 2;
                // わずかに横に膨らませることで「絆の膨らみ」を演出
                const offsetX = isStrongBond ? 10 : 5;
                ctx.bezierCurveTo(xPos + offsetX, cpY, xPos + offsetX, cpY, xPos, t2.y);
                
                ctx.stroke();
                ctx.restore();

                // 強い絆なら、交点に「共鳴の火花」を添える
                if (isStrongBond && Math.random() > 0.8) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(xPos, cpY, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
};
