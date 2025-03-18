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
    
    // 音效系统
    class SoundPool {
        constructor(src, poolSize = 3) {
            this.sounds = Array(poolSize).fill(null).map(() => {
                const audio = new Audio(src);
                audio.volume = 0.6;
                return audio;
            });
            this.currentIndex = 0;
        }

        play() {
            const sound = this.sounds[this.currentIndex];
            
            // 如果当前音效正在播放，立即重置
            if (!sound.paused) {
                sound.currentTime = 0;
            }
            
            // 使用 Promise 来处理播放
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('音效播放失败:', error);
                });
            }

            // 更新索引到下一个音效
            this.currentIndex = (this.currentIndex + 1) % this.sounds.length;
        }

        stop() {
            this.sounds.forEach(sound => {
                sound.pause();
                sound.currentTime = 0;
            });
        }
    }

    // 创建音效池
    const hitSoundPool = new SoundPool('sounds/hit.mp3', 3);
    const popSoundPool = new SoundPool('sounds/pop.mp3', 3);
    const missSoundPool = new SoundPool('sounds/miss.mp3', 3);
    const endSound = new Audio('sounds/end.mp3');
    endSound.volume = 0.6;

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
            { type: 'audio', src: 'sounds/miss.mp3', critical: false }
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

    // 预加载所有音效
    function preloadSounds() {
        const sounds = [
            ...hitSoundPool.sounds,
            ...popSoundPool.sounds,
            ...missSoundPool.sounds,
            endSound
        ];

        return Promise.all(sounds.map(sound => {
            return new Promise((resolve) => {
                sound.preload = 'auto';
                sound.addEventListener('canplaythrough', resolve, { once: true });
                sound.load();
            });
        }));
    }

    // 优化的播放音效函数
    function playSound(soundPool) {
        if (!soundPool) return;
        soundPool.play();
    }

    function randomTime(min, max) {
        return Math.round(Math.random() * (max - min) + min);
    }

    function randomHole(holes, excludeHoles = []) {
        const availableHoles = Array.from(holes).filter(hole => 
            !hole.lastHole && !excludeHoles.includes(hole)
        );
        
        if (availableHoles.length === 0) {
            return null;
        }
        
        const index = Math.floor(Math.random() * availableHoles.length);
        const hole = availableHoles[index];
        
        hole.lastHole = true;
        setTimeout(() => {
            hole.lastHole = false;
        }, 100);
        
        return hole;
    }

    function getRandomMoleCount() {
        const rand = Math.random();
        if (rand < 0.1) {  // 10% 概率
            return 3;
        } else if (rand < 0.4) {  // 30% 概率
            return 2;
        }
        return 1;  // 60% 概率
    }

    function peep() {
        if (!isPlaying) return;

        const time = randomTime(500, 1000);
        const moleCount = getRandomMoleCount();
        const selectedHoles = [];
        
        // 选择指定数量的不重复地洞
        for (let i = 0; i < moleCount; i++) {
            const hole = randomHole(holes, selectedHoles);
            if (hole) {
                selectedHoles.push(hole);
                const mole = hole.querySelector('.mole');
                // 确保移除之前的所有状态
                mole.classList.remove('bonked');
                mole.classList.add('show');
                playSound(popSoundPool);
            }
        }
        
        setTimeout(() => {
            selectedHoles.forEach(hole => {
                const mole = hole.querySelector('.mole');
                if (!mole.classList.contains('bonked')) {
                    mole.classList.remove('show');
                }
            });
            if (isPlaying) peep();
        }, time);
    }

    function countdown(count) {
        return new Promise(resolve => {
            startButton.textContent = count;
            if (count > 0) {
                setTimeout(() => countdown(count - 1).then(resolve), 1000);
            } else {
                playSound(popSoundPool); // 只在倒计时结束时播放一次提示音
                resolve();
            }
        });
    }

    function getEndMessage(score) {
        if (score > 30) {
            return "恭喜你打败了曹星妍大魔王！";
        } else if (score >= 20) {
            return "你怎么蔡如曹星妍！";
        } else {
            return "你是曹星妍的手下败将！";
        }
    }

    function showEndDialog(score) {
        const message = getEndMessage(score);
        endSound.currentTime = 0;
        endSound.play().catch(error => {
            console.log('播放结束音效失败:', error);
        });
        
        const dialog = document.createElement('div');
        dialog.className = 'end-dialog';
        dialog.innerHTML = `
            <div class="end-content">
                <h2>游戏结束</h2>
                <p>你的得分是: ${score}</p>
                <p class="end-message">${message}</p>
                <button class="restart-button">重新开始</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const restartButton = dialog.querySelector('.restart-button');
        restartButton.addEventListener('click', () => {
            endSound.pause();
            endSound.currentTime = 0;
            document.body.removeChild(dialog);
            startGame();
        });
    }

    async function startGame() {
        if (isPlaying) return;
        
        // 预加载音效
        try {
            await preloadSounds();
        } catch (error) {
            console.warn('音效预加载失败:', error);
        }

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
                clearInterval(gameInterval);
                isPlaying = false;
                startButton.disabled = false;
                startButton.textContent = originalButtonText;
                moles.forEach(mole => {
                    mole.classList.remove('show', 'bonked');
                });
                showEndDialog(score);
            }
        }, 1000);
    }

    function bonk(e) {
        if (!isPlaying) return;
        if (!e.isTrusted) return;
        
        const hole = this;
        const mole = hole.querySelector('.mole');
        const hitEffect = hole.querySelector('.hit-effect');
        
        if (mole.classList.contains('show') && !mole.classList.contains('bonked')) {
            // 击中地鼠
            playSound(hitSoundPool);
            mole.classList.add('bonked');
            hitEffect.classList.add('show');
            score++;
            scoreDisplay.textContent = score;
            lastMissTime = 0; // 重置未击中计时
            
            // 分两步移除效果，使动画更明显
            setTimeout(() => {
                mole.classList.remove('show');
                hitEffect.classList.remove('show');
                setTimeout(() => {
                    mole.classList.remove('bonked');
                }, 200);
            }, 500);
        } else if (!mole.classList.contains('show') || mole.classList.contains('bonked')) {
            // 未击中或点击已经被打中的地鼠
            const now = Date.now();
            if (now - lastMissTime < 1000 && lastMissTime !== 0) { // 1秒内的连续未击中，且不是第一次未击中
                playSound(missSoundPool);
            }
            lastMissTime = now;
        }
    }

    // 将事件监听器绑定到地洞而不是地鼠上
    holes.forEach(hole => {
        hole.addEventListener('touchstart', bonk);
        hole.addEventListener('mousedown', bonk);
    });

    startButton.addEventListener('click', startGame);
}); 