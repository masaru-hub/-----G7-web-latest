// --- core.js: Ver.2.0.0 データ構造分離アップデート ---
lucide.createIcons();
const STORAGE_KEY = 'today_work_proto_v2'; 
const PATH_MASTER = { collection: "work_manager", doc: "master_data" };
const COLL_DAILY = "daily_logs";

let currentMode = 'actual', currentCategory = 'work', selectedDate = new Date().toLocaleDateString('sv-SE'), editingPatternId = null;
const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7', '#f43f5e', '#22c55e', '#eab308', '#3b82f6'];
const specialPalette = ['#fb7185', '#fb923c', '#facc15', '#f472b6', '#fb7185'];
const meetingPalette = ['#0ea5e9', '#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4'];
const defaultSpecialTasks = ['有給(全日)', 'AM有給', 'PM有給', '欠勤', '遅刻', '早退'], meetingTasks = [];
let ganttChart = null, ratioChart = null, dashTrendChart = null, dashRatioChart = null;
let ganttViewMode = 'all'; // 'all' (全て) or 'actual' (足跡)

window.setGanttViewMode = function(mode) {
    ganttViewMode = mode;
    const btnAll = document.getElementById('btn-gantt-all'), btnAct = document.getElementById('btn-gantt-actual');
    if (btnAll && btnAct) {
        if (mode === 'all') {
            btnAll.style.background = '#fef3c7'; btnAll.style.color = '#d97706'; btnAll.style.borderColor = '#fbbf24';
            btnAct.style.background = 'transparent'; btnAct.style.color = '#64748b'; btnAct.style.borderColor = 'transparent';
        } else {
            btnAll.style.background = 'transparent'; btnAll.style.color = '#64748b'; btnAll.style.borderColor = 'transparent';
            btnAct.style.background = '#e0f2fe'; btnAct.style.color = '#0284c7'; btnAct.style.borderColor = '#7dd3fc';
        }
    }
    renderChart();
};

// データ初期化 (dailyはキャッシュとして保持)
let data = {
    daily: {}, // メモリ上のキャッシュ
    masterWorkers: ['自分'],
    masterTasks: [],
    masterSpecials: [...defaultSpecialTasks],
    config: { start: '00:00', end: '00:00', breakThreshold: 6, breakDuration: 60 },
    workPatterns: [],
    favorites: [],
    resultRequiredTasks: [],
    excelColors: {},
    taskStyles: {},
    announcements: [],
    quests: [],
    links: []
};

// ローカルストレージから一時的に復元（オフライン対応）
const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (localData) {
    Object.assign(data, localData);
    ['favorites', 'resultRequiredTasks', 'taskStyles', 'excelColors', 'workPatterns', 'announcements', 'quests', 'links'].forEach(k => {
        if (!data[k]) data[k] = (k === 'taskStyles' || k === 'excelColors') ? {} : [];
    });
}

// 共通ヘルパー関数
window.timeToDec = (t) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h + m/60; };
window.toISO = (d, t) => `${d}T${t}:00`;
window.getNextDate = (d) => { const date = new Date(d); date.setDate(date.getDate()+1); return date.toLocaleDateString('sv-SE'); };
window.getPrevDate = (d) => { const date = new Date(d); date.setDate(date.getDate()-1); return date.toLocaleDateString('sv-SE'); };
window.getDiffHrs = (s, e) => { if (!s || !e) return "0.0"; return ((new Date(e) - new Date(s)) / 3600000).toFixed(1); };
window.getDayData = (date) => { if (!data.daily[date]) data.daily[date] = { tasks: [], plans: [] }; return data.daily[date]; };

// 【進化】複数日付ロードエンジン
window.loadMultipleDates = async function(dates) {
    if (!window.kizunaRepo) return;
    
    await Promise.all(dates.map(async (date) => {
        if (!date) return;
        if (data.daily[date]) return; // キャッシュヒット！

        try {
            const dailyData = await window.kizunaRepo.getDailyData(date);
            data.daily[date] = dailyData;
        } catch (e) {
            console.error(`Daily Load Error (${date}):`, e);
        }
    }));
};

// 特定の日付のデータをロードする関数（後方互換用）
window.loadDailyData = async function(date) { await window.loadMultipleDates([date]); };

// 期間一括ロードエンジン（分析用）
window.loadDailyRange = async function(startDate, endDate) {
    if (!window.kizunaRepo) return;

    try {
        const results = await window.kizunaRepo.getDailyRange(startDate, endDate);
        Object.assign(data.daily, results);
        console.log(`🚀 Range Load Complete: ${startDate} to ${endDate} (${Object.keys(results).length} days)`);
    } catch (e) {
        console.error("Range Load Error:", e);
    }
};

// Firebase初期化と同期 (MasterとDailyの2段構え)
let dailyUnsubscribe = null; // 現在の監視を解除するための変数

window.initApp = async () => {
    const statusIcon = document.getElementById('sync-icon'), statusText = document.getElementById('sync-text');
    const setStatus = (icon, text, color) => { if(statusIcon) statusIcon.innerText = icon; if(statusText) { statusText.innerText = text; statusText.style.color = color || 'inherit'; } };

    if (!window.kizunaRepo) { 
        setStatus('❌', '通信エラー', '#ef4444');
        renderUI(); return; 
    }

    // --- STEP 1: Masterデータのロードと監視 ---
    try {
        const mData = await window.kizunaRepo.getMasterData();
        if (mData) {
            console.log("📦 Cloud Master Data loaded.");
            const dailyCache = data.daily || {};
            Object.assign(data, mData);
            data.daily = dailyCache;
        } else {
            console.log("ℹ️ Cloud Master Data is empty. Using local data.");
            // 初回起動時などは、今のdataを保存してクラウド側の空を埋める
            await saveAndRefresh('master');
        }
        
        // Masterデータのリアルタイム監視 (設定変更を即座に反映)
        window.kizunaRepo.subscribeMasterData((cloudMaster) => {
            console.log("🔄 Master Data Synced from Cloud.");
            const dailyCache = data.daily; 
            Object.assign(data, cloudMaster);
            data.daily = dailyCache; 
            renderUI();
            setStatus('📡', '接続済み', '#10b981');
        });

        setStatus('📡', '接続済み', '#10b981');
    } catch (e) { 
        console.error("Master Loading Error", e); 
        setStatus('⚠️', 'オフライン', '#f59e0b');
    }

    // --- STEP 2: 今日のデータのリアルタイム監視を開始 ---
    window.setupDailySubscription(selectedDate);

    renderUI();
};

// 特定の日付の監視をセットアップする関数
window.setupDailySubscription = (date) => {
    if (!window.kizunaRepo) return;
    
    // 既存の監視があれば解除
    if (dailyUnsubscribe) dailyUnsubscribe();

    // 新しい日付の監視を開始
    dailyUnsubscribe = window.kizunaRepo.subscribeDailyData(date, (freshData) => {
        // クラウドからの最新データをキャッシュに反映
        data.daily[date] = freshData;
        
        // UIを再描画
        renderUI();
        
        // 未完了タスクのバッジ等も更新
        if (typeof updateResultEntryButton === 'function') updateResultEntryButton();
    });
};

window.saveAndRefresh = async function(type = 'both') {
    if (!window.kizunaRepo) return;

    try {
        if (type === 'master' || type === 'both') {
            const masterDataToSave = { ...data };
            delete masterDataToSave.daily; 
            await window.kizunaRepo.saveMasterData(masterDataToSave);
        }
        if (type === 'daily' || type === 'both') {
            // ミラクル（評価）のみを保存（タスク本体は個別に保存されるようになったため）
            const dayData = getDayData(selectedDate);
            if (dayData.miracles) {
                await window.kizunaRepo.saveMiracles(selectedDate, dayData.miracles);
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Cloud Sync Error:", e);
    }
    
    if (typeof renderUI === 'function') renderUI();
};

// 【重要】日付変更時の挙動をアップデート
window.changeDate = async function() {
    const newDate = document.getElementById('target-date')?.value;
    if (!newDate) return;
    
    selectedDate = newDate;
    
    // --- 【進化】新しい日付のリアルタイム監視に切り替え ---
    if (typeof window.setupDailySubscription === 'function') {
        window.setupDailySubscription(selectedDate);
    }

    const prevDate = getPrevDate(selectedDate);
    // 前日のデータなどは一括ロードで補完
    await window.loadMultipleDates([prevDate]);

    // スタッフ情報のクリア
    const wId = document.getElementById('worker-id-input'), wSel = document.getElementById('worker-select');
    if (wId) wId.value = '';
    if (wSel) wSel.value = '';
    const dWorker = document.getElementById('display-worker');
    if (dWorker) dWorker.innerText = "スタッフを選択 👤";

    renderUI();
};

window.setTask = function(name) { 
    const inp = document.getElementById('task-input'); 
    if(inp) { 
        inp.value = name; 
        if(window.checkSpecialTask) window.checkSpecialTask(); 
        const labelTarget = document.getElementById('target-label'), labelRemark = document.getElementById('remark-label');
        const isRes = (data.resultRequiredTasks || []).includes(name);
        [labelTarget, labelRemark].forEach(label => { if(label) { if(isRes) label.classList.add('label-passion'); else label.classList.remove('label-passion'); } });
    } 
};
window.closeLargeGuide = function() { const m = document.getElementById('large-guide-modal'); if(m) m.style.display = 'none'; };

window.getColorMap = () => {
    const map = { '休憩': '#94a3b8', '移動': '#64748b' };
    data.masterTasks.forEach((n, i) => map[n] = meetingTasks.includes(n) ? meetingPalette[meetingTasks.indexOf(n) % meetingPalette.length] : palette[i % palette.length]);
    data.masterSpecials.forEach((n, i) => map[n] = specialPalette[i % specialPalette.length]);
    if (data.excelColors) Object.assign(map, data.excelColors);
    return map;
};

window.getStyle = (name, isPlan = false) => {
    const custom = data.taskStyles[name] || { color: getColorMap()[name] || '#cbd5e1', pattern: 'auto' };
    const baseColor = custom.color, patternType = custom.pattern;
    if (patternType === 'none') return isPlan ? baseColor + '44' : baseColor;
    if (patternType === 'auto') {
        const isM = meetingTasks.includes(name), isS = data.masterSpecials.includes(name);
        if (name === '休憩' || name === '移動' || (!isM && !isS && data.masterTasks.indexOf(name) % 2 === 0)) return isPlan ? baseColor + '44' : baseColor;
        return createPatternCanvas(baseColor, isM ? 'stripe' : (isS ? 'dot' : 'slash'), isPlan);
    }
    return createPatternCanvas(baseColor, patternType, isPlan);
};

function createPatternCanvas(color, type, isPlan) {
    const size = 12, pC = document.createElement('canvas'); pC.width = size; pC.height = size;
    const pX = pC.getContext('2d');
    pX.fillStyle = color; pX.globalAlpha = isPlan ? 0.3 : 1.0; pX.fillRect(0, 0, size, size);
    pX.globalAlpha = isPlan ? 0.2 : 0.5; pX.strokeStyle = '#fff'; pX.fillStyle = '#fff'; pX.lineWidth = 1.2;
    if (type === 'stripe' || type === 'slash') { pX.beginPath(); pX.moveTo(0, size); pX.lineTo(size, 0); pX.stroke(); }
    else if (type === 'dot') { pX.beginPath(); pX.arc(size/2, size/2, 2.5, 0, Math.PI*2); pX.fill(); }
    else if (type === 'grid') { pX.beginPath(); pX.moveTo(0,0); pX.lineTo(size,size); pX.moveTo(0,size); pX.lineTo(size,0); pX.stroke(); }
    else if (type === 'star') {
        const drawStar = (cx, cy, s, o, i) => { let r = Math.PI/2*3, x, y, st = Math.PI/s; pX.beginPath(); pX.moveTo(cx, cy-o); for(let j=0; j<s; j++){ x=cx+Math.cos(r)*o; y=cy+Math.sin(r)*o; pX.lineTo(x,y); r+=st; x=cx+Math.cos(r)*i; y=cy+Math.sin(r)*i; pX.lineTo(x,y); r+=st; } pX.closePath(); pX.fill(); };
        drawStar(size/2, size/2, 4, 4, 1.5);
    }
    return pX.createPattern(pC, 'repeat');
}

window.showToast = (msg, val = '⚡') => {
    const t = document.getElementById('toast'); if(!t) return;
    t.className = 'toast'; let icon = val, typeClass = '';
    const mapping = { 'success': { c: 'toast-success', i: '✅' }, 'warning': { c: 'toast-warning', i: '⚠️' }, 'error': { c: 'toast-warning', i: '🚨' }, 'info': { c: 'toast-info', i: 'ℹ' }, 'miracle': { c: 'toast-miracle', i: '🌟' } };
    if (mapping[val]) { typeClass = mapping[val].c; icon = mapping[val].i; } else {
        if (['🔥','🚀','✅','🏆','🎊','✨'].includes(val)) typeClass = 'toast-success';
        else if (['⚠️','🚨','❌','🛑'].includes(val)) typeClass = 'toast-warning';
        else if (['ℹ','🛰️','🗺️','🚙','🚗','🚌','🌿','☕','📜','📋'].includes(val)) typeClass = 'toast-info';
        else if (['🌟','💎','🔮'].includes(val)) typeClass = 'toast-miracle';
    }
    if (typeClass) t.classList.add(typeClass); t.innerHTML = `<span>${icon}</span> ${msg}`; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
};

window.celebrate = () => { for (let i=0; i<40; i++) { const el = document.createElement('div'); el.className = 'gold-dust-particle'; el.style.left = Math.random()*100+'vw'; el.style.top = '100vh'; el.style.setProperty('--tx', (Math.random()*200-100)); el.style.animationDuration = (Math.random()*2+1)+'s'; document.body.appendChild(el); setTimeout(() => el.remove(), 3000); } };

let timeTravelMode = 'real';
window.toggleTimeTravel = function() {
    celebrate(); 
    const modes = ['real', 'morning', 'day', 'evening', 'night'];
    const currentIdx = modes.indexOf(timeTravelMode);
    timeTravelMode = modes[(currentIdx + 1) % modes.length];
    let msg = "", icon = "⏳";
    if (timeTravelMode === 'real') { msg = "現実の刻（とき）に戻りました ✨"; icon = "🌍"; } 
    else { const labels = { 'morning': '朝', 'day': '昼', 'evening': '夕方', 'night': '夜' }; msg = `【時の旅】 ${labels[timeTravelMode]}の刻へタイムトラベル！ 🚀`; }
    showToast(msg, icon); updateClock(); 
};

function updateClock() {
    const now = new Date(), h = now.getHours().toString().padStart(2, '0'), m = now.getMinutes().toString().padStart(2, '0'), s = now.getSeconds().toString().padStart(2, '0');
    const el = document.getElementById('current-time'); if (el) el.textContent = `${h}:${m}:${s}`;
    let displayHour = now.getHours();
    if (timeTravelMode === 'morning') displayHour = 7;
    else if (timeTravelMode === 'day') displayHour = 12;
    else if (timeTravelMode === 'evening') displayHour = 17;
    else if (timeTravelMode === 'night') displayHour = 21;
    updateHeaderMagic(displayHour);
    if (currentMode === 'actual') {
        const area = document.getElementById('time-settings-area');
        if (area && area.style.display === 'none') {
            const si = document.getElementById('start-time'), ei = document.getElementById('end-time');
            if (si) si.value = `${h}:${m}`; if (ei) ei.value = `${h}:${m}`;
        }
    }
}

function updateHeaderMagic(hour) {
    const header = document.getElementById('main-header'), iconEl = document.getElementById('header-logo-icon'), line1El = document.getElementById('header-logo-line1');
    if (!header || !iconEl || !line1El) return;
    let themeClass = '', messagePrefix = '', symbolIcon = '';
    if (hour >= 5 && hour < 10) { themeClass = 'header-morning'; messagePrefix = 'Good Morning! おはようの'; symbolIcon = '<circle cx="12" cy="7" r="3" fill="#fbbf24" /><path d="M5 10l2-1 2 1M15 10l2-1 2 1" stroke="#fbbf24" />'; }
    else if (hour >= 10 && hour < 16) { themeClass = 'header-day'; messagePrefix = 'Brilliant Day! 輝くお仕事の'; symbolIcon = '<path d="M12 4l2 3 3 1-2 3 1 3-3-2-3 2 1-3-2-3 3-1z" fill="#fde68a" />'; }
    else if (hour >= 16 && hour < 19) { themeClass = 'header-evening'; messagePrefix = 'Sunset Cheers! お疲れ様の'; symbolIcon = '<path d="M12 4v4M18 6l-2 2M6 6l2 2" stroke="#fbbf24" stroke-width="2"/><circle cx="12" cy="11" r="4" fill="#f59e0b" />'; }
    else { themeClass = 'header-night'; messagePrefix = 'Starry Night! 明日に繋ぐ'; symbolIcon = '<path d="M12 3a9 9 0 1 0 9 9 5 5 0 0 1-9-9z" fill="#e2e8f0" />'; }
    ['header-morning', 'header-day', 'header-evening', 'header-night'].forEach(t => header.classList.remove(t)); header.classList.add(themeClass);
    line1El.textContent = messagePrefix;
    iconEl.innerHTML = `<svg class="kizuna-crest-icon kizuna-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 40px; height: 40px; color: white;">${symbolIcon}<path d="M7 22c0 0 1 1 5 1s5-1 5-1" /><path d="M12 19c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3z" fill="rgba(255,255,255,0.2)" /><path d="M8 23l-3 1M16 23l3 1" /></svg>`;
}

window.renderUI = function() {
    const today = new Date(); today.setHours(0,0,0,0);
    data.announcements = (data.announcements || []).filter(a => !a.expiresAt || new Date(a.expiresAt) >= today);
    const day = getDayData(selectedDate), prev = getDayData(getPrevDate(selectedDate));
    const miracleArea = document.getElementById('miracle-action-area'); if (miracleArea) miracleArea.style.display = currentMode === 'actual' ? 'flex' : 'none';
    document.getElementById('target-date').value = selectedDate;
    const d = new Date(selectedDate), w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    document.getElementById('current-date').textContent = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}（${w}）`;
    const wSel = document.getElementById('worker-select');
    const currentVal = wSel ? wSel.value : '';
    wSel.innerHTML = '<option value="">選択</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join('');
    if (window.forceResetWorker) { wSel.value = ''; window.forceResetWorker = false; } else { wSel.value = currentVal; }
    const hSel = document.getElementById('history-worker-select'); if (hSel) { const cVal = hSel.value; hSel.innerHTML = '<option value="all">👥 全員</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join(''); hSel.value = cVal || 'all'; }
    const baseTasks = currentCategory === 'work' ? data.masterTasks : data.masterSpecials;
    const sortedTasks = [...baseTasks].sort((a,b) => (data.favorites.includes(a)?1:0) - (data.favorites.includes(b)?1:0));
    document.getElementById('task-list').innerHTML = sortedTasks.map(t => `<option value="${t}">`).join('');
    const favArea = document.getElementById('fav-buttons'); if (currentCategory === 'work' && data.favorites.length) { const map = getColorMap(); favArea.className = 'fav-container'; favArea.style.display = 'grid'; favArea.innerHTML = data.favorites.map(f => `<button type="button" class="fav-chip" style="background-color:${map[f] || '#cbd5e1'}" onclick="setTask('${f}')">${f}</button>`).join(''); } else { favArea.style.display = 'none'; }
    const mwList = document.getElementById('master-workers-list'); if(mwList) mwList.innerHTML = data.masterWorkers.map((w,i)=>`<div class="master-item">${w}<span onclick="removeMaster('worker',${i})" style="color:red;cursor:pointer;padding:5px;">×</span></div>`).join('');
    const mtList = document.getElementById('master-tasks-list'); if(mtList) mtList.innerHTML = data.masterTasks.map((t,i)=>({t,i})).sort((a,b)=>(data.favorites.includes(a.t)?1:0)-(data.favorites.includes(b.t)?1:0)).map(({t,i})=>`<div class="master-item"><span onclick="toggleFavorite('${t}')" style="cursor:pointer;margin-right:8px;color:${data.favorites.includes(t)?'#f59e0b':'#cbd5e1'}"><i data-lucide="star" style="width:14px;fill:${data.favorites.includes(t)?'#f59e0b':'none'}"></i></span>${t}<span onclick="removeMaster('task',${i})" style="color:red;cursor:pointer;margin-left:auto;padding:5px;">×</span></div>`).join('');
    const pList = document.getElementById('pattern-list'); if(pList) pList.innerHTML = (data.workPatterns || []).map(t => `<div class="master-item"><div style="cursor:pointer; flex:1;" onclick="openPatternModal(${t.id})"><b>${t.name}</b><br><small>${t.plans.length}工程</small></div><button class="btn-small btn-outline" onclick="openPatternModal(${t.id})">編集</button><span onclick="deletePattern(${t.id})" style="color:red;cursor:pointer; margin-left:8px; font-weight:bold;">×</span></div>`).join('');
    const badgeContainer = document.getElementById('miracle-badge-container'), teamArea = document.getElementById('team-miracle-area'), staffArea = document.getElementById('staff-miracles-area'), currentWorker = document.getElementById('worker-select').value;
    let teamHtml = '', staffHtml = '';
    if (day.miracles && Object.keys(day.miracles).length > 0) {
        Object.entries(day.miracles).forEach(([worker, m]) => {
            if (m.rating === 0) return;
            const stars = '★'.repeat(m.rating) + '☆'.repeat(5-m.rating), isMe = (currentWorker && worker === currentWorker) || (!currentWorker && window.lastMiracleWorker === worker);
            if (worker === '全体') { teamHtml += `<div class="hex-wrapper-blue ${window.lastMiracleWorker===worker?'miracle-new-entry':''}"><div class="miracle-hex-base miracle-hex-blue"><div class="crystal-header-hex"><i data-lucide="gem" style="width:20px;"></i><span class="crystal-title-hex">キセキの結晶</span><div class="gem-stars" style="font-size:16px; letter-spacing:2px;">${stars}</div></div><div class="crystal-comment-hex">${m.comment || '今日も一日、最高のチームプレイでした！✨'}</div></div></div>`; }
            else { staffHtml += `<div class="hex-wrapper-orange" style="margin: 5px;"><div class="miracle-hex-base miracle-hex-small miracle-hex-orange ${isMe?'hex-is-me':''} ${window.lastMiracleWorker===worker?'miracle-new-entry':''}"><div class="crystal-header-hex"><i data-lucide="sparkles" style="width:16px;"></i><span class="crystal-title-hex">${worker.replace(/ \[.*?\]$/, '')}</span><div class="gem-stars" style="font-size:12px;">${stars}</div></div><div class="crystal-comment-hex">${m.comment || '---'}</div></div></div>`; }
        });
    }
    if (teamHtml || staffHtml) { teamArea.innerHTML = teamHtml; staffArea.innerHTML = staffHtml ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;">${staffHtml}</div>` : ''; badgeContainer.style.display = 'block'; }
    else { badgeContainer.style.display = 'none'; }
    const tbody = document.getElementById('task-tbody'); 
    if (tbody) {
        tbody.innerHTML = ''; const searchTerm = (document.getElementById('history-search')?.value || '').toLowerCase();
        const tailsAct = prev.tasks.filter(t => t.endISO > toISO(selectedDate, '00:00')).map(t => ({...t, type:'実(継)', isTail:true}));
        const tailsPln = prev.plans.filter(p => p.endISO > toISO(selectedDate, '00:00')).map(p => ({...p, type:'予(継)', isTail:true}));
        const all = [...tailsAct, ...tailsPln, ...day.tasks.map((t,i)=>({...t,type:'実',idx:i})), ...day.plans.map((p,i)=>({...p,type:'予',idx:i}))].filter(item => !searchTerm || item.worker.replace(/ \[.*?\]$/, '').toLowerCase().includes(searchTerm)).sort((a,b)=>a.start.localeCompare(b.start));
        all.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td><span class="badge" style="background:${item.type.includes('予')?'#e2e8f0':'#fef3c7'}">${item.type}</span></td><td>${item.worker.replace(/ \[.*?\]$/, '')}</td><td>${item.name}${item.remark?`<br><small>(${item.remark})</small>`:''}</td><td>${item.isTail?'00:00':item.start}-${item.end}</td><td>${item.duration}h</td><td>${item.isTail?'':`<button onclick="deleteItem('${item.type}',${item.idx})" class="btn-small">消</button>`}</td>`; tbody.appendChild(tr); });
    }
    const actH = day.tasks.filter(t => !data.masterSpecials.includes(t.name.trim()) && t.name!=='休憩').reduce((s, t) => s + parseFloat(t.duration), 0);
    const plnH = day.plans.filter(p => !data.masterSpecials.includes(p.name.trim()) && p.name!=='休憩').reduce((s, p) => s + parseFloat(p.duration), 0);
    const sActual = document.getElementById('stat-actual'), sPlan = document.getElementById('stat-plan'), sDiff = document.getElementById('stat-diff');
    if(sActual) sActual.textContent = actH.toFixed(1)+'h'; if(sPlan) sPlan.textContent = plnH.toFixed(1)+'h'; if(sDiff) sDiff.textContent = (actH-plnH).toFixed(1)+'h';
    renderChart(); if (window.renderExcelSettings) window.renderExcelSettings(); if (window.renderKizuna) window.renderKizuna(); lucide.createIcons();
};

window.renderExcelSettings = function() {
    const listEl = document.getElementById('excel-colors-list'); if (!listEl) return;
    const kws = [...new Set(['休憩','移動',...meetingTasks,...data.masterTasks,...data.masterSpecials])];
    listEl.innerHTML = kws.map(kw => { const st = data.taskStyles[kw] || { color: getColorMap()[kw] || '#cbd5e1', pattern: 'auto' }; return `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; background: #f8fafc; padding: 6px; border-radius: 8px; border: 1px solid #e2e8f0;"><div id="sidebar-prev-${kw}" style="width:24px; height:24px; border-radius:4px; border:1px solid #cbd5e1; flex-shrink:0;"></div><span style="flex: 1; font-size: 11px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${kw}</span><input type="color" value="${st.color}" onchange="if(window.updateTaskStyle) window.updateTaskStyle('${kw}', this.value, null)" style="width:24px; height:24px; cursor:pointer; border:none; padding:0; background:none;"></div>`; }).join('');
    kws.forEach(kw => { const elP = document.getElementById(`sidebar-prev-${kw}`), st = getStyle(kw); if (!elP) return; if (typeof st === 'string') elP.style.backgroundColor = st; else { const c = document.createElement('canvas'); c.width = 24; c.height = 24; const x = c.getContext('2d'); x.fillStyle = st; x.fillRect(0, 0, 24, 24); elP.style.backgroundImage = `url(${c.toDataURL()})`; } });
};

function renderChart() {
    try {
        const day = getDayData(selectedDate), prev = getDayData(getPrevDate(selectedDate)), next = getDayData(getNextDate(selectedDate)), ctx = document.getElementById('ganttChart').getContext('2d');
        if(ganttChart) ganttChart.destroy();
        let base = timeToDec(data.config.start), end = timeToDec(data.config.end); if (end <= base) end += 24;
        const yL = data.masterWorkers.map(w => w.replace(/ \[.*?\]$/, '')), now = new Date(), startOfToday = new Date(selectedDate + 'T00:00:00'), nowDec = (now - startOfToday) / 3600000, isChartToday = selectedDate === now.toLocaleDateString('sv-SE'), ds = [];
        const taskNames = [...new Set([...data.masterTasks, ...data.masterSpecials, '休憩', '移動'])], getDecFromISO = (iso) => (new Date(iso) - startOfToday) / 3600000;
        const categories = ganttViewMode === 'all' ? [{ key: 'plans', labelSuffix: '(予)', isPlan: true, barPct: 0.9 }, { key: 'tasks', labelSuffix: '(実)', isPlan: false, barPct: 0.6 }] : [{ key: 'tasks', labelSuffix: '(実)', isPlan: false, barPct: 0.6 }];
        categories.forEach(cat => {
            taskNames.forEach(n => {
                const style = getStyle(n, cat.isPlan), allItems = [...prev[cat.key].map(t => ({...t, dayOff: -1})), ...day[cat.key].map(t => ({...t, dayOff: 0})), ...next[cat.key].map(t => ({...t, dayOff: 1}))].filter(t => t.name === n);
                if (allItems.length > 0) { ds.push({ label: n + cat.labelSuffix, backgroundColor: style, barPercentage: cat.barPct, categoryPercentage: 0.8, grouped: false, data: allItems.map(t => { let s = getDecFromISO(t.startISO), e = getDecFromISO(t.endISO), isLive = false; if (isChartToday && !cat.isPlan && t.dayOff === 0 && t.start === t.end && nowDec > s) { e = nowDec; isLive = true; } if (e <= base || s >= end) return null; const isContinued = t.startISO < selectedDate + 'T00:00:00'; return { x: [s, e], y: t.worker.replace(/ \[.*?\]$/, ''), start: t.start, end: t.end, isLive: isLive, name: isContinued ? `(継) ${t.name}` : t.name }; }).filter(v => v !== null) }); }
            });
        });
        const footprintPlugin = { id: 'footprintEffect', afterDatasetsDraw(chart) { const {ctx} = chart; const header = document.getElementById('main-header'); let deepColor = '#1e293b'; if (header.classList.contains('header-morning')) deepColor = '#022c22'; else if (header.classList.contains('header-day')) deepColor = '#082f49'; else if (header.classList.contains('header-evening')) deepColor = '#451a03'; else if (header.classList.contains('header-night')) deepColor = '#0f172a'; chart.data.datasets.forEach((dataset, datasetIndex) => { const meta = chart.getDatasetMeta(datasetIndex); meta.data.forEach((bar, index) => { const raw = dataset.data[index]; if (raw && raw.isLive) { const {x, y, height} = bar.getProps(['x', 'y', 'height'], true), walkCycle = (Date.now() / 600) % 3, drawFoot = (fx, fy, scale, isLeft) => { ctx.save(); ctx.translate(fx, fy); ctx.scale(scale, scale); if (isLeft) ctx.scale(-1, 1); ctx.globalAlpha = 0.9; ctx.fillStyle = deepColor; ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👣', 0, 0); ctx.restore(); }, stepSpace = 24; for (let i=0; i<3; i++) { const stepX = x - (2-i) * stepSpace, yPos = (i === 0) ? y + height/2 : (i === 1) ? y : y - height/2; if (Math.floor(walkCycle) === i) { drawFoot(stepX, yPos + Math.sin(Date.now()/150)*4, 1.3, i % 2 !== 0); } } } }); }); } };
        ganttChart = new Chart(ctx, { 
            type: 'bar', data: { datasets: ds.filter(d => d.data.length > 0) }, plugins: [footprintPlugin], 
            options: { 
                indexAxis: 'y', animation: { duration: 0 }, responsive: true, maintainAspectRatio: false, 
                scales: { 
                    x: { min: base, max: end, grid: { color: 'rgba(0, 0, 0, 0.03)', drawBorder: false }, ticks: { stepSize: 1, callback: v => (v % 24) + ':00' } }, 
                    y: { labels: yL, stacked: false, grid: { color: 'rgba(0, 0, 0, 0.03)', drawBorder: false } } 
                }, 
                plugins: { 
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }, 
                    tooltip: { callbacks: { label: c => `${c.dataset.label} ${c.raw.start}-${c.raw.isLive ? '現在' : c.raw.end}` } } 
                } 
            } 
        });

        // 🌟 【魔法】絆の光（Kizuna Resonance）を描画
        // if (window.drawKizunaResonance) {
        //     setTimeout(window.drawKizunaResonance, 50); // 描画の安定化のためにわずかに遅延
        // }
        } catch (e) { console.error("Gantt Chart Error: ", e); }

}

window.onload = () => {
    updateClock(); setInterval(updateClock, 1000);
    if (window.firebaseDB && typeof window.initApp === 'function') window.initApp();
    function chartPulseLoop() { if (ganttChart) { const hasLive = ganttChart.data.datasets.some(ds => ds.data.some(d => d.isLive)); if (hasLive) ganttChart.draw(); } requestAnimationFrame(chartPulseLoop); }
    chartPulseLoop();
    const backBtn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => { if (window.scrollY > 300) backBtn.classList.add('show'); else backBtn.classList.remove('show'); });
};
