document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.querySelector('.welcome-screen');
    const gameContainer = document.querySelector('.game-container');
    const loadingProgress = document.querySelector('.loading-progress');
    const loadingPercentage = document.querySelector('.loading-percentage');
    const holes = document.querySelectorAll('.hole');
    const moles = document.querySelectorAll('.mole');
    const hitEffects = document.querySelectorAll('.hit-effect');
    const scoreDisplay = document.querySelector('#score');
    const timeDisplay = document.querySelector('#time');
    const startButton = document.querySelector('#startButton');
    
    // 创建音效
    const hitSound = new Audio('sounds/hit.mp3');
    const popSound = new Audio('sounds/pop.mp3');
    const missSound = new Audio('sounds/miss.mp3');
    const endSound = new Audio('sounds/end.mp3'); // 添加结束音效
    
    let score = 0;
    let timeLeft = 30;
    let gameInterval;
    let isPlaying = false;
    let lastMissTime = 0;
    const originalButtonText = startButton.textContent;

    async function loadResource(resource, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                if (resource.type === 'image') {
                    await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = resource.src;
                        // 设置5秒超时
                        setTimeout(() => reject(new Error('Timeout')), 5000);
                    });
                    return true;
                } else if (resource.type === 'audio') {
                    await new Promise((resolve, reject) => {
                        const audio = new Audio();
                        audio.oncanplaythrough = resolve;
                        audio.onerror = reject;
                        audio.src = resource.src;
                        // 设置5秒超时
                        setTimeout(() => reject(new Error('Timeout')), 5000);
                    });
                    return true;
                }
            } catch (error) {
                console.warn(`加载失败 ${resource.src}, 重试 ${i + 1}/${retries}`, error);
                if (i === retries - 1) {
                    console.error(`资源加载失败: ${resource.src}`, error);
                    // 如果是非关键资源，允许继续
                    return false;
                }
                // 等待一秒后重试
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return false;
    }

    async function loadResources() {
        const resources = [
            { type: 'image', src: 'images/mole.png', critical: true },
            { type: 'image', src: 'images/mole-bonked.png', critical: true },
            { type: 'audio', src: 'sounds/hit.mp3', critical: false },
            { type: 'audio', src: 'sounds/pop.mp3', critical: false },
            { type: 'audio', src: 'sounds/miss.mp3', critical: false },
            { type: 'audio', src: 'sounds/end.mp3', critical: false }  // 添加结束音效资源
        ];

        let loadedCount = 0;
        const totalResources = resources.length;
        const criticalResources = resources.filter(r => r.critical);

        try {
            // 优先加载关键资源
            for (const resource of criticalResources) {
                const success = await loadResource(resource);
                if (!success && resource.critical) {
                    throw new Error(`关键资源加载失败: ${resource.src}`);
                }
                loadedCount++;
                const progress = (loadedCount / totalResources) * 100;
                loadingProgress.style.width = `${progress}%`;
                loadingPercentage.textContent = `${Math.round(progress)}%`;
            }

            // 加载非关键资源
            const nonCriticalResources = resources.filter(r => !r.critical);
            for (const resource of nonCriticalResources) {
                await loadResource(resource);
                loadedCount++;
                const progress = (loadedCount / totalResources) * 100;
                loadingProgress.style.width = `${progress}%`;
                loadingPercentage.textContent = `${Math.round(progress)}%`;
            }

            // 所有资源加载完成或超时后，显示游戏界面
            setTimeout(() => {
                welcomeScreen.style.opacity = '0';
                setTimeout(() => {
                    welcomeScreen.style.display = 'none';
                    gameContainer.style.display = 'block';
                }, 500);
            }, 500);
        } catch (error) {
            console.error('资源加载失败:', error);
            loadingPercentage.textContent = '加载失败，请刷新重试';
        }
    }

    // 开始加载资源
    loadResources();

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
        const soundClone = sound.cloneNode();
        soundClone.volume = 0.6;
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

    // 添加游戏结束处理函数
    function handleGameEnd() {
        clearInterval(gameInterval);
        isPlaying = false;
        startButton.disabled = false;
        startButton.textContent = originalButtonText;
        
        moles.forEach(mole => {
            mole.classList.remove('show', 'bonked');
        });

        // 播放结束音效
        endSound.currentTime = 0; // 重置音频播放位置
        endSound.play().catch(error => {
            console.log('播放结束音效失败:', error);
        });

        // 根据得分显示不同的结束信息
        let message = '';
        if (score > 33) {
            message = '恭喜你打败了曹星妍大魔王！';
        } else if (score >= 20) {
            message = '你怎么蔡如曹星妍！';
        } else {
            message = '你是曹星妍的手下败将！';
        }

        // 创建自定义结束对话框
        const dialog = document.createElement('div');
        dialog.className = 'game-over-dialog';
        dialog.innerHTML = `
            <div class="game-over-content">
                <h2>游戏结束</h2>
                <p>你的得分是: ${score}</p>
                <p class="result-message">${message}</p>
                <button class="restart-button">重新开始</button>
            </div>
        `;

        document.body.appendChild(dialog);

        // 添加重新开始按钮事件
        const restartButton = dialog.querySelector('.restart-button');
        restartButton.addEventListener('click', () => {
            endSound.pause(); // 停止结束音效
            endSound.currentTime = 0; // 重置音频位置
            document.body.removeChild(dialog);
            startGame(); // 重新开始游戏
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
        lastMissTime = 0;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeLeft;
        startButton.textContent = timeLeft + '秒';
        
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
                handleGameEnd();
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