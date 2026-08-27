// --- actions.js: ユーザー操作（タスク登録・モード切替・同期） ---

// 当日限定オートフィット
window.autoFitChart = function() {
    const day = getDayData(selectedDate), prev = getDayData(getPrevDate(selectedDate));
    const all = [...day.tasks, ...day.plans, ...prev.tasks.filter(t=>t.endISO > toISO(selectedDate, '00:00')), ...prev.plans.filter(p=>p.endISO > toISO(selectedDate, '00:00'))];
    if (!all.length) return window.setChartRange('00:00', '00:00');
    let min = 24, max = 0;
    all.forEach(item => {
        const isP = item.startISO < toISO(selectedDate, '00:00'), isN = item.endISO > toISO(selectedDate, '23:59');
        let s = isP ? 0 : timeToDec(item.start), e = isN ? 24 : timeToDec(item.end);
        if (!isN && timeToDec(item.end) < timeToDec(item.start) && item.endISO > item.startISO) e = 24;
        s = Math.max(0, Math.min(24, s)); e = Math.max(0, Math.min(24, e));
        if (s < min) min = s; if (e > max) max = e;
    });
    const f = (v) => (v >= 24 ? '00:00' : v.toString().padStart(2,'0')+':00');
    window.setChartRange(f(Math.max(0, Math.floor(min-0.5))), f(Math.min(24, Math.ceil(max+0.5))));
};

// 🌟 第3工程：【入力革命】大画面チップ選択UI 🌟

window.openStaffSelection = function() {
    const icon = document.getElementById('guide-icon-area'), 
          title = document.getElementById('guide-title'), 
          content = document.getElementById('guide-content');
    if(!icon || !title || !content) return;

    icon.innerHTML = `<i data-lucide="users" style="width:40px; height:40px; color:#6366f1;"></i>`;
    title.innerText = "スタッフを選択 👤";
    
    content.innerHTML = `<div class="chip-grid">` + 
        data.masterWorkers.map(w => {
            const nameOnly = w.replace(/ \[.*?\]$/, '');
            return `<button type="button" class="selection-chip" onclick="selectStaff('${w}')">
                <i data-lucide="user" style="width:20px;"></i>
                <span>${nameOnly}</span>
            </button>`;
        }).join('') + `</div>`;
    
    document.getElementById('large-guide-modal').style.display = 'flex';
    lucide.createIcons();
};

window.selectStaff = function(val) {
    const sel = document.getElementById('worker-select'),
          disp = document.getElementById('display-worker');
    if(sel) sel.value = val;
    if(disp) disp.innerText = val.replace(/ \[.*?\]$/, '');
    closeLargeGuide();
};

window.openTaskSelection = function(cat = 'work') {
    const icon = document.getElementById('guide-icon-area'), 
          title = document.getElementById('guide-title'), 
          content = document.getElementById('guide-content');
    if(!icon || !title || !content) return;

    icon.innerHTML = `<i data-lucide="file-edit" style="width:40px; height:40px; color:var(--primary);"></i>`;
    title.innerText = "内容を選択 📝";
    
    let tasks = (cat === 'work') ? [...data.masterTasks] : [...data.masterSpecials];
    
    // ⚔️ 指揮官ソート（チップ版）: お気に入り優先 > 結果入力必要優先 > その他
    tasks.sort((a, b) => {
        const aFav = (data.favorites || []).includes(a), bFav = (data.favorites || []).includes(b);
        const aRes = (data.resultRequiredTasks || []).includes(a), bRes = (data.resultRequiredTasks || []).includes(b);
        if (aFav !== bFav) return aFav ? -1 : 1;
        if (aRes !== bRes) return aRes ? -1 : 1;
        return a.localeCompare(b, 'ja');
    });
    
    content.innerHTML = `
        <div class="modal-tabs">
            <button type="button" class="modal-tab ${cat==='work'?'active':''}" onclick="openTaskSelection('work')">お仕事</button>
            <button type="button" class="modal-tab ${cat==='special'?'active':''}" onclick="openTaskSelection('special')">勤怠</button>
        </div>
        <div style="margin-bottom: 15px; position: sticky; top: 0; background: #fefce8; padding-top: 5px; z-index: 10;">
            <div style="position: relative; display: flex; align-items: center;">
                <i data-lucide="search" style="position: absolute; left: 12px; width: 18px; color: var(--text-muted);"></i>
                <input type="text" id="task-search-input" 
                    placeholder="${cat==='work'?'お仕事を探す、または新しく入力...':'勤怠を検索...'}" 
                    style="width: 100%; padding: 12px 12px 12px 40px; border-radius: 12px; border: 2px solid var(--primary); font-size: 16px; font-weight: bold; background: white;"
                    oninput="filterTaskChips('${cat}')">
            </div>
        </div>
        <div id="chip-grid-container" class="chip-grid">` + 
        generateTaskChips(tasks, cat) + `</div>`;
    
    document.getElementById('large-guide-modal').style.display = 'flex';
    lucide.createIcons();
    setTimeout(() => document.getElementById('task-search-input')?.focus(), 100);
};

// チップ生成の共通関数
function generateTaskChips(tasks, cat, filter = '') {
    const f = filter.trim().toLowerCase();
    let filtered = tasks;
    if (f) {
        filtered = tasks.filter(t => t.toLowerCase().includes(f));
    }

    let html = '';
    
    // 【新規追加ボタン】お仕事カテゴリかつ、入力内容が既存リストにない場合に表示
    if (cat === 'work' && f && !tasks.map(t => t.toLowerCase()).includes(f)) {
        html += `
            <button type="button" class="selection-chip miracle-new-entry" 
                style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%) !important; color: white !important; border: none !important; grid-column: 1 / -1;" 
                onclick="addNewTaskAndSelect('${filter}')">
                <div class="chip-indicator-container">
                    <div class="chip-indicator" style="background: white; color: var(--primary);"><i data-lucide="sparkles" style="width:12px; height:12px; fill:currentColor;"></i></div>
                </div>
                <span style="font-weight: 900;">✨ 『${filter}』を新しく登録</span>
            </button>`;
    }

    html += filtered.map(t => {
        const isFav = (data.favorites || []).includes(t);
        const isRes = (data.resultRequiredTasks || []).includes(t);
        const taskName = t.trim();
        const customColor = (data.excelColors && data.excelColors[taskName]) ? data.excelColors[taskName] : null;
        let chipStyle = "", textColor = "var(--text-main)", textShadow = "none";
        if (customColor) {
            chipStyle = `background: ${customColor} !important; border: 1px solid rgba(0,0,0,0.15) !important; box-shadow: 0 4px 0 rgba(0,0,0,0.2) !important;`;
            textColor = "#ffffff !important";
            textShadow = "0 1px 2px rgba(0,0,0,0.4) !important";
        } else { chipStyle = `background-color: white !important;`; }

        let badges = '<div class="chip-indicator-container">';
        if (isFav) badges += `<div class="chip-indicator indicator-fav"><i data-lucide="star" style="width:12px; height:12px; fill:currentColor;"></i></div>`;
        if (isRes) badges += `<div class="chip-indicator indicator-res"><i data-lucide="pencil-line" style="width:12px; height:12px;"></i></div>`;
        badges += '</div>';

        return `<button type="button" class="selection-chip" 
            style="${chipStyle} color: ${textColor}; text-shadow: ${textShadow};" 
            onclick="selectTask('${t}')">
            ${badges}
            <span>${t}</span>
        </button>`;
    }).join('');

    return html || `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">見つかりませんでした 🕊️</p>`;
}

window.filterTaskChips = function(cat) {
    const val = document.getElementById('task-search-input').value;
    const tasks = (cat === 'work') ? [...data.masterTasks] : [...data.masterSpecials];
    // ソート条件を維持
    tasks.sort((a, b) => {
        const aFav = (data.favorites || []).includes(a), bFav = (data.favorites || []).includes(b);
        const aRes = (data.resultRequiredTasks || []).includes(a), bRes = (data.resultRequiredTasks || []).includes(b);
        if (aFav !== bFav) return aFav ? -1 : 1;
        if (aRes !== bRes) return aRes ? -1 : 1;
        return a.localeCompare(b, 'ja');
    });
    const container = document.getElementById('chip-grid-container');
    if (container) {
        container.innerHTML = generateTaskChips(tasks, cat, val);
        lucide.createIcons();
    }
};

window.addNewTaskAndSelect = async function(val) {
    if (!val || !val.trim()) return;
    const newTask = val.trim();
    
    // マスターデータに追加
    if (!data.masterTasks.includes(newTask)) {
        data.masterTasks.push(newTask);
        
        if (!data.excelColors) data.excelColors = {};
        const p = window.palette || ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4', '#84cc16'];
        const color = p[data.masterTasks.indexOf(newTask) % p.length];
        data.excelColors[newTask] = color;

        // リポジトリ経由で保存（完了を待機）
        if (window.saveAndRefresh) await window.saveAndRefresh('master');
        showToast(`「${newTask}」を新しく登録し、色彩を授けました！🎨✨`, '✨');
    }
    
    // そのまま選択
    selectTask(newTask);
};

window.selectTask = function(val) {
    const inp = document.getElementById('task-input'),
          disp = document.getElementById('display-task');
    if(inp) {
        inp.value = val;
        if(window.setTask) window.setTask(val); 
    }
    if(disp) disp.innerText = val;
    closeLargeGuide();
};

// スタッフID同期
window.selectWorkerById = function() { 
    const id = document.getElementById('worker-id-input').value.trim();
    const f = id ? data.masterWorkers.find(w => w.includes(`[${id}]`)) : '';
    document.getElementById('worker-select').value = f || '';
};
window.syncIdFromSelect = function() { 
    const v = document.getElementById('worker-select').value, m = v.match(/\[(.*?)\]/);
    document.getElementById('worker-id-input').value = m ? m[1] : '';
};

window.toggleTimeSettings = function() {
    const area = document.getElementById('time-settings-area');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
};

window.resetTaskForm = function() {
    ['worker-select', 'worker-id-input', 'task-input', 'task-target', 'task-remark'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    
    // 🌟 追加：表示ラベルのリセット（初期状態に戻す）
    const dWorker = document.getElementById('display-worker'), 
          dTask = document.getElementById('display-task');
    if(dWorker) dWorker.innerText = "スタッフを選択 👤";
    if(dTask) dTask.innerText = "お仕事を選択 📝";

    document.getElementById('time-settings-area').style.display = (currentMode === 'actual' ? 'none' : 'block');
    const t = document.getElementById('task-target'), r = document.getElementById('task-remark');
    if (t) { t.style.backgroundColor = ''; t.style.borderColor = ''; t.placeholder = "相手先や件名を記入"; }
    if (r) { r.style.backgroundColor = ''; r.style.borderColor = ''; r.placeholder = "詳しい内容を記入"; }
    ['special-helpers', 'meeting-helpers'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    renderUI();
};

window.deletePattern = function(id) {
    if (confirm("このパターンを削除してもよろしいですか？")) {
        data.workPatterns = (data.workPatterns || []).filter(p => p.id !== id);
        saveAndRefresh();
        showToast("パターンを削除しました。", "info");
    }
};

window.openPatternModal = function(id = null) {
    const modal = document.getElementById('pattern-modal');
    if (!modal) return;
    editingPatternId = id;
    const title = document.getElementById('pattern-modal-title');
    const nameInp = document.getElementById('pattern-name');
    const listArea = document.getElementById('pattern-steps-list');
    
    if (id) {
        const p = data.workPatterns.find(x => x.id === id);
        title.innerText = "パターンを編集 🧩";
        nameInp.value = p.name;
        renderPatternSteps(p.plans);
    } else {
        title.innerText = "新しいパターンを作成 🧩";
        nameInp.value = "";
        renderPatternSteps([]);
    }
    modal.style.display = 'flex';
};

function renderPatternSteps(steps) {
    const listArea = document.getElementById('pattern-steps-list');
    listArea.innerHTML = steps.map((s, i) => `
        <div class="master-item" style="gap: 5px;">
            <input type="text" value="${s.name}" onchange="updateStep(${i}, 'name', this.value)" style="flex:2; min-width:80px;">
            <input type="time" value="${s.start}" onchange="updateStep(${i}, 'start', this.value)" style="flex:1;">
            <input type="time" value="${s.end}" onchange="updateStep(${i}, 'end', this.value)" style="flex:1;">
            <button onclick="removeStep(${i})" class="btn-small" style="color:red;">×</button>
        </div>
    `).join('') + `<button onclick="addStep()" class="btn-small btn-outline" style="width:100%; margin-top:10px;">+ 工程を追加</button>`;
}

window.smartAddTask = async function(worker, name, start, end, target = '', remark = '') {
    const day = getDayData(selectedDate), sISO = toISO(selectedDate, start);
    
    // 🌟 時空の魔法：終了時刻が開始時刻より「厳密に前」の場合のみ「翌日」と判定
    // (同じ時刻の場合は当日の 0.0h として扱う)
    let eD = selectedDate;
    const sDec = timeToDec(start), eDec = timeToDec(end);
    if (eDec < sDec) {
        eD = getNextDate(selectedDate);
    }
    
    const eISO = toISO(eD, end), newItem = { worker, name, start, end, startISO: sISO, endISO: eISO, duration: getDiffHrs(sISO, eISO), target, remark };
    const newS = new Date(sISO), newE = new Date(eISO);

    // 予定(plans)か実績(tasks)か、ターゲットを決定
    const targetKey = currentMode === 'actual' ? 'tasks' : 'plans';
    const existing = [...day[targetKey]]; 
    const newList = []; 
    let added = false;

    existing.forEach(tk => {
        if (tk.worker !== worker) { newList.push(tk); return; }
        const tkS = new Date(tk.startISO), tkE = new Date(tk.endISO);
        
        // 1. 新しいタスクに完全に覆われる場合 -> 古い方を消去
        if (tkS >= newS && tkE <= newE && tkS < tkE) return;

        // 2. 新しいタスクが古いタスクの中に完全に含まれる場合 -> 古い方を前後で分割
        if (newS > tkS && newE < tkE) {
            newList.push({ ...tk, end: start, endISO: sISO, duration: getDiffHrs(tk.startISO, sISO) });
            newList.push(newItem); 
            added = true;
            newList.push({ ...tk, start: end, startISO: eISO, duration: getDiffHrs(eISO, tk.endISO) });
            return;
        }

        // 3. 新しいタスクの開始が古いタスクの中に含まれる場合 -> 古い方の終了を切り詰め
        if (newS > tkS && newS < tkE) {
            newList.push({ ...tk, end: start, endISO: sISO, duration: getDiffHrs(tk.startISO, sISO) });
            return;
        }

        // 4. 新しいタスクの終了が古いタスクの中に含まれる場合 -> 古い方の開始を切り詰め
        if (newE > tkS && newE < tkE) {
            newList.push({ ...tk, start: end, startISO: eISO, duration: getDiffHrs(eISO, tk.endISO) });
            return;
        }

        newList.push(tk);
    });

    if (!added) {
        // 直前のタスクが未終了、または新しいタスクと重なる場合に切り詰め
        const last = [...newList].reverse().find(tk => tk.worker === worker && new Date(tk.startISO) <= newS);
        if (last) {
            const lastE = new Date(last.endISO);
            if (lastE <= new Date(last.startISO) || lastE > newS) {
                last.end = start;
                last.endISO = sISO;
                last.duration = getDiffHrs(last.startISO, sISO);
            }
        }
        newList.push(newItem);
    }

    newList.sort((a, b) => a.startISO.localeCompare(b.startISO));
    day[targetKey] = newList;

    // 🌟 【進化】Firestoreへの一括保存（原子レベルの同期版）
    if (window.kizunaRepo) {
        try {
            await window.kizunaRepo.runBatch(async (batch, sdk) => {
                const { doc } = sdk;
                
                // 1. そのワーカーのその日の既存ドキュメントを削除キューに追加
                const existingItems = existing.filter(tk => tk.worker === worker);
                for (const oldTk of existingItems) {
                    if (oldTk.id) {
                        const oldRef = doc(window.firebaseDB, "daily_logs", selectedDate, targetKey, oldTk.id);
                        batch.delete(oldRef);
                    }
                }

                // 2. 変更後の新しいタスク群を新規保存キューに追加
                for (const tk of newList) {
                    if (tk.worker === worker) {
                        const id = tk.id || `${tk.worker}_${tk.start}`.replace(/[.#$/[\] :]/g, '_');
                        const newRef = doc(window.firebaseDB, "daily_logs", selectedDate, targetKey, id);
                        batch.set(newRef, { ...tk, id });
                    }
                }
            });

            if (window.saveAndRefresh) await window.saveAndRefresh('master'); 
        } catch (e) {
            console.error("Task Sync Error:", e);
            showToast("クラウド同期に失敗しました。", "error");
        }
    } else {
        if (window.saveAndRefresh) await window.saveAndRefresh();
    }
};

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const w = document.getElementById('worker-select').value, t = document.getElementById('task-input').value.trim(), target = document.getElementById('task-target').value, rem = document.getElementById('task-remark').value, s = document.getElementById('start-time').value || '08:00', hE = document.getElementById('end-time').value;
    if(!w || !t) return showToast("担当者と内容を選択してください。", 'warning');
    let newBadge = "";
    if (currentCategory === 'work' && t !== '休憩' && t !== '移動' && !data.masterTasks.includes(t)) { 
        data.masterTasks.push(t); 
        newBadge = `新しい業務「${t}」を登録しました。 `; 
        if (window.saveAndRefresh) await window.saveAndRefresh('master');
    }
    let actualEnd = hE || s; if (currentMode === 'plan' && !hE) actualEnd = '17:00';
    
    // 🌟 完了を待機
    await smartAddTask(w, t, s, actualEnd, target, rem);
    
    const nameOnly = w.replace(/ \[.*?\]$/, '');
    if(currentMode === 'actual') { celebrate(); showToast(`${newBadge}${nameOnly}さんの業務記録を開始しました。`, 'success'); }
    else { showToast(`${newBadge}${nameOnly}さんの予定を登録しました。`, 'info'); }
    resetTaskForm();
});

window.finishWork = async function() {
    const w = document.getElementById('worker-select').value, e = document.getElementById('start-time').value || '17:00';
    if(!w) return showToast("対象となる担当者を選択してください。", 'warning');
    const d = getDayData(selectedDate), last = [...d.tasks].reverse().find(t=>t.worker===w);
    if(last){ 
        last.end = e; let leD = selectedDate; if (timeToDec(e) < timeToDec(last.start)) leD = getNextDate(selectedDate);
        last.endISO = toISO(leD, e); last.duration = getDiffHrs(last.startISO, last.endISO);
        
        // 🌟 個別保存
        if (window.kizunaRepo) {
            await window.kizunaRepo.upsertTask(selectedDate, 'tasks', last);
        }
        
        if (window.saveAndRefresh) await window.saveAndRefresh('master'); 
        resetTaskForm(); celebrate();
        
        // 🌟 【魔法】キセキの粒子を発動！
        if (window.MiracleMagic) {
            window.MiracleMagic.burst(window.innerWidth / 2, window.innerHeight / 2, 'gold', 50);
        }

        showToast(w.replace(/ \[.*?\]$/, '') + "さんの業務記録を完了しました。お疲れ様でした。", 'success');
    }
};

window.startTravel = async function() {
    const w = document.getElementById('worker-select').value, s = document.getElementById('start-time').value, e = document.getElementById('end-time').value || s;
    if(!w) return showToast("出発する担当者を選択してください。", 'warning');
    await smartAddTask(w, '移動', s, e); 
    showToast(w.replace(/ \[.*?\]$/, '') + "さんの移動を開始しました。", 'info'); 
    resetTaskForm();
};

window.startBreak = async function() {
    const w = document.getElementById('worker-select').value, s = document.getElementById('start-time').value, e = document.getElementById('end-time').value || s;
    if(!w) return showToast("休憩する担当者を選択してください。", 'warning');
    await smartAddTask(w, '休憩', s, e); 
    showToast(w.replace(/ \[.*?\]$/, '') + "さんの休憩を記録しました。", 'info'); 
    resetTaskForm();
};

window.deleteItem = async function(t, i) {
    if(confirm("この記録を削除してもよろしいですか？")){
        const d = getDayData(selectedDate); 
        const targetKey = t.includes('予') ? 'plans' : 'tasks';
        const item = d[targetKey][i];
        
        // 🌟 クラウドから削除
        if (window.kizunaRepo && item && item.id) {
            await window.kizunaRepo.deleteTask(selectedDate, targetKey, item.id);
        }
        
        d[targetKey].splice(i,1);
        if (window.saveAndRefresh) await window.saveAndRefresh('master'); 
        showToast("記録を削除しました。", 'info');
    }
};

window.setMode = function(m) { 
    currentMode = m; 
    
    // モード切替ボタンの強調
    const btnAct = document.getElementById('btn-mode-actual'), btnPln = document.getElementById('btn-mode-plan');
    if(btnAct) btnAct.className = m==='actual'?'active':''; 
    if(btnPln) btnPln.className = m==='plan'?'active':''; 

    const inputCard = document.getElementById('input-card'), historySection = document.getElementById('history-section');
    
    if (m === 'history') {
        // 履歴（足跡）モード：入力を隠して履歴を表示
        if(inputCard) inputCard.style.display = 'none';
        if(historySection) historySection.style.display = 'block';
    } else {
        // 入力（実績/予定）モード：入力を表示して履歴を隠す
        if(inputCard) {
            inputCard.style.display = 'block';
            inputCard.classList.remove('aura-actual', 'aura-plan');
            if (m === 'actual') {
                inputCard.classList.add('aura-actual');
                inputCard.style.background = 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)';
            } else {
                inputCard.classList.add('aura-plan');
                inputCard.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)';
            }
        }
        if(historySection) historySection.style.display = 'none';

        const actActions = document.getElementById('actual-actions'), plnActions = document.getElementById('plan-actions');
        if(actActions) actActions.style.display = m==='actual'?'flex':'none'; 
        if(plnActions) plnActions.style.display = m==='plan'?'block':'none'; 

        const timeArea = document.getElementById('time-settings-area'), toggleBtn = document.getElementById('toggle-time-btn');
        if (m === 'plan') { if(timeArea) timeArea.style.display = 'block'; if(toggleBtn) toggleBtn.style.display = 'none'; }
        else { if(timeArea) timeArea.style.display = 'none'; if(toggleBtn) toggleBtn.style.display = 'block'; }
        
        const planEndGroup = document.getElementById('plan-end-group');
        if(planEndGroup) planEndGroup.style.display = 'block'; 
        if (m === 'actual') { const st = document.getElementById('start-time'), et = document.getElementById('end-time'); if(st && et) et.value = st.value; }
        const timeLabel = document.getElementById('time-label');
        if(timeLabel) timeLabel.textContent = m==='actual'?'時刻設定 (開始・終了)':'開始・終了予定'; 
    }
    
    resetTaskForm();
    renderUI(); 
};

window.setCategory = function(c) { currentCategory = c; document.getElementById('btn-cat-work').className = c==='work'?'active':''; document.getElementById('btn-cat-special').className = c==='special'?'active':''; document.getElementById('task-input').value = ''; renderUI(); checkSpecialTask(); };

window.checkSpecialTask = function() { 
    const target = document.getElementById('task-target'), rem = document.getElementById('task-remark');
    if (target && rem) {
        [target, rem].forEach(el => { el.style.backgroundColor = ''; el.style.borderColor = ''; });
        target.placeholder = "相手先や件名を記入"; 
        rem.placeholder = "詳しい内容を記入";
    }
};

// 日付変更時の処理はcore.js側へ統合されました（Ver.2.0.0）

window.toggleMainSection = function(id) {
    const target = document.getElementById(id), isH = target.style.display === 'none';
    target.style.display = isH ? 'block' : 'none'; if (isH) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    lucide.createIcons();
};

window.setChartRange = function(s, e) { data.config.start = s; data.config.end = e === '24:00' ? '00:00' : e; saveAndRefresh(); };
window.saveConfig = function() { data.config.start = document.getElementById('config-start').value; data.config.end = document.getElementById('config-end').value; data.config.breakThreshold = parseFloat(document.getElementById('config-break-threshold').value) || 6; data.config.breakDuration = parseInt(document.getElementById('config-break-duration').value) || 60; saveAndRefresh(); };

// --- キセキの絆：ロジック群 ---
let editingAnnId = null;
let editingQuestId = null;

// モーダル内リストの描画
window.renderModalLists = function() {
    const mAnn = document.getElementById('modal-ann-list');
    const mQue = document.getElementById('modal-quest-list');
    const mLnk = document.getElementById('modal-link-list');

    if (mAnn) {
        mAnn.innerHTML = '<div style="font-size:12px; font-weight:bold; color:#b45309; margin-bottom:10px;">現在の告知一覧</div>' + 
            (data.announcements.length ? data.announcements.map(a => `
                <div class="master-item" style="background:#fffbeb; margin-bottom:6px; border:1px solid #fde68a; ${editingAnnId == a.id ? 'outline: 2px solid #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);' : ''}">
                    <div style="flex:1; font-size:11px; line-height:1.4;">${a.content}</div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="event.stopPropagation(); editAnnouncement('${a.id}')" style="background:none; border:none; color:#f59e0b; cursor:pointer; padding:4px;"><i data-lucide="edit-2" style="width:14px; pointer-events:none;"></i></button>
                        <button type="button" onclick="event.stopPropagation(); if(confirm('この告知を終了しますか？')) { data.announcements = data.announcements.filter(ann => ann.id != '${a.id}'); if(editingAnnId == '${a.id}') editingAnnId=null; saveAndRefresh(); renderModalLists(); }" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; padding:4px; font-size:16px;">×</button>
                    </div>
                </div>
            `).join('') : '<div style="font-size:10px; color:#94a3b8; text-align:center;">告知はありません</div>');
    }

    if (mQue) {
        mQue.innerHTML = '<div style="font-size:12px; font-weight:bold; color:#4338ca; margin-bottom:10px;">現在の依頼一覧</div>' + 
            (data.quests.length ? data.quests.map(q => `
                <div class="master-item" style="background:#f5f3ff; margin-bottom:6px; border:1px solid #ddd6fe; ${editingQuestId == q.id ? 'outline: 2px solid #6366f1; box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);' : ''}">
                    <div style="flex:1; font-size:11px;"><b>${q.title}</b> <small>(${q.worker.replace(/ \[.*?\]$/, '')})</small></div>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="event.stopPropagation(); editQuest('${q.id}')" style="background:none; border:none; color:#6366f1; cursor:pointer; padding:4px;"><i data-lucide="edit-2" style="width:14px; pointer-events:none;"></i></button>
                        <button type="button" onclick="event.stopPropagation(); if(confirm('この依頼を削除しますか？')) { data.quests = data.quests.filter(qu => qu.id != '${q.id}'); if(editingQuestId == '${q.id}') editingQuestId=null; saveAndRefresh(); renderModalLists(); }" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; padding:4px; font-size:16px;">×</button>
                    </div>
                </div>
            `).join('') : '<div style="font-size:10px; color:#94a3b8; text-align:center;">依頼はありません</div>');
    }




    if (mLnk) {
        mLnk.innerHTML = '<div style="font-size:12px; font-weight:bold; color:#047857; margin-bottom:10px;">現在の連携一覧</div>' + 
            (data.links.length ? data.links.map((l, idx) => `
                <div class="master-item" style="background:#f0fdf4; margin-bottom:6px; border:1px solid #bbf7d0;">
                    <div style="flex:1; font-size:11px;">${l.title}</div>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="btn-icon-only" onclick="moveLink('${l.id}', -1)" ${idx===0?'disabled style="opacity:0.2"':''} style="background:none; border:none; color:#047857; cursor:pointer; padding:2px;"><i data-lucide="chevron-up" style="width:14px;"></i></button>
                        <button class="btn-icon-only" onclick="moveLink('${l.id}', 1)" ${idx===data.links.length-1?'disabled style="opacity:0.2"':''} style="background:none; border:none; color:#047857; cursor:pointer; padding:2px;"><i data-lucide="chevron-down" style="width:14px;"></i></button>
                        <span onclick="if(confirm('このリンクを削除しますか？')) { data.links = data.links.filter(li => li.id !== '${l.id}'); saveAndRefresh(); renderModalLists(); }" style="color:#ef4444; cursor:pointer; font-weight:bold; padding:0 5px; margin-left:5px;">×</span>
                    </div>
                </div>
            `).join('') : '<div style="font-size:10px; color:#94a3b8; text-align:center;">連携はありません</div>');
    }
    lucide.createIcons();
};

// リンクの並び替え魔法
window.moveLink = function(id, dir) {
    const idx = data.links.findIndex(l => l.id === id);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= data.links.length) return;
    const temp = data.links[idx]; data.links[idx] = data.links[newIdx]; data.links[newIdx] = temp;
    saveAndRefresh(); renderModalLists();
};

window.editAnnouncement = function(id) {
    const ann = data.announcements.find(a => a.id == id); if (!ann) return;
    editingAnnId = id;
    const contentEl = document.getElementById('ann-content'), expiryEl = document.getElementById('ann-expiry'), linkEl = document.getElementById('ann-link');
    if (contentEl) { contentEl.value = ann.content; contentEl.focus(); }
    if (expiryEl) expiryEl.value = ann.expiresAt || '';
    if (linkEl) linkEl.value = ann.link || '';
    const btn = document.querySelector('#announcement-modal button[onclick*="saveAnnouncement"]');
    if (btn) btn.innerHTML = 'キセキのお知らせを更新';
    const modal = document.querySelector('#announcement-modal .modal-content');
    if (modal) modal.scrollTop = 0;
    renderModalLists();
};

window.editQuest = function(id) {
    const q = data.quests.find(qu => qu.id == id); if (!q) return;
    editingQuestId = id;
    const titleEl = document.getElementById('quest-title'), contentEl = document.getElementById('quest-content'), workerEl = document.getElementById('quest-worker-select'), linkEl = document.getElementById('quest-link'), expiryEl = document.getElementById('quest-expiry'), impEl = document.getElementById('quest-important');
    if (titleEl) { titleEl.value = q.title; titleEl.focus(); }
    if (contentEl) contentEl.value = q.content;
    if (workerEl) workerEl.value = q.worker;
    if (linkEl) linkEl.value = q.link || '';
    if (expiryEl) expiryEl.value = q.expiry || '';
    if (impEl) impEl.checked = !!q.important;
    const btn = document.querySelector('#quest-modal button[onclick*="saveQuest"]');
    if (btn) btn.innerHTML = '依頼を更新する';
    const modal = document.querySelector('#quest-modal .modal-content');
    if (modal) modal.scrollTop = 0;
    renderModalLists();
};




window.openAnnouncementModal = () => { editingAnnId = null; document.getElementById('ann-content').value = ''; document.getElementById('ann-expiry').value = ''; document.getElementById('ann-link').value = ''; const btn = document.querySelector('#announcement-modal button[onclick="saveAnnouncement()"]'); if (btn) btn.innerHTML = '告知を送信する'; renderModalLists(); document.getElementById('announcement-modal').style.display = 'flex'; };
window.closeAnnouncementModal = () => { document.getElementById('announcement-modal').style.display = 'none'; };
window.openQuestModal = () => { const sel = document.getElementById('quest-worker-select'); sel.innerHTML = '<option value="全体">👥 全員へ</option>' + data.masterWorkers.map(w => `<option value="${w}">${w.replace(/ \[.*?\]$/, '')}</option>`).join(''); editingQuestId = null; ['quest-title', 'quest-content', 'quest-file', 'quest-link', 'quest-expiry'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const imp = document.getElementById('quest-important'); if (imp) imp.checked = false; const btn = document.querySelector('#quest-modal button[onclick="saveQuest()"]'); if (btn) btn.innerHTML = '依頼を発令する'; renderModalLists(); document.getElementById('quest-modal').style.display = 'flex'; };
window.closeQuestModal = () => { document.getElementById('quest-modal').style.display = 'none'; };
window.openLinkModal = () => { renderModalLists(); document.getElementById('link-modal').style.display = 'flex'; };
window.closeLinkModal = () => { document.getElementById('link-modal').style.display = 'none'; };

window.saveAnnouncement = function() {
    const content = document.getElementById('ann-content').value.trim(), expiry = document.getElementById('ann-expiry').value, link = document.getElementById('ann-link').value.trim(), fileInput = document.getElementById('ann-file');
    if (!content) return showToast("告知内容を入力してください。", 'warning');
    let fileInfo = null; if (fileInput.files && fileInput.files.length > 0) { const f = fileInput.files[0]; fileInfo = { name: f.name, size: (f.size / 1024).toFixed(1) + 'KB' }; }
    if (editingAnnId) { const ann = data.announcements.find(a => a.id === editingAnnId); if (ann) { ann.content = content; ann.expiresAt = expiry; ann.link = link; if (fileInfo) ann.file = fileInfo; } showToast("キセキのお知らせを更新しました。", 'success'); }
    else { data.announcements.push({ id: Date.now(), content, expiresAt: expiry, link, file: fileInfo, readBy: [], createdAt: new Date().toISOString() }); showToast("キセキのお知らせを送信しました。", 'success'); }
    editingAnnId = null; saveAndRefresh(); ['ann-content', 'ann-expiry', 'ann-link', 'ann-file'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); renderModalLists();
};

window.saveQuest = function() {
    const title = document.getElementById('quest-title').value.trim(), content = document.getElementById('quest-content').value.trim(), worker = document.getElementById('quest-worker-select').value, link = document.getElementById('quest-link').value.trim(), expiry = document.getElementById('quest-expiry').value, important = document.getElementById('quest-important').checked, fileInput = document.getElementById('quest-file');
    if (!title) return showToast("タイトルを入力してください。", 'warning');
    if (editingQuestId) { const q = data.quests.find(qu => qu.id === editingQuestId); if (q) { q.title = title; q.content = content; q.worker = worker; q.link = link; q.expiry = expiry; q.important = important; if (fileInput.files.length > 0) { const files = []; for (let f of fileInput.files) files.push({ name: f.name, size: (f.size / 1024).toFixed(1) + 'KB' }); q.files = files; } } showToast("キセキの依頼を更新しました。", 'success'); }
    else { const files = []; if (fileInput.files.length > 0) { for (let f of fileInput.files) files.push({ name: f.name, size: (f.size / 1024).toFixed(1) + 'KB' }); } data.quests.push({ id: Date.now(), title, content, worker, files, link, expiry, important, status: 'open', createdAt: new Date().toISOString() }); showToast("キセキの依頼を発令しました。", 'success'); }
    editingQuestId = null; saveAndRefresh(); ['quest-title', 'quest-content', 'quest-file', 'quest-link', 'quest-expiry'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); document.getElementById('quest-important').checked = false; renderModalLists();
};

window.markAsRead = function(id, workerName) { const ann = data.announcements.find(a => a.id === id); if (ann && !ann.readBy.includes(workerName)) { ann.readBy.push(workerName); if (ann.readBy.length >= data.masterWorkers.length && !ann.expiresAt) { data.announcements = data.announcements.filter(a => a.id !== id); window.activeAnnId = null; celebrate(); showToast("全員が確認したため、告知を終了しました。", 'success'); } else { showToast(`${workerName.replace(/ \[.*?\]$/, '')}さんの確認を記録しました。`, 'success'); } saveAndRefresh(); } };
window.deleteQuest = (id) => { if(confirm("この依頼は完了しましたか？")) { data.quests = data.quests.filter(q => q.id !== id); saveAndRefresh(); showToast("依頼を完了しました。", 'success'); } };

let selectedLinkIcon = 'external-link';
window.selectLinkIcon = (icon) => { selectedLinkIcon = icon; document.querySelectorAll('.icon-sel-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.icon === icon)); };
window.saveLink = function() { const title = document.getElementById('link-title').value.trim(), url = document.getElementById('link-url').value.trim(), fileInput = document.getElementById('link-file'); if (!title) return showToast("タイトルを入力してください。", 'warning'); let fileInfo = null; if (fileInput.files && fileInput.files.length > 0) { const f = fileInput.files[0]; fileInfo = { name: f.name, size: (f.size / 1024).toFixed(1) + 'KB' }; } data.links.push({ id: Date.now().toString(), title, url, icon: selectedLinkIcon, file: fileInfo, createdAt: new Date().toISOString() }); saveAndRefresh(); ['link-title', 'link-url', 'link-file'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); selectLinkIcon('external-link'); renderModalLists(); showToast("キセキの連携を構築しました。", 'success'); };
window.deleteLink = (id) => { if(confirm("このリンクを削除してもよろしいですか？")) { data.links = data.links.filter(l => l.id !== id); saveAndRefresh(); } };

let currentKizunaTab = 'quest';
window.setKizunaTab = (tab) => { currentKizunaTab = tab; document.querySelectorAll('.kizuna-tab').forEach(el => el.classList.remove('active')); document.getElementById(`tab-${tab}`).classList.add('active'); const section = document.getElementById('kizuna-section'); if (section) { section.classList.remove('kizuna-theme-quest', 'kizuna-theme-ann', 'kizuna-theme-link'); section.classList.add(`kizuna-theme-${tab}`); } renderUI(); };
window.toggleKizunaFullscreen = () => { const sec = document.getElementById('kizuna-section'); let overlay = document.querySelector('.kizuna-overlay'); if (!overlay) { overlay = document.createElement('div'); overlay.className = 'kizuna-overlay'; overlay.onclick = toggleKizunaFullscreen; document.body.appendChild(overlay); } const isFull = sec.classList.toggle('fullscreen-kizuna'); overlay.style.display = isFull ? 'block' : 'none'; lucide.createIcons(); };

window.renderKizuna = function() {
    const annArea = document.getElementById('announcements-area'), qArea = document.getElementById('quests-area'), lArea = document.getElementById('links-area'), notice = document.getElementById('kizuna-notice'), currentWorker = document.getElementById('worker-select').value, today = new Date(); today.setHours(0,0,0,0);
    const annCount = data.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) >= today).length, questCount = data.quests.length, linkCount = data.links.length;
    document.getElementById('count-ann').textContent = annCount; document.getElementById('count-quest').textContent = questCount; document.getElementById('count-link').textContent = linkCount;
    const isToday = (dateStr) => { if (!dateStr) return false; const d = new Date(dateStr); return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate(); };
    document.getElementById('new-star-ann').style.display = data.announcements.some(a => isToday(a.createdAt)) ? 'block' : 'none';
    document.getElementById('new-star-quest').style.display = data.quests.some(q => isToday(q.createdAt)) ? 'block' : 'none';
    document.getElementById('new-star-link').style.display = data.links.some(l => isToday(l.createdAt)) ? 'block' : 'none';
    [annArea, qArea, lArea].forEach(el => el.style.display = 'none');
    
    if (currentKizunaTab === 'ann') {
        annArea.style.display = 'grid';
        // 📢 周知優先ソート！
        const allAnn = data.announcements.filter(a => !a.expiresAt || new Date(a.expiresAt) >= today);
        const sortedAnn = allAnn.sort((a, b) => {
            const aDone = data.masterWorkers.every(w => a.readBy.includes(w));
            const bDone = data.masterWorkers.every(w => b.readBy.includes(w));
            // 1. 全員が読んでいないものを優先
            if (aDone !== bDone) return aDone ? 1 : -1;
            // 2. 同じステータスなら新着順（IDはタイムスタンプなので降順）
            return b.id - a.id;
        });
        
        annArea.innerHTML = sortedAnn.map(a => {
            const unread = data.masterWorkers.filter(w => !a.readBy.includes(w)), isShowList = window.activeAnnId === a.id, isNew = isToday(a.createdAt), isDone = unread.length === 0;
            let expiryBadge = ""; if (a.expiresAt) { const diff = Math.ceil((new Date(a.expiresAt) - today) / (1000 * 60 * 60 * 24)); const color = diff <= 0 ? "#ef4444" : diff <= 3 ? "#f59e0b" : "#10b981"; expiryBadge = `<span style="background:${color}; color:white; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:900;">${diff===0?"本日締切":diff<0?"期限終了":`残り ${diff} 日`}</span>`; }
            return `<div class="announcement-card ${isNew?'new-arrival-card':''}" style="border-top: 4px solid #f59e0b;">${a.expiresAt?'<div class="ann-badge">期限付き</div>':''}<div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><div style="font-weight: 800; color: #b45309;">キセキのお知らせ ${isNew?'<span class="floating-star-inline"><svg class="new-star-icon-inline" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>':''}</div>${expiryBadge}</div><div style="font-size:10px; color:#94a3b8;">${new Date(a.id).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div><div style="font-size: 14px; margin: 10px 0; color:#475569;">${a.content}</div><div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">${a.link?`<a href="${a.link}" target="_blank" class="btn-small" style="background:#fff7ed; color:#b45309; border:1px solid #fde68a;"><i data-lucide="external-link" style="width:12px;"></i> リンク</a>`:''}${a.file?`<div class="btn-small" style="background:#fef3c7; color:#d97706;"><i data-lucide="file-text" style="width:12px;"></i> ${a.file.name}</div>`:''}</div><div style="background:#fffbeb; border-radius:10px; padding:10px; border:1px solid #fef3c7;"><div style="display:flex; justify-content:space-between; align-items:center;"><button onclick="window.activeAnnId = (window.activeAnnId === ${a.id} ? null : ${a.id}); renderUI();" class="btn-small" style="background:#f59e0b; width:auto;">確認 (${unread.length})</button><div style="font-size:10px; color:#d97706; font-weight:bold;">未受領 ${unread.length}名</div></div>${isShowList?`<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:5px;">${unread.map(w=>`<button onclick="markAsRead(${a.id},'${w}')" class="btn-small" style="background:white; color:#475569; border:1px solid #fde68a;">${w.replace(/ \[.*?\]$/, '')}</button>`).join('')}</div>`:''}</div></div>`;
        }).join('') || 'お知らせはありません';
    }
    
    if (currentKizunaTab === 'quest') {
        qArea.style.display = 'grid';
        // ⚔️ 指揮官ソート発動！
        const sorted = [...data.quests].sort((a, b) => {
            // 第一位：最優先任務（⚡️）
            if (!!a.important !== !!b.important) return b.important ? 1 : -1;
            
            // 第二位：期限付き任務を期限が近い順に
            if (a.expiry && b.expiry) return new Date(a.expiry) - new Date(b.expiry);
            if (a.expiry && !b.expiry) return -1;
            if (!a.expiry && b.expiry) return 1;
            
            // 第三位：平時の任務（新着順）
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        qArea.innerHTML = sorted.map(q => {
            const isPersonal = q.worker !== '全体', isImportant = !!q.important, workerName = isPersonal ? q.worker.replace(/ \[.*?\]$/, '') : '全員', isNew = isToday(q.createdAt);
            let deadlineHtml = ""; if (q.expiry) { const diff = Math.ceil((new Date(q.expiry) - today) / (1000 * 60 * 60 * 24)); const color = diff <= 0 ? "#ef4444" : diff <= 3 ? "#f59e0b" : "#10b981"; deadlineHtml = `<div style="position:absolute; top:10px; right:10px; background:${color}; color:white; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:900;">${diff===0?"本日締切":diff<0?"期限終了":`残り ${diff} 日`}</div>`; }
            const borderCol = isImportant ? '#f59e0b' : (isPersonal ? '#ec4899' : '#6366f1');
            const auraStyle = isImportant ? `background: linear-gradient(135deg, #fff 0%, #fffbeb 100%); border: 1px solid #fde68a; border-top: 4px solid ${borderCol}; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);` : `background: white; border: 1px solid #e2e8f0; border-top: 4px solid ${borderCol}; box-shadow: 0 2px 8px rgba(0,0,0,0.05);`;
            return `<div class="quest-card ${isPersonal?'personal':''} ${isNew?'new-arrival-card':''}" style="position:relative; padding-top:30px; border-radius:12px; transition:all 0.3s ease; ${auraStyle}"><div class="quest-badge" style="background:${borderCol};"><i data-lucide="${isImportant?'zap':(isPersonal?'user':'users')}" style="width:10px; height:10px; margin-right:2px;"></i>${isImportant?'最重要依頼':`${workerName}さん宛`}</div>${deadlineHtml}<div style="font-weight:900; margin-bottom:8px; color:${isImportant?'#b45309':(isPersonal?'#be185d':'#4338ca')}; font-size:15px; display:flex; align-items:center; gap:6px;">${q.title}${isNew?'<span class="floating-star-inline"><svg class="new-star-icon-inline" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>':''}</div><div style="font-size:13px; color:#475569; margin-bottom:12px; white-space:pre-wrap;">${q.content}</div><div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">${isPersonal && isImportant?`<div style="font-size:11px; font-weight:bold; color:#ec4899; background:#fdf2f8; padding:2px 8px; border-radius:4px; border:1px solid #fbcfe8;">担当: ${workerName}</div>`:''}${q.link?`<a href="${q.link}" target="_blank" class="btn-small" style="background:#f1f5f9; color:#4338ca; border:1px solid #ddd6fe;"><i data-lucide="external-link" style="width:12px;"></i> リンク</a>`:''}${q.files?q.files.map(f=>`<div class="btn-small" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;"><i data-lucide="file-text" style="width:12px;"></i> ${f.name}</div>`).join(''):''}</div><button onclick="deleteQuest(${q.id})" class="btn-small btn-outline" style="width:100%; border-style:dashed; border-color:${isImportant?'#fde68a':(isPersonal?'#fbcfe8':'#c7d2fe')}; color:${isImportant?'#b45309':(isPersonal?'#be185d':'#4338ca')}; background:white; font-weight:bold;">完了確認</button></div>`;
        }).join('') || '依頼はありません';
    }
    
    if (currentKizunaTab === 'link') { lArea.style.display = 'grid'; lArea.innerHTML = data.links.map(l => `<a href="${l.url||'#'}" target="_blank" class="link-app-item"><div class="link-app-icon icon-${l.file?'file':'url'}"><i data-lucide="${l.icon||'external-link'}"></i></div><div class="link-app-label">${l.title}</div></a>`).join('') || 'リンクはありません'; }
    const hasUnread = data.announcements.some(a => !a.readBy.includes(currentWorker)); if (notice) notice.style.display = (hasUnread && currentWorker) ? 'flex' : 'none'; lucide.createIcons();
};


document.addEventListener('DOMContentLoaded', () => {
    const setupDrop = (id, inpId, prevId) => { const d = document.getElementById(id), i = document.getElementById(inpId), p = document.getElementById(prevId); if(!d) return; d.onclick = () => i.click(); i.onchange = () => { p.innerHTML = Array.from(i.files).map(f => `<div class="selected-file-tag">${f.name}</div>`).join(''); }; };
    setupDrop('ann-drop-zone', 'ann-file', 'selected-ann-files-preview'); setupDrop('quest-drop-zone', 'quest-file', 'selected-files-preview'); setupDrop('link-drop-zone', 'link-file', 'selected-link-files-preview');
});

window.togglePatternQuickList = () => { const l = document.getElementById('pattern-quick-list'); if(!l) return; const is = l.style.display === 'block'; l.style.display = is ? 'none' : 'block'; if(!is) { const c = document.getElementById('quick-list-content'); c.innerHTML = (data.workPatterns||[]).map(p => `<div onclick="if(typeof applyPattern === 'function') { applyPattern(${p.id}); document.getElementById('pattern-quick-list').style.display = 'none'; }" style="padding:12px; border-bottom:1px solid #f1f5f9; cursor:pointer; font-weight:800; color: #1e293b !important;">🧩 ${p.name}</div>`).join('') || '未登録'; } };

// 🌟 第4工程：【追跡】未完了タスクのカード化 🌟

window.updateResultEntryButton = function() {
    const btn = document.getElementById('btn-result-entry');
    if (!btn) return;
    const day = getDayData(selectedDate);
    const incomplete = day.tasks.filter(t => {
        const taskName = (t.name || "").trim();
        const isReq = (data.resultRequiredTasks || []).some(req => req.trim() === taskName);
        // 🌟 修正：remark（備考）ではなく result（結果）が空かどうかで判定
        return isReq && (!t.result || t.result.trim() === "");
    });
    const count = incomplete.length, span = btn.querySelector('span'), icon = btn.querySelector('i');
    if (count > 0) {
        btn.classList.add('btn-magic-sparkle');
        btn.style.setProperty('background', 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)', 'important');
        if(span) span.innerText = `未完了の結果入力 (${count}) 📝✨`;
        if(icon) { icon.setAttribute('data-lucide', 'sparkles'); icon.className = 'kizuna-icon'; } 
    } else {
        btn.classList.remove('btn-magic-sparkle');
        btn.style.setProperty('background', '#94a3b8', 'important');
        if(span) span.innerText = "結果入力は完璧です！ ✅";
        if(icon) { icon.setAttribute('data-lucide', 'list-checks'); icon.className = 'kizuna-icon'; }
    }
    if (window.lucide) window.lucide.createIcons();
};

window.openResultEntryModal = function(filterWorker = 'all') {
    const icon = document.getElementById('guide-icon-area'), title = document.getElementById('guide-title'), content = document.getElementById('guide-content');
    if(!icon || !title || !content) return;
    icon.innerHTML = `<i data-lucide="sparkles" style="width:40px; height:40px; color:#db2777;"></i>`;
    title.innerText = "結果を記憶する 📝";
    const day = getDayData(selectedDate);
    const pending = day.tasks.map((t, i) => ({...t, originalIndex: i})).filter(t => {
        const isReq = (data.resultRequiredTasks || []).some(req => req.trim() === t.name.trim());
        const isMatchWorker = (filterWorker === 'all' || t.worker === filterWorker);
        // 🌟 修正：result（結果）が空のものを抽出
        return isReq && (!t.result || t.result.trim() === "") && isMatchWorker;
    });
    let html = `<div class="form-group"><label>スタッフで絞り込む</label><select onchange="openResultEntryModal(this.value)" style="margin-bottom:15px; border:2px solid #db2777;"><option value="all" ${filterWorker==='all'?'selected':''}>👥 全員を表示</option>${data.masterWorkers.map(w => `<option value="${w}" ${filterWorker===w?'selected':''}>${w.replace(/ \[.*?\]$/, '')}</option>`).join('')}</select></div><div style="max-height: 400px; overflow-y: auto;">`;
    if (pending.length === 0) { html += `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);"><p style="font-weight:800; font-size:18px;">インボックス・ゼロ！✨</p></div>`; }
    else { html += pending.map(t => `<div class="result-pending-card"><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span class="result-pending-worker">${t.worker.replace(/ \[.*?\]$/, '')}</span><span style="font-size:12px; color:var(--text-muted);">${t.start}-${t.end}</span></div><div class="result-pending-task" style="font-weight:900; color: #1e293b !important; margin-bottom:4px;">${t.name}</div>${t.target ? `<div style="font-size:13px; color:#475569; margin-bottom:4px; display:flex; align-items:center; gap:6px;"><i data-lucide="map-pin" style="width:14px; height:14px; color:#6366f1;"></i><span style="font-weight:700;">${t.target}</span></div>` : ''}${t.remark ? `<div style="font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.4; padding:6px; background:#f8fafc; border-radius:8px; border-left:3px solid #e2e8f0;">${t.remark}</div>` : ''}<div style="display:flex; gap:8px; align-items:stretch;"><input type="text" id="quick-remark-${t.originalIndex}" placeholder="結果を入力..." style="flex:2; height:48px; border:2px solid #db2777; border-radius:10px; padding:0 12px; font-size:15px;"><button onclick="saveQuickResult(${t.originalIndex})" style="flex:1; background:linear-gradient(135deg, #db2777 0%, #9d174d 100%); color:white; border:none; border-radius:10px; font-weight:900; font-size:16px; cursor:pointer; box-shadow: 0 4px 0 #881337;">記憶</button></div></div>`).join(''); }
    content.innerHTML = html + `</div>`;
    document.getElementById('large-guide-modal').style.display = 'flex';
    lucide.createIcons();
};

window.saveQuickResult = async function(idx) {
    const val = document.getElementById(`quick-remark-${idx}`).value.trim();
    if (!val) return showToast("結果を入力してください。", 'warning');
    const day = getDayData(selectedDate);
    if (day.tasks[idx]) { 
        // 🌟 修正：remark（備考）ではなく result（結果）フィールドに保存
        day.tasks[idx].result = val; 
        
        // 🌟 個別保存
        if (window.kizunaRepo) {
            await window.kizunaRepo.upsertTask(selectedDate, 'tasks', day.tasks[idx]);
        }
        
        saveAndRefresh('master'); 
        showToast("結果を記憶しました！✨", 'success'); 
        openResultEntryModal(); 
    }
};
