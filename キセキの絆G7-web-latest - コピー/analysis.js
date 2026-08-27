// --- analysis.js: マスタ・パターン・分析・集計・ポータル ---

// お気に入り登録の魔法
window.toggleFavorite = function(name) { 
    if(!data.favorites) data.favorites = [];
    const idx = data.favorites.indexOf(name); 
    if (idx > -1) data.favorites.splice(idx, 1); 
    else if (data.favorites.length < 6) data.favorites.push(name); 
    saveAndRefresh(); 
};

// 【新設】結果入力設定の魔法
window.toggleResultRequired = function(name) {
    if(!data.resultRequiredTasks) data.resultRequiredTasks = [];
    const idx = data.resultRequiredTasks.indexOf(name);
    if (idx > -1) data.resultRequiredTasks.splice(idx, 1);
    else data.resultRequiredTasks.push(name);
    saveAndRefresh();
};

// マスタ管理（通常・ポータル共通ロジック）
window.addMaster = function(type, isPortal = false) { 
    const prefix = isPortal ? 'p-' : '';
    if(type === 'worker') { 
        const nI = document.getElementById(prefix + 'new-worker'), idI = document.getElementById(prefix + 'new-worker-id');
        const n = nI.value.trim(), id = idI ? idI.value.trim() : ''; 
        if(n) {
            if (id && data.masterWorkers.some(w => w.includes(`[${id}]`))) return alert(`ID [${id}] は既に使われているよ！別の番号にしてね。🧠✨`);
            data.masterWorkers.push(id ? `${n} [${id}]` : n); nI.value = ''; if(idI) idI.value = ''; 
        }
    } else { 
        const vI = document.getElementById(prefix + 'new-' + type), v = vI.value.trim(); 
        if(v) { if(type === 'task') data.masterTasks.push(v); else data.masterSpecials.push(v); vI.value = ''; } 
    }
    saveAndRefresh(); 
    if(isPortal) renderPortalContent(type === 'worker' ? 'workers' : 'tasks');
};

window.removeMaster = function(type, i) { 
    let msg = "一度整理してもいいかな？✨", successMsg = "整理が完了しました。🌌", icon = '✨';
    if(type === 'worker') { msg = "このスタッフとお別れする？😢👋"; successMsg = "また会う日まで！🕊️✨"; icon = '👋'; }
    else if(type === 'task') { msg = "お仕事を整理してもいいかな？📝✨"; successMsg = "整理完了！🧹✨"; icon = '🧹'; }
    if(confirm(msg)) { 
        if(type === 'worker') data.masterWorkers.splice(i,1); else if(type === 'task') data.masterTasks.splice(i,1); else data.masterSpecials.splice(i,1); 
        saveAndRefresh(); showToast(successMsg, icon); 
        const portal = document.getElementById('large-guide-modal');
        if(portal && portal.style.display === 'flex') {
            const t = document.getElementById('guide-title')?.innerText || '';
            if(t.includes('スタッフ')) renderPortalContent('workers');
            else if(t.includes('お仕事')) renderPortalContent('tasks');
        }
    } 
};

// パターン魔法
let openedFromPortal = false;
window.openPatternModal = function(id = null, fromPortal = false) {
    openedFromPortal = fromPortal;
    editingPatternId = id; document.getElementById('pattern-modal').style.display = 'flex';
    const nI = document.getElementById('edit-pattern-name'), c = document.getElementById('pattern-steps-container');
    c.innerHTML = ''; 
    if (id) { const p = (data.workPatterns || []).find(t => t.id === id); if(p) { nI.value = p.name; p.plans.forEach(s => addPatternStep(s.start, s.end, s.name)); } }
    else { nI.value = ''; addPatternStep(); }
};
window.closePatternModal = () => {
    document.getElementById('pattern-modal').style.display = 'none';
    if(openedFromPortal) { document.getElementById('large-guide-modal').style.display = 'flex'; openMasterManagement('patterns'); }
    lucide.createIcons();
};
window.addPatternStep = (s='08:00', e='17:00', t='') => {
    const div = document.createElement('div'); div.className='pattern-step-row'; div.style='display:flex; gap:4px; margin-bottom:8px;';
    div.innerHTML=`<input type="time" class="step-start" value="${s}" style="flex:1; min-width:0;"><input type="time" class="step-end" value="${e}" style="flex:1; min-width:0;"><select class="step-task" style="flex:2; min-width:0;">${data.masterTasks.map(tn=>`<option value="${tn}" ${tn===t?'selected':''}>${tn}</option>`).join('')}</select><button type="button" onclick="this.parentElement.remove()" style="background:var(--danger); color:white; border:none; padding:4px 8px; width:32px; flex-shrink:0;">×</button>`;
    document.getElementById('pattern-steps-container').appendChild(div);
};
window.savePattern = function() { 
    const n = document.getElementById('edit-pattern-name').value.trim(); if (!n) return alert("この魔法（パターン）に名前をつけてあげてね！🧩✨");
    const steps = []; document.querySelectorAll('.pattern-step-row').forEach(r => steps.push({start:r.querySelector('.step-start').value, end:r.querySelector('.step-end').value, name:r.querySelector('.step-task').value})); 
    if(!data.workPatterns) data.workPatterns = [];
    if(editingPatternId) data.workPatterns[data.workPatterns.findIndex(t=>t.id===editingPatternId)] = {id:editingPatternId, name:n, plans:steps}; 
    else data.workPatterns.push({id:Date.now(), name:n, plans:steps}); 
    saveAndRefresh(); closePatternModal(); showToast(`魔法のパターン「${n}」を記憶したよ！🧩✨`, '🪄');
};

window.applyPattern = async function(id) { 
    const pat = (data.workPatterns || []).find(t=>t.id===id), 
          wEl = document.getElementById('worker-select'),
          w = wEl ? wEl.value : '', 
          d = getDayData(selectedDate), 
          threshold = data.config.breakThreshold || 6, 
          breakHrs = (data.config.breakDuration || 60) / 60;
    if(!pat) return;

    const applyToWorker = (plans, worker) => {
        const newPlans = [];
        let currentBaseDate = selectedDate;
        let lastEndDec = -1;

        plans.forEach(p => {
            const sDec = timeToDec(p.start);
            let eDec = timeToDec(p.end);
            
            if (lastEndDec !== -1 && sDec < lastEndDec) {
                currentBaseDate = getNextDate(currentBaseDate);
            }
            
            let tempEDec = eDec;
            if (eDec <= sDec) tempEDec += 24;
            const duration = tempEDec - sDec;

            if (duration >= threshold) {
                const bs = sDec + 4, be = bs + breakHrs;
                const f = (v) => { 
                    const h = Math.floor(v % 24), m = Math.round((v % 1) * 60); 
                    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`; 
                };
                newPlans.push(createPlan(p.name, p.start, f(bs), worker, currentBaseDate));
                let bBaseDate = (bs >= 24) ? getNextDate(currentBaseDate) : currentBaseDate;
                newPlans.push(createPlan('休憩', f(bs), f(be), worker, bBaseDate));
                let afterBaseDate = (be >= 24) ? getNextDate(currentBaseDate) : currentBaseDate;
                if (tempEDec > be) {
                    newPlans.push(createPlan(p.name, f(be), p.end, worker, afterBaseDate));
                }
            } else {
                newPlans.push(createPlan(p.name, p.start, p.end, worker, currentBaseDate));
            }
            if (eDec <= sDec) currentBaseDate = getNextDate(currentBaseDate);
            lastEndDec = eDec;
        });
        return newPlans;
    };

    const createPlan = (name, start, end, worker, baseDate) => {
        const sDec = timeToDec(start), eDec = timeToDec(end);
        const sISO = toISO(baseDate, start); 
        let eD = baseDate; 
        if (eDec <= sDec) eD = getNextDate(baseDate);
        const eISO = toISO(eD, end); 
        return { name, start, end, worker, startISO:sISO, endISO:eISO, duration:getDiffHrs(sISO, eISO), target:'', remark:'' };
    };

    if(w) { 
        if(!confirm(w.replace(/ \[.*?\]$/, '') + "さんに魔法をかけてもいいかな？🪄✨")) return; 
        
        // 🌟 【進化】既存の予定をクリーンアップ（Firestore）
        if (window.kizunaRepo) {
            const oldPlans = d.plans.filter(p => p.worker === w);
            for (const oldP of oldPlans) {
                if (oldP.id) await window.kizunaRepo.deleteTask(selectedDate, 'plans', oldP.id);
            }
        }

        d.plans = d.plans.filter(p=>p.worker!==w); 
        const newPlans = applyToWorker(pat.plans, w);
        
        // 🌟 新しい予定を保存（Firestore）
        if (window.kizunaRepo) {
            for (const newP of newPlans) {
                await window.kizunaRepo.upsertTask(selectedDate, 'plans', newP);
            }
        }
        newPlans.forEach(p => d.plans.push(p)); 
        showToast(`${w.replace(/ \[.*?\]$/, '')}さんの未来に魔法をかけました！🪄✨`, '✨');
    } else { 
        if(!confirm("チーム全員に一斉魔法をかけてもいいかな？🌊✨")) return; 
        
        // 🌟 【進化】全員の予定を一掃
        if (window.kizunaRepo) {
            for (const oldP of d.plans) {
                if (oldP.id) await window.kizunaRepo.deleteTask(selectedDate, 'plans', oldP.id);
            }
        }

        d.plans = []; 
        const allNewPlans = [];
        data.masterWorkers.forEach(mw => {
            const plans = applyToWorker(pat.plans, mw);
            allNewPlans.push(...plans);
        });

        // 🌟 全員の新しい予定を保存
        if (window.kizunaRepo) {
            for (const newP of allNewPlans) {
                await window.kizunaRepo.upsertTask(selectedDate, 'plans', newP);
            }
        }
        allNewPlans.forEach(p => d.plans.push(p));
        showToast("チーム全員の未来に一斉魔法をかけました！🌊✨", '✨');
    } 

    // 🌟 第1段階：マスターデータ等の整合性を取る
    await saveAndRefresh('master'); 
    
    // 🌟 第2段階：【完全清浄】魔法のスイッチをオンにしてUIをリフレッシュ
    window.forceResetWorker = true; // スタッフ選択をリセットするフラグ
    
    const fields = ['task-input', 'start-time', 'end-time', 'target-input', 'remark-input'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    // 表示ラベルのリセット
    const dWorker = document.getElementById('display-worker'),
          dTask = document.getElementById('display-task');
    if(dWorker) dWorker.innerText = "スタッフを選択 👤";
    if(dTask) dTask.innerText = "お仕事を選択 📝";

    if(typeof renderUI === 'function') renderUI();
};

// 分析・統計
window.openRatioModal = () => { document.getElementById('analysis-worker-select').innerHTML = '<option value="all">全員合計</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join(''); document.getElementById('ratio-modal').style.display = 'flex'; updateRatioChart(); };
window.closeRatioModal = () => document.getElementById('ratio-modal').style.display = 'none';
window.updateRatioChart = function() {
    const target = document.getElementById('analysis-worker-select').value, day = getDayData(selectedDate), tasks = day.tasks.filter(t => target === 'all' || t.worker === target), sum = {}; let total = 0;
    tasks.forEach(t => { const h = parseFloat(t.duration); if (h > 0) { sum[t.name] = (sum[t.name] || 0) + h; total += h; } });
    const ctx = document.getElementById('ratioChart')?.getContext('2d'); if (!ctx) return;
    if (ratioChart) ratioChart.destroy();
    ratioChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(sum), datasets: [{ data: Object.values(sum), backgroundColor: Object.keys(sum).map(l => typeof getStyle === 'function' ? getStyle(l) : '#cbd5e1'), borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw.toFixed(1)}h (${(c.raw/total*100).toFixed(1)}%)` } } } } });
    let html = `<div style="font-weight:bold; margin-bottom:12px; border-bottom:2px solid var(--primary); padding-bottom:5px;">合計: ${total.toFixed(1)}h</div>`;
    Object.entries(sum).sort((a,b)=>b[1]-a[1]).forEach(([n, h]) => html += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:6px;"><span>${n}</span><b>${h.toFixed(1)}h <small>(${(h/total*100).toFixed(1)}%)</small></b></div>`);
    const sumEl = document.getElementById('ratio-summary'); if(sumEl) sumEl.innerHTML = html;
};

// --- 画像保存の魔法 (最強レポート形式の復活) ---
window.exportRatioImage = function() {
    const chartCanvas = document.getElementById('ratioChart'), target = document.getElementById('analysis-worker-select');
    if(!chartCanvas || !target) return;

    const workerName = target.options[target.selectedIndex].text;
    const reportCanvas = document.createElement('canvas');
    const ctx = reportCanvas.getContext('2d');

    // レポートのサイズ設定 (黄金比に近い 960x600)
    reportCanvas.width = 960;
    reportCanvas.height = 600;

    // 背景を白で塗りつぶし
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, reportCanvas.width, reportCanvas.height);

    // タイトル (G6風の深みのある紺)
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`お仕事割合分析 (${workerName})`, reportCanvas.width / 2, 60);

    // 日付 (サブタイトル風)
    ctx.fillStyle = '#64748b';
    ctx.font = '20px sans-serif';
    ctx.fillText(selectedDate, reportCanvas.width / 2, 95);

    // グラフを描画 (左側に配置)
    ctx.drawImage(chartCanvas, 40, 130, 420, 420);

    // 右側のテーブルエリア設定
    const tableX = 500;
    const tableY = 160;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('お仕事内容', tableX, tableY);
    ctx.textAlign = 'right';
    ctx.fillText('時間', tableX + 300, tableY);
    ctx.fillText('%', tableX + 400, tableY);

    // 区切り線
    ctx.beginPath();
    ctx.moveTo(tableX, tableY + 15);
    ctx.lineTo(tableX + 420, tableY + 15);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // データの集計 (再計算して正確な値を出す)
    const day = getDayData(selectedDate);
    const tasks = day.tasks.filter(t => target.value === 'all' || t.worker === target.value);
    const sum = {};
    let total = 0;
    tasks.forEach(t => {
        const h = parseFloat(t.duration);
        if (h > 0) {
            sum[t.name] = (sum[t.name] || 0) + h;
            total += h;
        }
    });

    // データの描画
    Object.entries(sum).sort((a, b) => b[1] - a[1]).forEach(([name, hours], i) => {
        const rowY = tableY + 60 + (i * 45);
        if (rowY > reportCanvas.height - 30) return;

        // 色チップ (お仕事の色を再現)
        const color = getStyle(name);
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(tableX, rowY - 24, 28, 28, 6);
        ctx.fill();
        ctx.restore();

        // 項目名
        ctx.textAlign = 'left';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(name, tableX + 45, rowY);

        // 時間
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 18px "Inter", sans-serif';
        ctx.fillText(`${hours.toFixed(1)}h`, tableX + 300, rowY);

        // パーセンテージ
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        const percent = ((hours / total) * 100).toFixed(1);
        ctx.fillText(`${percent}%`, tableX + 400, rowY);
    });

    // フッター (システム情報)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`お仕事のキセキ G6 | 出力日時: ${new Date().toLocaleString()}`, reportCanvas.width - 20, reportCanvas.height - 15);

    // ダウンロード実行
    const link = document.createElement('a');
    link.download = `お仕事割合分析_${workerName}_${selectedDate}.png`;
    link.href = reportCanvas.toDataURL('image/png');
    link.click();

    showToast(`「究極の分析レポート」を生成しました！📊✨`, 'success');
};

window.exportGanttImage = function() {
    const canvas = document.querySelector('.gantt-container canvas'); if (!canvas) return showToast("タイムラインデータが見つかりません。🧠💦", 'warning');
    const temp = document.createElement('canvas'); temp.width = canvas.width; temp.height = canvas.height + 70;
    const ctx = temp.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${selectedDate} の描いた未来と、キセキの足跡`, temp.width / 2, 40); ctx.drawImage(canvas, 0, 70);
    const link = document.createElement('a'); link.href = temp.toDataURL('image/png'); link.download = `描いた未来とキセキの足跡_${selectedDate}.png`; link.click();
    showToast(`タイムライン画像を保存しました！📸✨`, 'success');
};

// --- ダッシュボード・エグゼクティブ・サマリーの保存魔法 ---
window.exportDashboardImage = function() {
    const trendCanvas = document.getElementById('dashTrendChart'), ratioCanvas = document.getElementById('dashRatioChart');
    if (!trendCanvas || !ratioCanvas) return showToast("ダッシュボードの描画を待ってね。🧠💦", 'warning');
    const start = document.getElementById('dash-start').value, end = document.getElementById('dash-end').value, worker = document.getElementById('dash-worker-select').value, workerName = worker === 'all' ? 'チーム全員' : worker.replace(/ \[.*?\]$/, '');

    // 横長（ランドスケープ）広域キャンバス
    const temp = document.createElement('canvas'); temp.width = 1400; temp.height = 1000; const ctx = temp.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, temp.width - 20, temp.height - 20);

    // プレミアム・ヘッダー
    ctx.fillStyle = '#1e293b'; ctx.fillRect(10, 10, temp.width - 20, 80);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px "MS UI Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('キセキの期間集計報告書 (Executive Summary)', temp.width / 2, 60);

    // 基本情報
    ctx.textAlign = 'left'; ctx.fillStyle = '#1e293b'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(`期間：${start} 〜 ${end}  |  対象：${workerName}`, 40, 130);
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, 145); ctx.lineTo(600, 145); ctx.stroke();

    // --- 左側：統計数値（縦並び 6枚） ---
    const stats = [
        { label: '稼働日数', value: document.getElementById('dash-days').textContent },
        { label: '実績合計', value: document.getElementById('dash-total-actual').textContent },
        { label: '平均稼働', value: document.getElementById('dash-avg-actual').textContent },
        { label: '予定合計', value: document.getElementById('dash-total-plan').textContent },
        { label: '予定差異', value: document.getElementById('dash-diff-total').textContent },
        { label: '計画一致率', value: document.getElementById('dash-plan-accuracy')?.textContent || '0%' }
    ];
    stats.forEach((s, i) => {
        const y = 180 + (i * 125);
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(40, y, 220, 100);
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.strokeRect(40, y, 220, 100);
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s.label, 150, y + 35);
        ctx.fillStyle = i === 5 ? '#6366f1' : (i === 4 ? (parseFloat(s.value) < 0 ? '#ef4444' : '#10b981') : '#1e293b');
        ctx.font = 'bold 26px sans-serif'; ctx.fillText(s.value, 150, y + 75);
    });

    // --- 中央〜右：メインコンテンツ ---
    // 1. トレンドグラフ
    ctx.textAlign = 'left'; ctx.fillStyle = '#1e293b'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('■ 稼働トレンド推移', 300, 180);
    const tW = trendCanvas.width, tH = trendCanvas.height, tAsp = tW / tH;
    ctx.drawImage(trendCanvas, 300, 200, 1050, 1050 / tAsp > 320 ? 320 : 1050 / tAsp);

    // 2. 割合分析（正円切り出し）
    ctx.fillText('■ 業務内容の割合', 300, 550);
    const rW = ratioCanvas.width, rH = ratioCanvas.height, rSide = Math.min(rW, rH);
    const rSX = (rW - rSide) / 2, rSY = (rH - rSide) / 2;
    ctx.drawImage(ratioCanvas, rSX, rSY, rSide, rSide, 300, 580, 300, 300);

    // 3. 業務内容の集計（右側を広く確保）
    ctx.fillText('■ 業務内容の詳細', 650, 550);
    const summaryHtml = document.getElementById('dash-staff-summary').innerText;
    const summaryLines = summaryHtml.split('\n').filter(l => l.trim() && !l.includes('業務内容の集計'));
    ctx.font = '16px monospace'; ctx.fillStyle = '#334155';
    summaryLines.forEach((line, idx) => {
        const x = idx < 15 ? 650 : 1000;
        const y = 600 + ((idx % 15) * 24);
        if(idx < 30) ctx.fillText('・' + line, x, y);
    });

    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`司令室 出力日時：${new Date().toLocaleString()} | お仕事のキセキ Ver.1.0.0`, 1360, 980);

    const link = document.createElement('a'); link.href = temp.toDataURL('image/png'); link.download = `キセキの報告書_${workerName}_${start}_${end}.png`; link.click();
    showToast(`「究極のサマリー」を保存したよ！👔🚀`, 'success');
};

// ダッシュボード・期間集計
window.setDashPeriod = function(mode) {
    const startInp = document.getElementById('dash-start'), endInp = document.getElementById('dash-end');
    if (!startInp || !endInp) return;
    const now = new Date();
    if (mode === 'week') {
        const monday = new Date(now); const day = now.getDay(), diffToMon = (day === 0 ? -6 : 1 - day); 
        monday.setDate(now.getDate() + diffToMon);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        startInp.value = monday.toLocaleDateString('sv-SE'); endInp.value = sunday.toLocaleDateString('sv-SE');
    } else if (mode === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1), last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startInp.value = first.toLocaleDateString('sv-SE'); endInp.value = last.toLocaleDateString('sv-SE');
    }
    if (typeof updateDashboard === 'function') updateDashboard();
};

window.setReportPeriod = function(mode) {
    const startInp = document.getElementById('report-start'), endInp = document.getElementById('report-end');
    if (!startInp || !endInp) return;
    const now = new Date();
    if (mode === 'week') {
        const monday = new Date(now); const day = now.getDay(), diffToMon = (day === 0 ? -6 : 1 - day);
        monday.setDate(now.getDate() + diffToMon);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        startInp.value = monday.toLocaleDateString('sv-SE'); endInp.value = sunday.toLocaleDateString('sv-SE');
    }
};

window.openDashboardModal = () => { document.getElementById('dash-worker-select').innerHTML = '<option value="all">全員合計</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join(''); const end = new Date(), start = new Date(); start.setDate(end.getDate()-7); document.getElementById('dash-start').value = start.toLocaleDateString('sv-SE'); document.getElementById('dash-end').value = end.toLocaleDateString('sv-SE'); document.getElementById('dashboard-modal').style.display='flex'; updateDashboard(); };
window.closeDashboardModal = () => document.getElementById('dashboard-modal').style.display='none';
window.updateDashboard = async function() {
    const sStr = document.getElementById('dash-start').value, eStr = document.getElementById('dash-end').value, target = document.getElementById('dash-worker-select').value;
    if(!sStr || !eStr) return; 

    // 🌟 【Ver.2.0.0】 集計前に指定期間のデータを一括ロード
    await window.loadDailyRange(sStr, eStr);

    const sDate = new Date(sStr), eDate = new Date(eStr);
    let days = 0, actTotal = 0, plnTotal = 0, matchedHrs = 0, ratioSum = {}, trendData = [], staffStats = {}, allTasks = new Set();
    for(let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const k = d.toLocaleDateString('sv-SE'), day = getDayData(k) || {tasks:[], plans:[]}, dTasks = day.tasks.filter(t => target === 'all' || t.worker === target), dPlans = day.plans.filter(p => target === 'all' || p.worker === target);
        let dAct = 0, dPln = 0, dActMap = {}, dPlnMap = {};
        
        // 計画一致率のための突合用マップ作成
        const dayPlnMap = {}; dPlans.forEach(p => { if(p.name!=='休憩') dayPlnMap[p.name] = (dayPlnMap[p.name]||0) + parseFloat(p.duration); });
        const dayActMap = {}; dTasks.forEach(t => { if(t.name!=='休憩') dayActMap[t.name] = (dayActMap[t.name]||0) + parseFloat(t.duration); });
        Object.keys(dayPlnMap).forEach(name => { if(dayActMap[name]) matchedHrs += Math.min(dayPlnMap[name], dayActMap[name]); });

        dTasks.forEach(t => { const h = parseFloat(t.duration); if(!data.masterSpecials.includes(t.name) && t.name !== '休憩') { dAct += h; actTotal += h; ratioSum[t.name] = (ratioSum[t.name] || 0) + h; dActMap[t.name] = (dActMap[t.name] || 0) + h; allTasks.add(t.name); } staffStats[t.worker] = (staffStats[t.worker] || 0) + h; });
        dPlans.forEach(p => { const h = parseFloat(p.duration); if(!data.masterSpecials.includes(p.name) && p.name !== '休憩' && p.name !== '移動') { dPln += h; plnTotal += h; dPlnMap[p.name] = (dPlnMap[p.name] || 0) + h; allTasks.add(p.name); } });
        if(dAct > 0 || dPln > 0) days++; trendData.push({ date: k.substring(5), actMap: dActMap, plnMap: dPlnMap });
    }
    const acc = plnTotal > 0 ? (matchedHrs / plnTotal * 100).toFixed(1) : 0;
    ['dash-days', 'dash-total-actual', 'dash-avg-actual', 'dash-total-plan', 'dash-diff-total', 'dash-plan-accuracy'].forEach((id, i) => { const el = document.getElementById(id); if(el) el.textContent = [days, actTotal.toFixed(1)+'h', (days?actTotal/days:0).toFixed(1)+'h', plnTotal.toFixed(1)+'h', (actTotal-plnTotal).toFixed(1)+'h', acc+'%'][i]; });
    const tCtx = document.getElementById('dashTrendChart').getContext('2d'); if(dashTrendChart) dashTrendChart.destroy();
    const taskList = Array.from(allTasks), datasets = []; taskList.forEach(name => { datasets.push({ label: name+'(実)', data: trendData.map(d=>d.actMap[name]||0), backgroundColor: getStyle(name), stack: 'actual' }, { label: name+'(予)', data: trendData.map(d=>d.plnMap[name]||0), backgroundColor: getStyle(name, true), stack: 'plan' }); });
    dashTrendChart = new Chart(tCtx, { type: 'bar', data: { labels: trendData.map(d=>d.date), datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { display: false } } } });
    const rCtx = document.getElementById('dashRatioChart').getContext('2d'); if(dashRatioChart) dashRatioChart.destroy();
    dashRatioChart = new Chart(rCtx, { type: 'pie', data: { labels: Object.keys(ratioSum), datasets: [{ data: Object.values(ratioSum), backgroundColor: Object.keys(ratioSum).map(l=>getStyle(l)) }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } } });
    let staffHtml = '<div style="font-size:12px; font-weight:bold; margin-bottom:5px; border-bottom:1px solid #eee;">業務内容の集計</div>';
    Object.entries(ratioSum).sort((a,b)=>b[1]-a[1]).forEach(([n, h]) => { const pct = actTotal > 0 ? (h / actTotal * 100).toFixed(1) : 0; staffHtml += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>${n}</span><b>${h.toFixed(1)}h <small>(${pct}%)</small></b></div>`; });
    document.getElementById('dash-staff-summary').innerHTML = staffHtml;
};

// ポータル・メイン
window.openPortal = function() {
    const icon = document.getElementById('guide-icon-area'), title = document.getElementById('guide-title'), content = document.getElementById('guide-content');
    if(!icon || !title || !content) return;
    icon.innerHTML = `<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:50px; height:50px; color:var(--primary);"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    title.innerHTML = '<span style="font-family: serif; font-size: 28px; letter-spacing: 2px; font-weight: 900;">キセキの管理センター</span>';
    const stats = { workers: data.masterWorkers.length, tasks: data.masterTasks.length, patterns: (data.workPatterns || []).length };
    content.innerHTML = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div onclick="openMasterManagement('workers')" class="action-chip portal-card" style="background: rgba(99, 102, 241, 0.1); color: #4338ca; border: 1px solid rgba(99, 102, 241, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>スタッフ管理</span><small style="opacity:0.7; font-size:10px; margin-top:4px;">${stats.workers}名 登録中</small></div>
        <div onclick="openMasterManagement('tasks')" class="action-chip portal-card" style="background: rgba(245, 158, 11, 0.1); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8L2 22M17.5 15H9"/></svg><span>お仕事リスト</span><small style="opacity:0.7; font-size:10px; margin-top:4px;">${stats.tasks}種 設定中</small></div>
        <div onclick="openMasterManagement('patterns')" class="action-chip portal-card" style="background: rgba(139, 92, 246, 0.1); color: #6d28d9; border: 1px solid rgba(139, 92, 246, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>お仕事パターン</span><small style="opacity:0.7; font-size:10px; margin-top:4px;">${stats.patterns}件 構築済み</small></div>
        <div onclick="openMasterManagement('colors')" class="action-chip portal-card" style="background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg><span>配色・Excel設定</span><small style="opacity:0.7; font-size:10px; margin-top:4px;">色彩の同期</small></div>
        <div onclick="openMasterManagement('config')" class="action-chip portal-card" style="background: rgba(100, 116, 139, 0.1); color: #475569; border: 1px solid rgba(100, 116, 139, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>環境設定</span></div>
        <div onclick="openMasterManagement('csv_export')" class="action-chip portal-card" style="background: rgba(34, 197, 94, 0.1); color: #15803d; border: 1px solid rgba(34, 197, 94, 0.2);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px; margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>CSVデータ抽出</span><small style="opacity:0.7; font-size:10px; margin-top:4px;">分析用生データ</small></div>
        <div onclick="showLargeGuide('menu')" class="action-chip portal-card guide-book-card" style="grid-column: span 2; background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%); border: 1px solid #e2e8f0;">
            <svg class="kizuna-icon" viewBox="0 0 24 24" style="width:30px; height:30px; color:#6366f1;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5V4.5z"/></svg>
            <div style="text-align: left;">
                <b style="font-size: 18px; color: #0f172a; display: block;">キセキの説明書</b>
                <span style="color: #64748b; font-size: 11px;">司令室の全機能をマスターする</span>
            </div>
            <svg class="kizuna-icon" viewBox="0 0 24 24" style="width:20px; height:20px; margin-left:auto; opacity:0.3;"><path d="M9 18l6-6-6-6"/></svg>
        </div>
    </div>`;
    const f = document.querySelector('#large-guide-modal button'); if (f) { f.textContent = "管理センターを閉じる"; f.onclick = window.closeLargeGuide; }
    document.getElementById('large-guide-modal').style.display = 'flex'; lucide.createIcons();
};

window.openMasterManagement = function(type) {
    const title = document.getElementById('guide-title'), content = document.getElementById('guide-content');
    let html = '', needRender = true;
    if (type === 'workers') { 
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> スタッフ名簿'; 
        html = `<div id="portal-worker-list" class="master-list-container"></div><div style="display:flex;gap:10px;width:100%;margin-top:15px;background:rgba(255,255,255,0.5);padding:15px;border-radius:15px;border:1px solid var(--border);"><input type="text" id="p-new-worker-id" placeholder="ID" style="width:60px;height:45px;text-align:center;border:1px solid #ddd;border-radius:8px;"><input type="text" id="p-new-worker" placeholder="スタッフ名を入力" style="flex:1;height:45px;padding:0 15px;border:1px solid #ddd;border-radius:8px;"><button class="btn-miracle-magic" onclick="addMaster('worker', true)" style="width:50px;height:45px;">+</button></div>`; 
    }
    else if (type === 'tasks') { 
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8L2 22M17.5 15H9"/></svg> お仕事のリスト'; 
        html = `<div id="portal-task-list" class="master-list-container"></div><div style="display:flex;gap:10px;width:100%;margin-top:15px;background:rgba(255,255,255,0.5);padding:15px;border-radius:15px;border:1px solid var(--border);"><input type="text" id="p-new-task" placeholder="新しいお仕事の名称" style="flex:1;height:45px;padding:0 15px;border:1px solid #ddd;border-radius:8px;"><button class="btn-miracle-magic" onclick="addMaster('task', true)" style="width:50px;height:45px;">+</button></div>`; 
    }
    else if (type === 'patterns') { 
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 運用テンプレート'; 
        html = `<div id="portal-pattern-list" class="master-list-container"></div><button class="btn-miracle-magic" onclick="openPatternModal(null, true); window.closeLargeGuide();" style="width:100%;margin-bottom:20px; height:50px;">+ 新規テンプレートを構築</button><div style="padding:15px;background:rgba(14, 165, 233, 0.05);border-radius:12px;border:1px solid #bae6fd;"><label style="font-weight:bold;color:#0369a1;display:block;margin-bottom:10px;">運用ルール：自動休憩設定</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div><small style="color:#64748b;">適用しきい値(h)</small><input type="number" id="p-break-threshold" step="0.5" value="${data.config.breakThreshold}" onchange="updatePortalConfig()" style="height:40px;"></div><div><small style="color:#64748b;">休憩時間(分)</small><input type="number" id="p-break-duration" step="15" value="${data.config.breakDuration}" onchange="updatePortalConfig()" style="height:40px;"></div></div></div>`; 
    }
    else if (type === 'colors') { 
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> 色彩・Excel定義'; 
        html = `<button class="btn-success" onclick="syncExcelColors(); renderPortalContent('colors');" style="width:100%;margin-bottom:15px;height:50px;box-shadow:0 4px 0 #15803d;">最新の色彩を同期する</button><div id="portal-excel-list" class="master-list-container" style="max-height:400px;"></div>`; 
    }
    else if (type === 'config') { 
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> 司令室・環境設定'; 
        html = `<div class="card" style="padding:20px; background:rgba(255,255,255,0.5); border-radius:15px;"><b style="color:var(--text-main); display:block; margin-bottom:15px;">📊 タイムライン観測範囲</b><div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;"><div><small style="color:#64748b;">始動時刻</small><input type="time" id="p-config-start" value="${data.config.start}" onchange="updatePortalConfig()" style="height:45px;"></div><div><small style="color:#64748b;">撤収時刻</small><input type="time" id="p-config-end" value="${data.config.end}" onchange="updatePortalConfig()" style="height:45px;"></div></div><b style="color:var(--text-main); display:block; margin-bottom:15px;">所属部署の定義 (CSV出力用)</b><input type="text" id="p-config-dept" value="${data.config.affiliation || ''}" placeholder="例: 第一開発部" onchange="updatePortalConfig()" style="height:45px;"></div>`; 
    }
    else if (type === 'csv_export') {
        title.innerHTML = '<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:24px; height:24px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> キセキのデータ抽出';
        const now = new Date(), nowY = now.getFullYear(), nowM = now.getMonth() + 1;
        html = `<div id="portal-csv-area" class="card" style="padding:25px; background:rgba(255,255,255,0.8); border-radius:15px; text-align:center;">
            <b style="color:var(--text-main); display:block; margin-bottom:20px; font-size:16px;">📊 抽出する期間の入力</b>
            <div style="display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom:25px;">
                <input type="number" id="csv-year-input" value="${nowY}" placeholder="2026" style="width:100px; height:45px; text-align:center; font-weight:bold; border-radius:10px; border:1px solid #cbd5e1; background:white;">
                <span style="font-weight:bold;">年</span>
                <input type="number" id="csv-month-input" value="${nowM}" min="1" max="12" placeholder="4" style="width:80px; height:45px; text-align:center; font-weight:bold; border-radius:10px; border:1px solid #cbd5e1; background:white;">
                <span style="font-weight:bold;">月</span>
            </div>
            <button class="btn-miracle-magic" onclick="runKizunaCSVExport('monthly')" style="width:100%; height:55px; font-size:16px; margin-bottom:15px; box-shadow:0 4px 0 #1e40af;">指定月のキセキを抽出する</button>
            <div style="height:1px; background:#e2e8f0; margin:20px 0;"></div>
            <button class="btn-outline" onclick="runKizunaCSVExport('all')" style="width:100%; height:45px; color:var(--text-muted); border-style:dashed;">全ての期間を抽出 (全データ)</button>
        </div>`;
        needRender = false;
    }
    content.innerHTML = html + `<button onclick="openPortal()" class="btn-outline" style="margin-top:25px; border-style:dashed; border-radius:12px; font-weight:bold; height:45px;">管理パネルへ戻る</button>`;
    if(needRender) renderPortalContent(type); 
    lucide.createIcons();
};

window.renderPortalContent = function(type) {
    let tId = ''; if(type==='workers') tId='portal-worker-list'; else if(type==='tasks') tId='portal-task-list'; else if(type==='patterns') tId='portal-pattern-list'; else if(type==='colors') tId='portal-excel-list';
    const el = document.getElementById(tId); if (!el) return;
    if (type === 'workers') el.innerHTML = data.masterWorkers.map((w,i)=>`<div class="master-item"><span style="flex:1;">${w}</span><span onclick="removeMaster('worker',${i});" style="color:red;cursor:pointer;font-weight:bold;padding:5px;">×</span></div>`).join('');
    else if (type === 'tasks') el.innerHTML = data.masterTasks.map((t,i)=>({t,i})).sort((a,b)=>(data.favorites.includes(a.t)?1:0)-(data.favorites.includes(b.t)?1:0)).map(({t,i})=>{
        const isFav = (data.favorites || []).includes(t), isRes = (data.resultRequiredTasks || []).includes(t);
        return `<div class="master-item">
            <span onclick="toggleFavorite('${t}'); renderPortalContent('tasks');" style="cursor:pointer;color:${isFav?'#f59e0b':'#cbd5e1'}"><i data-lucide="star" style="width:16px;fill:${isFav?'#f59e0b':'none'}"></i></span>
            <span onclick="toggleResultRequired('${t}'); renderPortalContent('tasks');" style="cursor:pointer;margin-left:8px;color:${isRes?'#ef4444':'#cbd5e1'}"><i data-lucide="file-edit" style="width:16px;fill:${isRes?'#ef4444':'none'}"></i></span>
            <span style="flex:1;margin-left:10px;">${t}</span>
            <span onclick="removeMaster('task',${i});" style="color:red;cursor:pointer;font-weight:bold;padding:5px;">×</span>
        </div>`;
    }).join('');
    else if (type === 'patterns') el.innerHTML = (data.workPatterns || []).map(p => `<div class="master-item"><b style="flex:1;">🧩 ${p.name}</b><div style="display:flex;gap:10px;"><span onclick="openPatternModal(${p.id}, true); window.closeLargeGuide();" style="color:var(--accent);cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></span><span onclick="deletePattern(${p.id});" style="color:var(--danger);cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></span></div></div>`).join('');
    else if (type === 'colors') {
        const kws = [...new Set(['休憩','移動',...meetingTasks,...data.masterTasks,...data.masterSpecials])];
        el.innerHTML = kws.map(kw => { const st = data.taskStyles[kw] || { color: getColorMap()[kw] || '#cbd5e1', pattern: 'auto' }; return `<div class="card" style="margin-bottom:10px;padding:12px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><div id="prev-${kw}" style="width:40px;height:40px;border-radius:8px;border:1px solid #ddd;"></div><span style="flex:1;font-weight:bold;">${kw}</span><input type="color" value="${st.color}" onchange="updateTaskStyle('${kw}', this.value, null)" style="width:40px;height:40px;cursor:pointer;"></div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">${['none','stripe','dot','grid','star','auto'].map(p=>`<button onclick="updateTaskStyle('${kw}',null,'${p}')" class="btn-small ${st.pattern===p?'active':''}">${p==='auto'?'自動':p}</button>`).join('')}</div></div>`; }).join('');
        kws.forEach(kw => { const elP = document.getElementById(`prev-${kw}`), st = getStyle(kw); if(typeof st==='string') elP.style.backgroundColor=st; else { const c = document.createElement('canvas'); c.width=40; c.height=40; const x = c.getContext('2d'); x.fillStyle=st; x.fillRect(0,0,40,40); elP.style.backgroundImage=`url(${c.toDataURL()})`; } });
    }
    lucide.createIcons();
};

window.updateTaskStyle = (kw, color, pattern) => { if(!data.taskStyles[kw]) data.taskStyles[kw] = { color:getColorMap()[kw]||'#cbd5e1', pattern:'auto' }; if(color) { data.taskStyles[kw].color = color; data.excelColors[kw] = color; } if(pattern) data.taskStyles[kw].pattern = pattern; saveAndRefresh(); setTimeout(() => renderPortalContent('colors'), 10); };
window.updatePortalConfig = () => { const s=document.getElementById('p-config-start'), e=document.getElementById('p-config-end'), d=document.getElementById('p-config-dept'); if(s) data.config.start = s.value; if(e) data.config.end = e.value; if(d) data.config.affiliation = d.value; saveAndRefresh(); };

window.showLargeGuide = function(type) {
    const icon = document.getElementById('guide-icon-area'), title = document.getElementById('guide-title'), content = document.getElementById('guide-content');
    if (!icon || !title || !content) return;
    if (type === 'menu' || !type) {
        icon.innerHTML = `<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:50px; height:50px; color:var(--primary);"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5V4.5z"/></svg>`;
        title.innerHTML = '<span style="font-family:serif; font-size:28px; letter-spacing:2px; font-weight:900;">キセキの説明書</span>';
        content.innerHTML = `<div style="display:grid; grid-template-columns:1fr; gap:15px;"><div onclick="showLargeGuide('guide')" class="action-chip portal-card" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); height: 100px; display: flex; align-items: center; padding: 0 20px; gap: 20px; cursor: pointer;"><div style="background: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:28px; height:28px; color:#f59e0b;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div style="text-align:left;"><b style="font-size:18px; color: #b45309; display:block;">運用ガイド</b><span style="font-size:11px; color: #d97706; opacity:0.8;">基本操作をマスターする</span></div><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:18px; height:18px; margin-left:auto; opacity:0.3;"><path d="M9 18l6-6-6-6"/></svg></div><div onclick="showLargeGuide('features')" class="action-chip portal-card" style="background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.2); height: 100px; display: flex; align-items: center; padding: 0 20px; gap: 20px; cursor: pointer;"><div style="background: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:28px; height:28px; color:#ec4899;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg></div><div style="text-align:left;"><b style="font-size:18px; color: #9d174d; display:block;">高度な機能</b><span style="font-size:11px; color: #be185d; opacity:0.8;">このアプリが持つ特別な力</span></div><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:18px; height:18px; margin-left:auto; opacity:0.3;"><path d="M9 18l6-6-6-6"/></svg></div><div onclick="openPortal()" class="action-chip portal-card" style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); height: 100px; display: flex; align-items: center; padding: 0 20px; gap: 20px; cursor: pointer;"><div style="background: white; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);"><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:28px; height:28px; color:#6366f1;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div><div style="text-align:left;"><b style="font-size:18px; color: #4338ca; display:block;">管理センター</b><span style="font-size:11px; color: #4f46e5; opacity:0.8;">司令室の全機能を一括設定</span></div><svg class="kizuna-icon" viewBox="0 0 24 24" style="width:18px; height:18px; margin-left:auto; opacity:0.3;"><path d="M9 18l6-6-6-6"/></svg></div></div>`;
    } else if (type === 'guide') {
        icon.innerHTML = `<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:50px; height:50px; color:#f59e0b;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        title.innerHTML = '<span style="font-family:serif; font-size:24px; letter-spacing:1px; font-weight:900;">司令室 運用ガイド</span>';
        const steps = [{t:'地盤を固める', s:'「キセキの管理センター」でスタッフ名簿とお仕事のリストを登録。これが全ての観測の起点となります。', c:'rgba(245, 158, 11, 0.1)'},{t:'未来の地図を描く', s:'「予定」モードやお仕事パターンで今後のスケジュールを構築。<b>「描いた未来」</b>が可視化され、チームの動きが予測可能になります。', c:'rgba(139, 92, 246, 0.1)'},{t:'「今」のキセキを刻む', s:'スタッフと内容を選んで「開始」を選択。現場での一歩一歩が<b>「キセキ」</b>としてリアルタイムに記録されます。', c:'rgba(14, 165, 233, 0.1)'},{t:'足跡を正確に修正', s:'「修正」ボタンで過去の記録を微調整。事実に基づいた正確なデータを維持し、司令室の信頼性を高めます。', c:'rgba(16, 185, 129, 0.1)'},{t:'絆を繋ぎ、連携する', s:'「告知」や「依頼」を活用し、チーム全体へ情報を伝達。双方向のコミュニケーションで絆を深めます。', c:'rgba(99, 102, 241, 0.1)'},{t:'結晶を観測・出力する', s:'蓄積された<b>「足跡」</b>を分析し、輝く<b>「結晶」</b>やビジネス日報を生成。一日の成果を形に残します。', c:'rgba(236, 72, 153, 0.1)'}];
        content.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px; text-align:left;">${steps.map((step, idx) => `<div class="portal-card" style="background:${step.c}; padding:12px 15px; border-radius:15px; border:1px solid rgba(0,0,0,0.05); display:flex; gap:15px; align-items:start;"><div style="flex-shrink:0; width:28px; height:28px; background:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:900; color:var(--text-main); box-shadow:0 2px 5px rgba(0,0,0,0.05);">${idx+1}</div><div style="flex:1;"><b style="color:var(--text-main); display:block; margin-bottom:2px; font-size:14px;">${step.t}</b><div style="color:var(--text-muted); line-height:1.4; font-size:12px;">${step.s}</div></div></div>`).join('')}<button onclick="showLargeGuide('menu')" class="btn-outline" style="margin-top:10px; border-radius:10px; height:40px;">目次へ戻る</button></div>`;
    } else if (type === 'features') {
        icon.innerHTML = `<svg class="kizuna-icon" viewBox="0 0 24 24" style="width:50px; height:50px; color:#ec4899;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
        title.innerHTML = '<span style="font-family:serif; font-size:24px; letter-spacing:1px; font-weight:900;">司令室 高度な機能</span>';
        const feats = [{t:'超空間同期 (Hyper-Sync)', s:'PCとモバイル、全デバイス間で遅延なく情報を共有。チームの「今」を瞬時に把握します。', c:'#0ea5e9'},{t:'自律調整機構 (Auto-Logic)', s:'休憩や移動の割り込みをAIが判断し、記録の重複や矛盾を自動的に排除。', c:'#8b5cf6'},{t:'自律習得機構 (Auto-Learning)', s:'リストにない新しいお仕事をその場で入力するだけで、司令室が自動的に学習・登録。', c:'#f59e0b'},{t:'色彩の魔術 (Visual Logic)', s:'業務に応じた自由な配色と模様の定義。直感的なビジュアルで状況を一目瞭然にします。', c:'#ec4899'},{t:'結晶化プロセス (Crystallize)', s:'日々の努力を美しい「キセキの結晶」やビジネス日報へと自動変換。', c:'#10b981'},{t:'クロノス・インターベンション', s:'「夜明け」「静寂」といった時間軸の観測モードを搭載。', c:'#6366f1'}];
        content.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px; text-align:left;">${feats.map(f => `<div class="portal-card" style="background:white; padding:15px; border-radius:15px; border:1px solid rgba(0,0,0,0.05); border-left:5px solid ${f.c}; box-shadow:0 4px 12px rgba(0,0,0,0.02);"><b style="font-size:15px; display:block; margin-bottom:4px; color:var(--text-main);">${f.t}</b><div style="color:var(--text-muted); line-height:1.4; font-size:12px;">${f.s}</div></div>`).join('')}<button onclick="showLargeGuide('menu')" class="btn-outline" style="margin-top:10px; border-radius:10px; height:40px;">目次へ戻る</button></div>`;
    }
    document.getElementById('large-guide-modal').style.display = 'flex'; lucide.createIcons();
};

window.runKizunaCSVExport = async function(mode) {
    let target = null;
    if (mode === 'monthly') {
        const y = document.getElementById('csv-year-input').value, m = document.getElementById('csv-month-input').value;
        if (!y || !m) return showToast("年と月を入力してね！🧙‍♂️", '⚠️');
        target = `${y}-${m.toString().padStart(2, '0')}`;
    }
    await exportKizunaDataCSV(target);
};

window.exportKizunaDataCSV = async function(targetMonth = null) {
    const dept = data.config.affiliation || "未設定部署";

    // 🌟 【Ver.2.0.0】 抽出前にデータを一括ロード
    if (targetMonth) {
        await window.loadDailyRange(`${targetMonth}-01`, `${targetMonth}-31`);
    } else {
        // 全期間の場合は、広めの範囲をロード
        await window.loadDailyRange("2020-01-01", "2030-12-31");
    }

    let csv = "\ufeff部署,日付,スタッフ名,種別,内容,開始,終了,所要時間(h),備考,結果,星評価,キセキのコメント\n";
    let count = 0;
    Object.keys(data.daily).sort().forEach(date => {
        if (targetMonth && !date.startsWith(targetMonth)) return;
        const day = data.daily[date], miracles = day.miracles || {};
        if (day.plans) day.plans.forEach(p => { 
            csv += `${dept},${date},${p.worker.replace(/ \[.*?\]$/, '')},予定,${p.name},${p.start},${p.end},${p.duration},${(p.remark || '').replace(/[\n\r,]/g, " ")},,-,\n`; 
            count++;
        });
        if (day.tasks) day.tasks.forEach(t => { 
            const m = miracles[t.worker] || { rating: 0, comment: "" }; 
            csv += `${dept},${date},${t.worker.replace(/ \[.*?\]$/, '')},実績,${t.name},${t.start},${t.end},${t.duration},${(t.remark || '').replace(/[\n\r,]/g, " ")},${(t.result || '').replace(/[\n\r,]/g, " ")},${m.rating || '-'},${(m.comment || '').replace(/[\n\r,]/g, " ")}\n`; 
            count++;
        });
    });
    if (count === 0) return showToast(targetMonth ? `${targetMonth} のデータがないよ！🧙‍♂️` : "データが見つからないよ！", 'warning');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = targetMonth ? `kizuna_report_${targetMonth}.csv` : `kizuna_all_${new Date().toLocaleDateString('sv-SE')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast(`${targetMonth || '全期間'}のデータを抽出しました。`, 'success');
};

window.syncExcelColors = () => { 
    if (window.renderExcelSettings) window.renderExcelSettings(); 
    if (window.renderPortalContent) window.renderPortalContent('colors');
    showToast("色彩リストを同期したよ！🎨✨", '🪄'); 
};
window.updateExcelColor = function(kw, color) { if (!data.excelColors) data.excelColors = {}; data.excelColors[kw] = color; if(data.taskStyles[kw]) data.taskStyles[kw].color = color; saveAndRefresh(); };

window.openDailyReportModal = function() {
    const sel = document.getElementById('daily-report-worker-select');
    if (sel) sel.innerHTML = '<option value="all">👥 全員分（一括出力）</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join('');
    const aff = document.getElementById('daily-report-affiliation'); if (aff) aff.value = data.config.affiliation || '';
    document.getElementById('daily-report-modal').style.display = 'flex'; lucide.createIcons();
};
window.closeDailyReportModal = () => document.getElementById('daily-report-modal').style.display = 'none';

window.exportDailyReportExcel = async function() {
    const targetWorker = document.getElementById('daily-report-worker-select').value, affiliation = document.getElementById('daily-report-affiliation').value.trim(), day = getDayData(selectedDate), [y, m, d] = selectedDate.split('-');
    data.config.affiliation = affiliation; saveAndRefresh(); showToast("ビジネス日報を編纂中...👔✨", '📜');
    try {
        const workbook = new ExcelJS.Workbook(), targetList = targetWorker === 'all' ? data.masterWorkers : [targetWorker], addedNames = new Set();
        targetList.forEach(worker => {
            let sN = worker.replace(/ \[.*?\]$/, '').replace(/[\\\/?*\[\]]/g, '').trim() || "名称未設定";
            let finalSN = sN.substring(0, 31), count = 1; while (addedNames.has(finalSN)) { const suffix = `(${count})`; finalSN = sN.substring(0, 31 - suffix.length) + suffix; count++; } addedNames.add(finalSN);
            const ws = workbook.addWorksheet(finalSN), miracle = (day.miracles || {})[worker] || { rating: 0, comment: '' };
            ws.columns = Array(20).fill(0).map(() => ({ width: 4 }));
            const border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }, headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }, lblFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            ws.mergeCells('A1:T1'); const tc = ws.getCell('A1'); tc.value = '作 業 日 報'; tc.font = { name: 'MS UI Gothic', size: 18, bold: true, underline: true }; tc.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(1).height = 35;
            ws.mergeCells('A3:C3'); ws.getCell('A3').value = '日付'; ws.getCell('A3').fill = lblFill; ws.mergeCells('D3:T3'); ws.getCell('D3').value = ` ${y} 年 ${m} 月 ${d} 日`;
            ws.mergeCells('A4:C4'); ws.getCell('A4').value = '所属'; ws.getCell('A4').fill = lblFill; ws.mergeCells('D4:T4'); ws.getCell('D4').value = ` ${affiliation}`;
            ws.mergeCells('A5:C5'); ws.getCell('A5').value = '氏名'; ws.getCell('A5').fill = lblFill; ws.mergeCells('D5:T5'); ws.getCell('D5').value = ` ${worker.replace(/ \[.*?\]$/, '')}`;
            ['A3','D3','A4','D4','A5','D5'].forEach(a => { const c = ws.getCell(a); c.border = border; c.alignment = { vertical: 'middle' }; });
            ws.mergeCells('A8:J8'); ws.getCell('A8').value = '予定時間合計'; ws.getCell('A8').fill = lblFill; ws.mergeCells('K8:T8'); ws.getCell('K8').value = '実績時間合計'; ws.getCell('K8').fill = lblFill;
            const plnH = (day.plans || []).filter(p => p.worker === worker && p.name !== '休憩').reduce((s, p) => s + (parseFloat(p.duration) || 0), 0), actH = (day.tasks || []).filter(t => t.worker === worker && t.name !== '休憩').reduce((s, t) => s + (parseFloat(t.duration) || 0), 0);
            ws.mergeCells('A9:J9'); ws.getCell('A9').value = `${plnH.toFixed(1)} h`; ws.mergeCells('K9:T9'); ws.getCell('K9').value = `${actH.toFixed(1)} h`;
            ['A8','K8','A9','K9'].forEach(a => { const c = ws.getCell(a); c.border = border; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
            ws.mergeCells('A11:C11'); ws.getCell('A11').value = '時刻'; ws.getCell('A11').fill = headFill; ws.getCell('A11').font = { color: { argb: 'FFFFFFFF' }, bold: true };
            ws.mergeCells('D11:T11'); ws.getCell('D11').value = '業務詳細（案件名・作業内容・商談記録など）'; ws.getCell('D11').fill = headFill; ws.getCell('D11').font = { color: { argb: 'FFFFFFFF' }, bold: true };
            const tasks = (day.tasks || []).filter(t => t.worker === worker).sort((a,b) => (a.start||'').localeCompare(b.start||'')); let row = 12;
            tasks.forEach(t => {
                ws.mergeCells(`A${row}:C${row}`);
                ws.getCell(`A${row}`).value = `${t.start}-${t.end}`;
                ws.mergeCells(`D${row}:T${row}`);
                const detail = (t.target ? `[${t.target}] ` : '') + t.name + (t.remark ? ` ${t.remark}` : '');
                const cell = ws.getCell(`D${row}`);
                cell.value = detail;
                cell.alignment = { vertical: 'middle', wrapText: true };
                ws.getCell(`A${row}`).border = border;
                ws.getCell(`D${row}`).border = border;
                ws.getRow(row).height = 25;
                row++;
            });
            while(row < 22) { ws.mergeCells(`A${row}:C${row}`); ws.mergeCells(`D${row}:T${row}`); ws.getCell(`A${row}`).border = border; ws.getCell(`D${row}`).border = border; row++; }

            row++;
            ws.mergeCells(`A${row}:T${row}`);
            ws.getCell(`A${row}`).value = '■ 結果報告など';
            ws.getCell(`A${row}`).fill = lblFill;
            ws.getCell(`A${row}`).font = { bold: true };
            ws.getCell(`A${row}`).border = border;
            
            const results = tasks.filter(t => t.result).map(t => `${t.target ? `[${t.target}] ` : ''}${t.name} ${t.result}`).join('\n');
            ws.mergeCells(`A${row+1}:T${row+4}`);
            ws.getCell(`A${row+1}`).value = results || '特になし';
            ws.getCell(`A${row+1}`).alignment = { vertical: 'top', wrapText: true };
            ws.getCell(`A${row+1}`).border = border;
            row += 5;

            ws.mergeCells(`A${row}:T${row}`);
            ws.getCell(`A${row}`).value = '■ 特記事項';
            ws.getCell(`A${row}`).fill = lblFill;
            ws.getCell(`A${row}`).font = { bold: true };
            ws.getCell(`A${row}`).border = border;
            ws.mergeCells(`A${row+1}:T${row+5}`);
            ws.getCell(`A${row+1}`).value = miracle.comment || '';
            ws.getCell(`A${row+1}`).alignment = { vertical: 'top', wrapText: true };
            ws.getCell(`A${row+1}`).border = border;
            ws.eachRow(r => r.eachCell(c => { if (!c.font) c.font = { name: 'MS UI Gothic', size: 10 }; else c.font.name = 'MS UI Gothic'; }));
        });
        const buffer = await workbook.xlsx.writeBuffer(), link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([buffer]));
        link.download = targetWorker === 'all' ? `日報一括_${selectedDate}.xlsx` : `作業日報_${targetWorker.replace(/ \[.*?\]$/, '')}_${selectedDate}.xlsx`;
        link.click(); showToast("ビジネス日報の編纂が完了しました。👔✨", '🚀'); closeDailyReportModal();
    } catch (e) { console.error("Excel Export Error:", e); showToast("編纂中にエラーが発生したよ。🧙‍♂️", '⚠️'); }
};

window.openMiracleModal = function(initialWorker) {
    const sel = document.getElementById('miracle-worker-select');
    if (sel) { sel.innerHTML = data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join('') + '<option value="全体">👥 チーム全体</option>'; sel.value = initialWorker || document.getElementById('worker-select').value || (data.masterWorkers[0] || '全体'); }
    loadMiracleForSelectedWorker(); document.getElementById('miracle-modal').style.display = 'flex'; lucide.createIcons();
};
window.loadMiracleForSelectedWorker = function() {
    const w = document.getElementById('miracle-worker-select').value, day = getDayData(selectedDate), m = (day.miracles || {})[w] || { rating: 0, comment: '' };
    tempMiracleRating = m.rating; document.getElementById('miracle-comment-input').value = m.comment; updateStarUI(m.rating);
    document.getElementById('miracle-comment-area').style.display = m.rating > 0 ? 'block' : 'none';
    document.getElementById('miracle-delete-area').style.display = m.rating > 0 ? 'block' : 'none';
    document.querySelector('#miracle-modal h2').textContent = w === '全体' ? 'チーム全体のキセキ' : `${w.replace(/ \[.*?\]$/, '')}さんのキセキ`;
};
window.closeMiracleModal = () => document.getElementById('miracle-modal').style.display = 'none';
window.saveMiracle = function() {
    const day = getDayData(selectedDate), w = document.getElementById('miracle-worker-select').value;
    if (!day.miracles) day.miracles = {}; 
    day.miracles[w] = { rating: tempMiracleRating, comment: document.getElementById('miracle-comment-input').value.trim() };
    
    // 🌟 【魔法】キセキの粒子（ミラクルピンク）を発動！
    if (window.MiracleMagic) {
        window.MiracleMagic.burst(window.innerWidth / 2, window.innerHeight / 2, 'miracle', 60);
    }

    saveAndRefresh(); closeMiracleModal(); celebrate(); showToast(`${w === '全体' ? 'チーム' : w.replace(/ \[.*?\]$/, '') + 'さん'}のキセキを刻みました！✨🚀`, '🌟');
};
window.deleteMiracleFromModal = function() { const w = document.getElementById('miracle-worker-select').value; if(confirm(`${w.replace(/ \[.*?\]$/, '')}のキセキを空へ還す？🕊️✨`)) { const day = getDayData(selectedDate); delete day.miracles[w]; saveAndRefresh(); closeMiracleModal(); showToast("キセキを空の彼方へ。🌌", '✨'); } };
window.setMiracleRating = (r) => { tempMiracleRating = r; updateStarUI(r); document.getElementById('miracle-comment-area').style.display = 'block'; };
function updateStarUI(r) { document.querySelectorAll('#star-container span').forEach((s, i) => s.classList[i < r ? 'add' : 'remove']('active')); }

// --- 週報作成の魔法 ---
window.openWeeklyReportModal = () => { 
    const sel = document.getElementById('report-worker-select');
    if (sel) sel.innerHTML = data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join(''); 
    const end = new Date(), start = new Date(); start.setDate(end.getDate()-6); 
    const sInp = document.getElementById('report-start'), eInp = document.getElementById('report-end');
    if (sInp) sInp.value = start.toLocaleDateString('sv-SE'); 
    if (eInp) eInp.value = end.toLocaleDateString('sv-SE'); 
    const modal = document.getElementById('weekly-report-modal');
    if (modal) modal.style.display='flex'; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
window.closeWeeklyReportModal = () => { const m = document.getElementById('weekly-report-modal'); if(m) m.style.display='none'; };

window.generateWeeklyReport = async function() {
    const sStr = document.getElementById('report-start')?.value, eStr = document.getElementById('report-end')?.value, target = document.getElementById('report-worker-select')?.value;
    if(!sStr || !eStr || !target) return; 

    // 🌟 【Ver.2.0.0】 集計前に一括ロード
    await window.loadDailyRange(sStr, eStr);

    const sDate = new Date(sStr), eDate = new Date(eStr);
    
    let totalHrs = 0, bizDays = 0, taskSum = {}, remarks = [];
    
    for(let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
        const k = d.toLocaleDateString('sv-SE'), day = getDayData(k), tasks = day.tasks.filter(t => t.worker === target);
        const validTasks = tasks.filter(t => !data.masterSpecials.includes(t.name) && t.name !== '休憩');
        
        if(validTasks.length > 0) {
            bizDays++;
            validTasks.sort((a,b)=>a.start.localeCompare(b.start)).forEach(t => {
                const hrs = parseFloat(t.duration) || 0;
                totalHrs += hrs;
                taskSum[t.name] = (taskSum[t.name] || 0) + hrs;
                if(t.target || t.remark) {
                    remarks.push(`${d.getMonth()+1}月${d.getDate()}日: ${t.name}(${(t.target ? `[${t.target}] ` : "") + (t.remark || "")})`);
                }
            });
        }
    }
    
    let report = `【週次報告】${target.replace(/ \[.*?\]$/, '')}\n`;
    report += `期間: ${sStr} 〜 ${eStr}\n`;
    report += `合計: ${totalHrs.toFixed(1)}h (${bizDays}日)\n\n`;
    
    report += `■業務内訳\n`;
    Object.entries(taskSum).sort((a,b) => b[1] - a[1]).forEach(([name, hrs]) => {
        report += `・${name.padEnd(10, ' ')}: ${hrs.toFixed(1)}h\n`;
    });
    
    report += `\n■主な実施内容\n`;
    if (remarks.length > 0) {
        remarks.slice(0, 15).forEach(r => {
            report += `・${r}\n`;
        });
    } else {
        report += `・特記事項なし\n`;
    }
    
    const txt = document.getElementById('report-text'); if(txt) txt.value = report;
    showToast("キセキを凝縮した週報を生成しました！📊✨", 'success');
};

window.copyWeeklyReport = () => { 
    const t = document.getElementById('report-text'); 
    if (!t) return; t.select(); document.execCommand('copy'); 
    showToast("報告書をクリップボードに記憶したよ！📋✨", 'success'); 
};

// 時間を数値に変換する魔法
const timeToDec = (t) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h + m/60; };

window.exportCompanyExcel = async function() {
    const sStr = document.getElementById('report-start')?.value, eStr = document.getElementById('report-end')?.value, target = document.getElementById('report-worker-select')?.value;
    if(!sStr || !eStr || !target || typeof ExcelJS === 'undefined') return showToast("Excelの準備ができていないようです。🧠💦", 'warning');

    showToast("会社提出用「タイムライン週報」を編纂中...👔✨", '📜');

    try {
        let minH = 24, maxH = 0;
        const dayDataList = [];
        const sDate = new Date(sStr), eDate = new Date(eStr);

        for(let d = new Date(sDate); d <= eDate; d.setDate(d.getDate()+1)) {
            const k = d.toLocaleDateString('sv-SE'), day = getDayData(k);
            dayDataList.push({ key: k, data: day, date: new Date(d) });
            [...day.plans, ...day.tasks].filter(it => it.worker === target).forEach(it => {
                const s = timeToDec(it.start), e = timeToDec(it.end);
                if (s < minH) minH = s;
                if (e > maxH) maxH = e;
            });
        }

        if (minH === 24) { minH = 8; maxH = 17; }
        minH = Math.max(0, Math.floor(minH) - 1);
        maxH = Math.min(24, Math.ceil(maxH) + 1);

        const totalSlots = (maxH - minH) * 2;
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('タイムライン週報');

        const cols = [
            { header: '日付', width: 10 },
            { header: '曜日', width: 5 },
            { header: '種別', width: 8 }
        ];
        for(let h = minH; h < maxH; h++) {
            cols.push({ header: h+':00', width: 6 }, { header: '', width: 6 });
        }
        cols.push({ header: '主な実施内容・備考', width: 50 });
        ws.columns = cols;

        const titleRow = ws.addRow([`週間業務報告書 (${target.replace(/ \[.*?\]$/, '')})`]);
        titleRow.font = { bold: true, size: 18 };
        ws.addRow([]);

        const headerRow = ws.addRow(cols.map(c => c.header));
        headerRow.eachCell((c, i) => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
            c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'medium'}, right: {style:'thin'} };
        });
        for (let i = 0; i < (maxH - minH); i++) {
            ws.mergeCells(headerRow.number, 4 + i*2, headerRow.number, 5 + i*2);
        }

        dayDataList.forEach(entry => {
            const day = entry.data, d = entry.date, dateStr = (d.getMonth()+1) + "/" + d.getDate(), dayStr = ["日","月","火","水","木","金","土"][d.getDay()];
            const filter = (it) => it.worker === target;

            const addRows = (type, items) => {
                const r1 = ws.addRow([dateStr, dayStr, type, ...Array(totalSlots).fill(""), ""]), r2 = ws.addRow(["", "", "", ...Array(totalSlots).fill(""), ""]);
                [r1, r2].forEach((r, idx) => {
                    for(let i=1; i <= totalSlots + 4; i++) {
                        const c = r.getCell(i);
                        c.border = { 
                            top: idx === 0 ? {style:'thin'} : {style:'hair'}, 
                            bottom: idx === 0 ? {style:'hair'} : {style:'thin'}, 
                            left: {style:'thin'}, 
                            right: (i >= 4 && i % 2 === 1 && i < totalSlots + 3) ? {style:'hair'} : {style:'thin'} 
                        };
                        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: type==='予定' ? 'FFF8FAFC' : 'FFFFFFFF' } };
                    }
                });

                const slots = Array(totalSlots).fill(null).map((_, i) => ({ s: minH + i*0.5, e: minH + 0.5 + i*0.5, t: {} }));
                items.forEach(it => {
                    const sD = timeToDec(it.start), eD = timeToDec(it.end);
                    slots.forEach(sl => {
                        const overlap = Math.min(eD, sl.e) - Math.max(sD, sl.s);
                        if (overlap > 0) {
                            const k = it.name + '::' + (it.target || '');
                            sl.t[k] = (sl.t[k] || 0) + overlap;
                        }
                    });
                });

                const winners = slots.map(sl => {
                    let w = null, max = 0;
                    Object.entries(sl.t).forEach(([k, v]) => { if (v > max) { max = v; w = { n: k.split('::')[0], t: k.split('::')[1] }; } });
                    return w;
                });

                for(let i=0; i < totalSlots; ) {
                    if(!winners[i]) { i++; continue; }
                    let j = i+1;
                    while(j < totalSlots && winners[j] && winners[j].n === winners[i].n && winners[j].t === winners[i].t) j++;
                    const sCol = i + 4, eCol = j + 3;
                    if (sCol <= eCol) {
                        try { ws.mergeCells(r1.number, sCol, r1.number, eCol); ws.mergeCells(r2.number, sCol, r2.number, eCol); } catch(e){}
                    }
                    const c1 = r1.getCell(sCol), c2 = r2.getCell(sCol);
                    // Excel専用の純粋な色取得
                    const rawColor = (data.excelColors && data.excelColors[winners[i].n]) || (getColorMap()[winners[i].n]) || '#cbd5e1';
                    const argb = 'FF' + rawColor.replace('#', '');

                    c1.value = winners[i].n; c2.value = winners[i].t;
                    c1.font = { bold: true, size: 9 }; c2.font = { size: 8 };
                    [c1, c2].forEach(c => { 
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
                        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    });
                    i = j;
                }
                return { r1, r2 };
            };

            const pR = addRows("予定", day.plans.filter(filter)), aR = addRows("実績", day.tasks.filter(filter));
            const rems = [...day.plans.filter(filter), ...day.tasks.filter(filter)].map(it => it.target || it.remark ? `${it.name}${it.target ? ' ['+it.target+']' : ''}${it.remark ? ': '+it.remark : ''}` : "").filter(Boolean);
            try {
                ws.mergeCells(pR.r1.number, 1, aR.r2.number, 1);
                ws.mergeCells(pR.r1.number, 2, aR.r2.number, 2);
                const noteCol = 3 + totalSlots + 1;
                ws.mergeCells(pR.r1.number, noteCol, aR.r2.number, noteCol);
                const noteCell = ws.getCell(pR.r1.number, noteCol);
                noteCell.value = [...new Set(rems)].join("\n");
                noteCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            } catch(e){}
        });

        const buffer = await workbook.xlsx.writeBuffer(), link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([buffer])); link.download = `会社週報_${target.replace(/ \[.*?\]$/, '')}_${sStr}.xlsx`;
        link.click();
        showToast("「最強のタイムライン週報」を編纂しました！💼✨", 'success');
    } catch (e) {
        console.error(e);
        showToast("Excel出力に失敗したよ。🧙‍♂️", 'warning');
    }
};
document.addEventListener('click', (e) => { if(!e.target.closest('button')) { const l = document.getElementById('pattern-quick-list'); if(l) l.style.display='none'; } });
