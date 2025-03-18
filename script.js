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
    
    // 音频上下文和音频缓存
    let audioContext;
    const audioBuffers = new Map();
    
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

    // 初始化音频上下文
    async function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 预加载所有音频
            const audioFiles = {
                'hit': 'sounds/hit.mp3',
                'pop': 'sounds/pop.mp3',
                'miss': 'sounds/miss.mp3',
                'end': 'sounds/end.mp3'
            };
            
            for (const [name, url] of Object.entries(audioFiles)) {
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    audioBuffers.set(name, audioBuffer);
                } catch (error) {
                    console.error(`音频 ${name} 加载失败:`, error);
                }
            }
        } catch (error) {
            console.error('音频上下文初始化失败:', error);
        }
    }

    // 播放音效的新函数
    function playSound(soundType) {
        if (!audioContext || audioContext.state === 'suspended') {
            audioContext?.resume();
            return;
        }

        const buffer = audioBuffers.get(soundType);
        if (!buffer) {
            console.warn(`未找到音效: ${soundType}`);
            return;
        }

        try {
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();
            
            source.buffer = buffer;
            gainNode.gain.value = 0.6; // 设置音量
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            source.start(0);
        } catch (error) {
            console.error('播放音效失败:', error);
        }
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
        playSound('pop');
        
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
                playSound('pop'); // 只在倒计时结束时播放一次提示音
                resolve();
            }
        });
    }

    // 修改游戏开始逻辑，确保音频上下文已初始化
    async function startGame() {
        if (isPlaying) return;
        
        // 确保音频上下文已初始化
        if (!audioContext) {
            await initAudio();
        }
        
        // 恢复音频上下文（iOS要求用户交互后才能播放声音）
        if (audioContext?.state === 'suspended') {
            await audioContext.resume();
        }
        
        startButton.disabled = true;
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
            const currentTime = Date.now();
            if (currentTime - lastMissTime < 1000) {
                playSound('miss');
            }
            lastMissTime = currentTime;
            return;
        }
        
        score++;
        scoreDisplay.textContent = score;
        lastMissTime = 0;
        
        mole.classList.add('bonked');
        hitEffect.classList.add('show');
        
        playSound('hit');
        
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