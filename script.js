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
    let timeLeft = 15;
    let gameInterval;
    let isPlaying = false;
    let lastMissTime = 0;
    let currentLevel = 1;
    const maxLevel = 5;
    const originalButtonText = startButton.textContent;
    let totalMoles = 0; // 记录出现的地鼠总数
    let hitMoles = 0;   // 记录打中的地鼠数
    let totalScore = 0; // 添加总分变量

    // 关卡配置
    const levelConfig = {
        1: {
            time: 5,
            moleShowTime: { min: 1000, max: 2000 },
            multiMoleChance: { two: 0.02, three: 0.01 },
            requiredHitRate: 0.50  // 50%通过率
        },
        2: {
            time: 15,
            moleShowTime: { min: 600, max: 1000 },
            multiMoleChance: { two: 0.2, three: 0.2 },
            requiredHitRate: 0.6
        },
        3: {
            time: 5,
            moleShowTime: { min: 1000, max: 1500 },
            multiMoleChance: { two: 0.1, three: 0.05 },
            requiredHitRate: 0.10
        },
        4: {
            time: 15,
            moleShowTime: { min: 600, max: 800 },
            multiMoleChance: { two: 0.5, three: 0.5 },
            requiredHitRate: 0.6
        },
        5: {
            time: 6,
            moleShowTime: { min: 1500, max: 2000 },
            multiMoleChance: { two: 0.6, three: 0.3 },
            requiredHitRate: 0 // 不点也能通关
        }
    };

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
        const config = levelConfig[currentLevel].multiMoleChance;
        const rand = Math.random();
        if (rand < config.three) {  // 三只地鼠的概率
            return 3;
        } else if (rand < config.two) {  // 两只地鼠的概率
            return 2;
        }
        return 1;
    }

    function peep() {
        if (!isPlaying) return;

        const config = levelConfig[currentLevel].moleShowTime;
        const time = randomTime(config.min, config.max);
        const moleCount = getRandomMoleCount();
        const selectedHoles = [];
        
        totalMoles += moleCount; // 增加地鼠计数
        
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

    function getLevelMessage(level) {
        return `第 ${level} 关`;
    }

    function showLevelStartDialog(level) {
        const dialog = document.createElement('div');
        dialog.className = 'end-dialog';
        dialog.innerHTML = `
            <div class="end-content">
                <h2>${getLevelMessage(level)}</h2>
                <p class="level-description">难度：${'⭐'.repeat(level)}</p>
                <p class="level-tips">${getLevelTips(level)}</p>
                <button class="restart-button">开始</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        return new Promise(resolve => {
            const startButton = dialog.querySelector('.restart-button');
            startButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve();
            });
        });
    }

    function getLevelTips(level) {
        const tips = {
            1: "第一关如天堑难以逾越",
            2: "注意可能出现全屏幕的曹大魔王！",
            3: "过了这关作者会得到您的奖励10元",
            4: "让您放松一会儿",
            5: "厉害啊，最后一关您可是过不了的"
        };
        return tips[level];
    }

    function getHitRate() {
        return totalMoles === 0 ? 0 : hitMoles / totalMoles;
    }

    function getEndMessage(score, level) {
        const hitRate = getHitRate();
        const requiredRate = levelConfig[level].requiredHitRate;
        const totalHitRate = hitMoles / totalMoles;
        
        if (level === maxLevel) {
            if (totalHitRate >= 0.9) {  // 90%命中率
                return `如宋老般实力碾压！总命中率：${Math.round(totalHitRate * 100)}%`;
            }
            if (hitRate >= requiredRate) {
                return "您疯了吗，我倒计时10分钟您是硬生生打完了？您不知道最后一关挂机也能过吗？手酸不？后悔不？作业做了吗？您打完的消息已经上传给宋老，等着加作业吧！";
            }
        }
        
        if (hitRate >= requiredRate) {
            if (level === 3) {
                return "说到做到，赶紧奖励作者10元！";
            }
            if (level === 1) {
                return "简单吧，因为您是天才啊";
            }
            if (level === 4) {
                return "小瞧您了，下关你可过不了！";
            }
            if (level === 2) {
                return "厉害，这也能过，下关加油有奖励";
            }
            if (level < maxLevel) {
                return "天才般的黄金双手！";
            }
        } else {
            return "你蔡如曹星妍，继续努力吧！";
        }
        
        return "游戏结束！";
    }

    function playEndSound(level) {
        endSound.currentTime = 0;
        
        // 计算当前关卡应该播放的音频长度比例（20% * 当前关卡）
        const playRatio = Math.min(0.2 * level, 1);
        
        // 播放音效
        endSound.play().then(() => {
            // 设置定时器在指定时间后停止播放
            setTimeout(() => {
                endSound.pause();
                endSound.currentTime = 0;
            }, endSound.duration * 1000 * playRatio);
        }).catch(error => {
            console.log('播放结束音效失败:', error);
        });
    }

    function showEndDialog(score) {
        const hitRate = getHitRate();
        const requiredRate = levelConfig[currentLevel].requiredHitRate;
        totalScore += score;
        const message = getEndMessage(score, currentLevel);
        
        // 使用新的音效播放函数
        playEndSound(currentLevel);
        
        const dialog = document.createElement('div');
        dialog.className = 'end-dialog';
        dialog.innerHTML = `
            <div class="end-content">
                <h2>第 ${currentLevel} 关结束</h2>
                <p>本关得分: ${score}</p>
                <p>总得分: ${totalScore}</p>
                <p>命中率: ${Math.round(hitRate * 100)}% (需要 ${Math.round(requiredRate * 100)}%)</p>
                <p class="end-message">${message}</p>
                ${hitRate >= requiredRate && currentLevel < maxLevel ? 
                    '<button class="next-level-button">下一关</button>' : 
                    '<button class="restart-button">重新开始</button>'}
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const nextButton = dialog.querySelector('.next-level-button') || dialog.querySelector('.restart-button');
        nextButton.addEventListener('click', () => {
            endSound.pause();
            endSound.currentTime = 0;
            document.body.removeChild(dialog);
            if (hitRate >= requiredRate && currentLevel < maxLevel) {
                currentLevel++;
                startGame();
            } else {
                currentLevel = 1;
                totalScore = 0;
                startGame();
            }
        });
    }

    async function startGame() {
        if (isPlaying) return;
        
        // 如果是第一关，重置总分
        if (currentLevel === 1) {
            totalScore = 0;
        }
        
        // 重置计数器
        totalMoles = 0;
        hitMoles = 0;
        
        // 显示关卡开始对话框
        await showLevelStartDialog(currentLevel);
        
        // 预加载音效
        try {
            await preloadSounds();
        } catch (error) {
            console.warn('音效预加载失败:', error);
        }

        startButton.disabled = true;
        await countdown(2);  // 修改为2秒倒计时
        
        score = 0;
        timeLeft = levelConfig[currentLevel].time;
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
            hitMoles++; // 增加打中计数
            playSound(hitSoundPool);
            mole.classList.add('bonked');
            hitEffect.classList.add('show');
            score++;
            scoreDisplay.textContent = score;
            lastMissTime = 0;
            
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