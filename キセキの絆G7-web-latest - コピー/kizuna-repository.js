/**
 * @file kizuna-repository.js
 * @description 「キセキの絆」データアクセス層（リポジトリパターン）
 * Firebase Firestoreとの直接的な通信を隠蔽し、データ操作を抽象化します。
 */

class RepositoryError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = "RepositoryError";
        this.originalError = originalError;
    }
}

class KizunaRepository {
    /**
     * @param {Object} db - Firestoreインスタンス
     * @param {Object} sdk - Firestore SDK関数 (doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc等)
     */
    constructor(db, sdk) {
        if (!db || !sdk) {
            throw new Error("Firestore DB and SDK must be provided.");
        }
        this.db = db;
        this.sdk = sdk;
        this.PATH_MASTER = { collection: "work_manager", doc: "master_data" };
        this.COLL_DAILY = "daily_logs";
        this.SUB_TASKS = "tasks";
        this.SUB_PLANS = "plans";
    }

    // --- マスターデータの操作 ---

    /**
     * マスターデータを取得する
     */
    async getMasterData() {
        const { doc, getDoc } = this.sdk;
        try {
            const masterRef = doc(this.db, this.PATH_MASTER.collection, this.PATH_MASTER.doc);
            const snap = await getDoc(masterRef);
            return snap.exists() ? snap.data() : null;
        } catch (e) {
            throw new RepositoryError("Master Data Load Error", e);
        }
    }

    /**
     * マスターデータを保存する
     */
    async saveMasterData(data) {
        const { doc, setDoc } = this.sdk;
        try {
            const masterRef = doc(this.db, this.PATH_MASTER.collection, this.PATH_MASTER.doc);
            await setDoc(masterRef, data);
        } catch (e) {
            throw new RepositoryError("Master Data Save Error", e);
        }
    }

    /**
     * マスターデータのリアルタイム監視を設定する
     */
    subscribeMasterData(callback) {
        const { doc, onSnapshot } = this.sdk;
        const masterRef = doc(this.db, this.PATH_MASTER.collection, this.PATH_MASTER.doc);
        return onSnapshot(masterRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data());
            }
        }, (e) => {
            console.error("Master Data Subscription Error:", e);
        });
    }

    // --- 日付別データの操作（進化版：サブコレクション対応） ---

    /**
     * 指定した日付のデータをリアルタイム購読する
     * @param {string} date - 日付 (YYYY-MM-DD)
     * @param {function} callback - データ更新時に呼ばれる (data {tasks:[], plans:[], miracles:{}})
     */
    subscribeDailyData(date, callback) {
        const { doc, collection, onSnapshot } = this.sdk;
        const dailyDocRef = doc(this.db, this.COLL_DAILY, date);
        const tasksCollRef = collection(dailyDocRef, this.SUB_TASKS);
        const plansCollRef = collection(dailyDocRef, this.SUB_PLANS);

        let dailyBase = { tasks: [], plans: [], miracles: {} };
        let currentTasks = [];
        let currentPlans = [];

        // 1. 日付ドキュメント本体の監視（miraclesなどのメタデータ用）
        const unsubBase = onSnapshot(dailyDocRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                dailyBase.miracles = data.miracles || {};
                // 古い形式のデータが残っている場合も考慮してマージ
                if (data.tasks && !currentTasks.length) dailyBase.tasks = data.tasks;
                if (data.plans && !currentPlans.length) dailyBase.plans = data.plans;
                emit();
            }
        });

        // 2. tasksサブコレクションの監視
        const unsubTasks = onSnapshot(tasksCollRef, (snap) => {
            // 🌟 Latency Compensationを有効化するため、Pending中も受け入れる
            // (if (snap.metadata.hasPendingWrites) return; を削除)

            currentTasks = [];
            snap.forEach(doc => {
                currentTasks.push({ ...doc.data(), id: doc.id });
            });
            // 開始時間順にソート
            currentTasks.sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
            emit();
        });

        // 3. plansサブコレクションの監視
        const unsubPlans = onSnapshot(plansCollRef, (snap) => {
            // 🌟 Latency Compensationを有効化するため、Pending中も受け入れる
            
            currentPlans = [];
            snap.forEach(doc => {
                currentPlans.push({ ...doc.data(), id: doc.id });
            });
            currentPlans.sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
            emit();
        });

        const emit = () => {
            callback({
                ...dailyBase,
                tasks: currentTasks.length ? currentTasks : dailyBase.tasks,
                plans: currentPlans.length ? currentPlans : dailyBase.plans
            });
        };

        // 解除用関数を返す
        return () => {
            unsubBase();
            unsubTasks();
            unsubPlans();
        };
    }

    /**
     * 🌟 【新設】一括書き込み（バッチ）を実行する
     * @param {function} callback - writeBatchオブジェクトを受け取り、操作を行うコールバック
     */
    async runBatch(callback) {
        const { writeBatch } = this.sdk;
        if (!writeBatch) {
            throw new Error("writeBatch is not provided in SDK.");
        }
        const batch = writeBatch(this.db);
        
        // コールバック内で batch.set や batch.delete を行ってもらう
        // 第2引数としてsdkのヘルパー(docなど)を渡すと使いやすい
        await callback(batch, this.sdk);
        
        await batch.commit();
    }

    /**
     * タスクを追加または更新する
     * @param {string} date - 日付
     * @param {string} type - 'tasks' or 'plans'
     * @param {Object} taskData - タスクデータ
     */
    async upsertTask(date, type, taskData) {
        const { doc, setDoc } = this.sdk;
        try {
            // IDがない場合は、ワーカー名と開始時間の組み合わせなどでユニークなIDを生成
            const id = taskData.id || `${taskData.worker}_${taskData.start}`.replace(/[.#$/[\] :]/g, '_');
            const taskRef = doc(this.db, this.COLL_DAILY, date, type, id);
            
            // 保存前にIDをデータに含める
            const dataToSave = { ...taskData, id: id };
            await setDoc(taskRef, dataToSave);
            return id;
        } catch (e) {
            throw new RepositoryError(`Task Upsert Error (${date}/${type})`, e);
        }
    }

    /**
     * タスクを削除する
     */
    async deleteTask(date, type, taskId) {
        const { doc, deleteDoc } = this.sdk;
        if (!deleteDoc) {
            console.warn("deleteDoc is not provided in SDK. Check index.html imports.");
            return;
        }
        try {
            const taskRef = doc(this.db, this.COLL_DAILY, date, type, taskId);
            await deleteDoc(taskRef);
        } catch (e) {
            throw new RepositoryError(`Task Delete Error (${date}/${type}/${taskId})`, e);
        }
    }

    /**
     * ミラクル（評価）のみを保存する（日付ドキュメント本体へ）
     */
    async saveMiracles(date, miracles) {
        const { doc, setDoc } = this.sdk;
        try {
            const docRef = doc(this.db, this.COLL_DAILY, date);
            await setDoc(docRef, { miracles }, { merge: true });
        } catch (e) {
            throw new RepositoryError(`Miracles Save Error (${date})`, e);
        }
    }

    // --- 日付別データの操作（一括取得：分析用等） ---
    
    /**
     * 指定した日付のデータを取得する（サブコレクション対応版）
     */
    async getDailyData(date) {
        const { doc, getDoc, collection, getDocs } = this.sdk;
        try {
            const dailyDocRef = doc(this.db, this.COLL_DAILY, date);
            const tasksCollRef = collection(dailyDocRef, this.SUB_TASKS);
            const plansCollRef = collection(dailyDocRef, this.SUB_PLANS);

            // 並列でフェッチ
            const [baseSnap, tasksSnap, plansSnap] = await Promise.all([
                getDoc(dailyDocRef),
                getDocs(tasksCollRef),
                getDocs(plansCollRef)
            ]);

            let result = { tasks: [], plans: [], miracles: {} };

            // 1. 本体ドキュメントの反映
            if (baseSnap.exists()) {
                const data = baseSnap.data();
                result.miracles = data.miracles || {};
                // 古い形式のデータがメインドキュメントに残っている場合
                if (data.tasks) result.tasks = data.tasks;
                if (data.plans) result.plans = data.plans;
            }

            // 2. サブコレクションの反映（あればメインを上書き）
            if (!tasksSnap.empty) {
                result.tasks = tasksSnap.docs.map(d => ({ ...d.data(), id: d.id }));
                result.tasks.sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
            }
            if (!plansSnap.empty) {
                result.plans = plansSnap.docs.map(d => ({ ...d.data(), id: d.id }));
                result.plans.sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
            }

            return result;
        } catch (e) {
            throw new RepositoryError(`Daily Data Full Load Error (${date})`, e);
        }
    }

    /**
     * 危険な一括保存を封印（デッドリー・コンフリクト対策）
     */
    async saveDailyData(date, data) {
        console.warn("saveDailyData is deprecated. Use upsertTask or saveMiracles instead.");
        // 安全のため、ミラクルのみ保存するようにリダイレクト
        if (data && data.miracles) {
            return await this.saveMiracles(date, data.miracles);
        }
    }

    /**
     * 指定した範囲の日付データを取得する（サブコレクション対応版）
     */
    async getDailyRange(startDate, endDate) {
        const { collection, query, where, getDocs } = this.sdk;
        try {
            const q = query(
                collection(this.db, this.COLL_DAILY),
                where("__name__", ">=", startDate),
                where("__name__", "<=", endDate)
            );
            const querySnapshot = await getDocs(q);
            
            const results = {};
            // 日付ごとのメインドキュメントを取得
            const dateIds = [];
            querySnapshot.forEach((doc) => {
                dateIds.push(doc.id);
                results[doc.id] = { ...doc.data(), id: doc.id };
            });

            // それぞれの日付に対してサブコレクションも取得（分析用などで必要）
            await Promise.all(dateIds.map(async (date) => {
                const fullData = await this.getDailyData(date);
                results[date] = fullData;
            }));

            return results;
        } catch (e) {
            throw new RepositoryError(`Range Load Error (${startDate} to ${endDate})`, e);
        }
    }
}

// グローバルに公開
window.KizunaRepository = KizunaRepository;
