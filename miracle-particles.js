// --- miracle-particles.js: 感情を揺さぶる視覚報酬エンジン ---

const ParticleSystem = {
    canvas: null,
    ctx: null,
    particles: [],
    initialized: false,

    init() {
        if (this.initialized) return;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'miracle-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none'; // 操作を邪魔しない
        this.canvas.style.zIndex = '10000'; // 最前面
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.animate();
        this.initialized = true;
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    createParticle(x, y, count = 40, colorSet = 'gold') {
        const palettes = {
            gold: ['#f59e0b', '#fbbf24', '#ffffff', '#fef3c7', '#d97706'],
            magic: ['#6366f1', '#818cf8', '#ffffff', '#e0e7ff', '#4338ca'],
            miracle: ['#db2777', '#f472b6', '#ffffff', '#fdf2f8', '#9d174d']
        };
        const colors = palettes[colorSet] || palettes.gold;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12 - 3, // わずかに上方向に勢いをつける
                radius: Math.random() * 4 + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                life: Math.random() * 0.015 + 0.008,
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.2
            });
        }
    },

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.ctx || this.particles.length === 0) {
            if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18; // 絶妙な重力感
            p.alpha -= p.life;
            p.rotation += p.spin;
            
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            
            // 粒子の形を少しキラキラさせる（ひし形っぽく）
            this.ctx.beginPath();
            this.ctx.moveTo(0, -p.radius * 1.5);
            this.ctx.lineTo(p.radius, 0);
            this.ctx.lineTo(0, p.radius * 1.5);
            this.ctx.lineTo(-p.radius, 0);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 強い光の粒子にはぼかしを入れる
            if (p.radius > 3) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color;
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }
    },

    burst(x, y, colorSet = 'gold', count = 40) {
        this.init();
        this.createParticle(x || window.innerWidth / 2, y || window.innerHeight / 2, count, colorSet);
    }
};

// グローバルに公開（他のJSから魔法を使えるように）
window.MiracleMagic = ParticleSystem;
