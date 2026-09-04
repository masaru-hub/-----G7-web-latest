// Firebase初期化および環境変数読み込みモジュール
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDocs, 
    deleteDoc, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

async function fetchFirebaseConfig() {
    try {
        const response = await fetch('/api/firebase-config');
        if (response.ok) {
            const serverConfig = await response.json();
            if (serverConfig && serverConfig.apiKey) {
                return serverConfig;
            }
        }
    } catch (e) {
        console.warn("⚠️ Could not fetch /api/firebase-config:", e);
    }

    // クライアント側環境変数フォールバック
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    return {
        apiKey: env.VITE_FIREBASE_API_KEY || "",
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "kiseki-trial.firebaseapp.com",
        projectId: env.VITE_FIREBASE_PROJECT_ID || "kiseki-trial",
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "kiseki-trial.firebasestorage.app",
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "536584906374",
        appId: env.VITE_FIREBASE_APP_ID || "1:536584906374:web:2172a118cfd110de661307",
        databaseURL: env.VITE_FIREBASE_DATABASE_URL || "https://kiseki-trial-default-rtdb.firebaseio.com"
    };
}

export async function initFirebaseApp() {
    try {
        console.log("🚀 Initializing Firebase from environment variables...");
        const firebaseConfig = await fetchFirebaseConfig();

        if (!firebaseConfig.apiKey) {
            console.warn("⚠️ [Firebase] API Key is empty. Please set VITE_FIREBASE_API_KEY in your .env or Settings.");
        }
        
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // 匿名ログインを実行
        console.log("🔐 Signing in anonymously...");
        await signInAnonymously(auth);
        console.log("✅ Signed in successfully!");

        // リポジトリ初期化
        const sdk = { doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, writeBatch };
        const repo = new window.KizunaRepository(db, sdk);

        window.firebaseDB = db;
        window.fbSDK = sdk;
        window.kizunaRepo = repo;
        window.firebaseAuth = auth;

        console.log("✨ KizunaRepository Ready with Environment Config.");
        return { app, db, auth, repo, sdk };
    } catch (e) {
        console.error("🚨 Firebase Initialization Error:", e);
        alert("Firebaseの接続に失敗しました。.envのAPIキー設定や通信環境を確認してください。");
        throw e;
    }
}
