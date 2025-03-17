document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
    const moles = document.querySelectorAll('.mole');
    const hitEffects = document.querySelectorAll('.hit-effect');
    const scoreDisplay = document.querySelector('#score');
    const timeDisplay = document.querySelector('#time');
    const startButton = document.querySelector('#startButton');
    
    // 创建音效
    const hitSound = new Audio('sounds/hit.mp3');
    const popSound = new Audio('sounds/pop.mp3');
    const missSound = new Audio('sounds/miss.mp3'); // 添加没点中的音效
    
    // 预加载音效
    hitSound.load();
    popSound.load();
    missSound.load();
    
    let score = 0;
    let timeLeft = 30;
    let gameInterval;
    let isPlaying = false;
    let lastMissTime = 0; // 记录上次没点中的时间
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

    // 播放音效的函数
    function playSound(sound) {
        // 克隆音效对象以支持重叠播放
        const soundClone = sound.cloneNode();
        soundClone.volume = 0.6; // 设置音量为60%
        soundClone.play().catch(error => {
            console.log('播放音效失败:', error);
        });
    }

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
        playSound(popSound); // 播放地鼠出现的音效
        
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
                playSound(popSound); // 只在倒计时结束时播放一次提示音
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
        lastMissTime = 0; // 重置没点中时间
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
        
        if (!mole.classList.contains('show') || mole.classList.contains('bonked')) {
            // 没点中地鼠
            const currentTime = Date.now();
            if (currentTime - lastMissTime < 1000) { // 如果两次没点中的时间间隔小于1秒
                playSound(missSound); // 播放没点中的音效
            }
            lastMissTime = currentTime;
            return;
        }
        
        score++;
        scoreDisplay.textContent = score;
        lastMissTime = 0; // 重置没点中时间
        
        mole.classList.add('bonked');
        hitEffect.classList.add('show');
        
        // 播放打中音效
        playSound(hitSound);
        
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