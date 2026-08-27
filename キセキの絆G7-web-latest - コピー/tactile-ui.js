// --- tactile-ui.js: 聴覚による触覚の補完 ---

const TactileSound = {
    // 短く高級感のあるクリック音（Base64 wav）
    // このURLはサンプルであり、実際の実行時には有効な短いオーディオファイルが必要です。
    // 現状では、ブラウザのセキュリティ制約により、外部URLやData URLからの音声再生は制限される場合があります。
    // 実際に機能させるためには、サーバー上に短いwavファイルを配置し、そのパスを指定する必要があります。
    // 例: clickSound: new Audio('/sounds/click.wav'),
    // ここでは、仮に動作するものとして定義します。
    clickSound: null, // 後で音声ファイルをロードします

    init() {
        // 音源の初期設定
        try {
            // Data URLはセキュリティでブロックされることがあるため、ここではローカルファイルパスを想定
            // 実際の環境では、サーバーに配置した音声ファイルのパスを指定してください。
            // 例: this.clickSound = new Audio('/sounds/click.wav');
            // テストのため、ここでは null のままにしておきます。
            this.clickSound = new Audio('/sounds/click.wav'); // 仮のパス
            this.clickSound.volume = 0.15;
            this.clickSound.load();
        } catch (e) {
            console.warn("TactileSound: Could not initialize audio. Sound effects might not play. Error:", e);
        }
    },

    play() {
        if (!this.clickSound) {
            console.warn("TactileSound: Audio not loaded.");
            return;
        }
        // 再生位置を戻して連続クリックに対応
        const s = this.clickSound.cloneNode();
        s.volume = 0.15;
        s.play().catch((e) => {
            // 初回のユーザーインタラクション制限によるエラーや、再生失敗を無視
            // console.warn("TactileSound: Playback failed. Error:", e);
        });
    }
};

// 初期化（DOMロード後に実行されるように調整）
window.addEventListener('DOMContentLoaded', () => {
    TactileSound.init();
});

// 全ての「触覚ボタン」にイベントを付与
document.addEventListener('mousedown', (e) => {
    // .action-chip または .fav-chip, .btn-miracle-magic などを対象にする
    if (e.target.closest('.action-chip') || 
        e.target.closest('.fav-chip') || 
        e.target.closest('.btn-miracle-magic') ||
        e.target.closest('.btn-miracle-team') ||
        e.target.closest('.selection-chip')) {
        
        TactileSound.play();
    }
});

// 🌟 【おまけ】ホバー時の微かな空気感
document.addEventListener('mouseover', (e) => {
    if (e.target.closest('.action-chip')) {
        // ここに微かなバイブレーションAPIなどを呼ぶことも可能（モバイル用）
    }
});
