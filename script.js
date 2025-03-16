document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
    const moles = document.querySelectorAll('.mole');
    const hitEffects = document.querySelectorAll('.hit-effect');
    const scoreDisplay = document.querySelector('#score');
    const timeDisplay = document.querySelector('#time');
    const startButton = document.querySelector('#startButton');
    
    let score = 0;
    let timeLeft = 30;
    let gameInterval;
    let isPlaying = false;
    const originalButtonText = startButton.textContent;

    // 禁用双击缩放
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // 防止页面滚动
    document.body.addEventListener('touchmove', (e) => {
        if (isPlaying) {
            e.preventDefault();
        }
    }, { passive: false });

    function randomTime(min, max) {
        return Math.round(Math.random() * (max - min) + min);
    }

    function randomHole(holes) {
        const index = Math.floor(Math.random() * holes.length);
        const hole = holes[index];
        
        if (hole.lastHole) {
            return randomHole(holes);
        }
        
        hole.lastHole = true;
        setTimeout(() => {
            hole.lastHole = false;
        }, 100);
        
        return hole;
    }

    function peep() {
        if (!isPlaying) return;

        const time = randomTime(500, 1000);
        const hole = randomHole(holes);
        const mole = hole.querySelector('.mole');
        
        mole.classList.add('show');
        
        setTimeout(() => {
            if (!mole.classList.contains('bonked')) {
                mole.classList.remove('show');
            }
            if (isPlaying) peep();
        }, time);
    }

    function countdown(count) {
        return new Promise(resolve => {
            startButton.textContent = count;
            if (count > 0) {
                setTimeout(() => countdown(count - 1).then(resolve), 1000);
            } else {
                resolve();
            }
        });
    }

    async function startGame() {
        if (isPlaying) return;
        
        startButton.disabled = true;
        // 开始3秒倒计时
        await countdown(3);
        
        score = 0;
        timeLeft = 30;
        isPlaying = true;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeLeft;
        startButton.textContent = timeLeft + '秒';
        
        // 确保所有地鼠和效果都重置状态
        moles.forEach(mole => {
            mole.classList.remove('show', 'bonked');
        });
        hitEffects.forEach(effect => {
            effect.classList.remove('show');
        });
        
        peep();
        
        gameInterval = setInterval(() => {
            timeLeft--;
            timeDisplay.textContent = timeLeft;
            startButton.textContent = timeLeft + '秒';
            
            if (timeLeft <= 0) {
                clearInterval(gameInterval);
                isPlaying = false;
                startButton.disabled = false;
                startButton.textContent = originalButtonText;
                moles.forEach(mole => {
                    mole.classList.remove('show', 'bonked');
                });
                alert(`游戏结束！你的得分是: ${score}`);
            }
        }, 1000);
    }

    function bonk(e) {
        if (!isPlaying) return;
        if (!e.isTrusted) return;
        
        const hole = this;
        const mole = hole.querySelector('.mole');
        const hitEffect = hole.querySelector('.hit-effect');
        
        if (!mole.classList.contains('show') || mole.classList.contains('bonked')) return;
        
        score++;
        scoreDisplay.textContent = score;
        
        mole.classList.add('bonked');
        hitEffect.classList.add('show');
        
        // 播放打中音效（如果需要）
        // playHitSound();
        
        setTimeout(() => {
            mole.classList.remove('show');
            hitEffect.classList.remove('show');
            setTimeout(() => {
                mole.classList.remove('bonked');
            }, 200);
        }, 500);
    }

    // 将事件监听器绑定到地洞而不是地鼠上
    holes.forEach(hole => {
        hole.addEventListener('touchstart', bonk);
        hole.addEventListener('mousedown', bonk);
    });

    startButton.addEventListener('click', startGame);
}); 