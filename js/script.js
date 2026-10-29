/**
 * Super Mario Jump - Obstáculos repetidos e ranking MySQL
 */

document.addEventListener('DOMContentLoaded', () => {
    const mario = document.querySelector('.mario');
    const obstaculoTemplate = document.querySelector('.obstaculo');
    const gameBoard = document.getElementById('game-board');

    const hudPlayerName = document.getElementById('hud-player-name');
    const scoreDisplay = document.getElementById('score-display');
    const jumpTip = document.getElementById('jump-tip');

    const startModal = document.getElementById('start-modal');
    const startForm = document.getElementById('start-form');
    const playerInput = document.getElementById('player-input');
    const btnViewRanking = document.getElementById('btn-view-ranking');

    const gameoverModal = document.getElementById('gameover-modal');
    const finalScoreValue = document.getElementById('final-score-value');
    const saveStatusMsg = document.getElementById('save-status-msg');
    const rankingBody = document.getElementById('ranking-body');
    const btnRestart = document.getElementById('btn-restart');
    const btnChangePlayer = document.getElementById('btn-change-player');

    let currentPlayer = '';
    let score = 0;
    let isPlaying = false;
    let gameLoop = null;
    let scoreLoop = null;
    let birdTimeout = null;
    let spawnTimeout = null;
    let obstaculos = [];
    let moedas = [];
    const JUMP_MS = 850;
    mario.style.setProperty('--jump-ms', `${JUMP_MS}ms`);
    let jumpEndsAt = 0;
    let jumpQueued = false;
    let coinTimeout = null;
    let obstacleSpeed = 2.4;
    let coinCount = 0;
    let currentLevel = 1;

    // Quantos pontos cada moeda vale
    const COIN_POINTS = 10;
    // Chance (0 a 1) de uma pedra ter moedas por cima
    const COIN_CHANCE = 0.6;

    // Níveis: a partir de X pontos, a pedra leva Y segundos para cruzar a tela
    // (menos segundos = mais rápido). Ajuste à vontade.
    const LEVELS = [
        { score: 0,     speed: 2.40 }, // nível 1
        { score: 100,   speed: 2.31 }, // nível 2
        { score: 250,   speed: 2.20 }, // nível 3
        { score: 450,   speed: 2.12 }, // nível 4
        { score: 700,   speed: 2.04 }, // nível 5
        { score: 1000,  speed: 1.90 }, // nível 6
        { score: 1350,  speed: 1.82 }, // nível 7
        { score: 1750,  speed: 1.70 }, // nível 8
        { score: 2200,  speed: 1.62 }, // nível 9
        { score: 2700,  speed: 1.55 }, // nível 10
        { score: 3250,  speed: 1.46 }, // nível 11
        { score: 3850,  speed: 1.40 }, // nível 12
        { score: 4500,  speed: 1.32 }, // nível 13
        { score: 5200,  speed: 1.23 }, // nível 14
        { score: 5950,  speed: 1.15 }, // nível 15
        { score: 6750,  speed: 1.04 }, // nível 16
        { score: 7600,  speed: 0.90 }, // nível 17
        { score: 8500,  speed: 0.82 }, // nível 18
        { score: 9450,  speed: 0.70 }, // nível 19
        { score: 10450, speed: 0.60 }, // nível 20
        { score: 11500, speed: 0.47 }, // nível 21
        { score: 12600, speed: 0.35 }, // nível 22
        { score: 13750, speed: 0.25 }, // nível 23
        { score: 14950, speed: 0.15 }, // nível 24
        { score: 16200, speed: 0.08 }  // nível 25 (máximo)
    ];
    let currentCharacterImage = 'assets/marioo.gif';

    const characterImages = {
        mario: 'assets/marioo.gif',
        shadow: 'assets/shadow.gif',
        pikachu: 'assets/pikachu.gif',
        gato: 'assets/gato.gif'
    };

    // Cria a animação dos obstáculos
    const obstacleStyle = document.createElement('style');

    obstacleStyle.textContent = `
        @keyframes mover-obstaculo {
            from { left: 100%; }
            to { left: -100px; }
        }
    `;

    document.head.appendChild(obstacleStyle);

    // ----- HUD extra: moedas e nível (criados por aqui, sem mexer no HTML) -----
    const hudBar = document.querySelector('.hud-bar');

    function criarItemHud(rotulo, valorInicial) {
        const box = document.createElement('div');
        box.className = 'score-info';
        box.innerHTML =
            `<span class="label">${rotulo}</span><span class="value">${valorInicial}</span>`;
        hudBar.appendChild(box);
        return box.querySelector('.value');
    }

    const coinDisplay = criarItemHud('MOEDAS', '0');
    const levelDisplay = criarItemHud('NÍVEL', '1');

    // ----- Sons (gerados pelo navegador, não precisa de arquivo) -----
    let audioCtx = null;

    function tocarTom(freqInicial, freqFinal, duracao, tipo = 'square', volume = 0.08) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const t = audioCtx.currentTime;

            osc.type = tipo;
            osc.frequency.setValueAtTime(freqInicial, t);
            osc.frequency.exponentialRampToValueAtTime(freqFinal, t + duracao);

            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duracao);

            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + duracao);
        } catch (err) {
            // Sem áudio disponível: o jogo segue normalmente
        }
    }

    function somPulo() {
        tocarTom(280, 700, 0.18);
    }

    function somMoeda() {
        tocarTom(988, 988, 0.08, 'square', 0.06);
        setTimeout(() => tocarTom(1319, 1319, 0.18, 'square', 0.06), 80);
    }

    function somNivel() {
        tocarTom(523, 1047, 0.35, 'triangle', 0.12);
    }

    // ----- Níveis -----
    function updateLevel() {
        let nivel = 1;

        for (let i = 0; i < LEVELS.length; i++) {
            if (score >= LEVELS[i].score) nivel = i + 1;
        }

        if (nivel === currentLevel) return;

        currentLevel = nivel;
        obstacleSpeed = LEVELS[nivel - 1].speed; // vale para os próximos obstáculos
        levelDisplay.textContent = nivel;

        mostrarAvisoNivel(nivel);
        somNivel();
    }

    function mostrarAvisoNivel(nivel) {
        const aviso = document.createElement('div');
        aviso.className = 'level-banner';
        aviso.textContent = nivel === LEVELS.length ? 'NÍVEL MÁXIMO!' : `NÍVEL ${nivel}!`;
        gameBoard.appendChild(aviso);
        setTimeout(() => aviso.remove(), 1200);
    }

    // A imagem original será usada como modelo
    if (obstaculoTemplate) {
        obstaculoTemplate.style.display = 'none';
    }

    // Recupera o último nome utilizado
    const savedName = localStorage.getItem('mario_jump_player');

    if (savedName && playerInput) {
        playerInput.value = savedName;
    }

    function startGame() {
        clearInterval(gameLoop);
        clearInterval(scoreLoop);
        clearTimeout(spawnTimeout);
        clearTimeout(coinTimeout);

        resetElements();

        score = 0;
        isPlaying = true;

        scoreDisplay.textContent = '0';
        coinCount = 0;
        coinDisplay.textContent = '0';
        currentLevel = 1;
        levelDisplay.textContent = '1';
        hudPlayerName.textContent = currentPlayer || 'Jogador';

        gameBoard.classList.add('running');

        obstacleSpeed = 2.4;

        // Aumenta a pontuação durante o jogo
        scoreLoop = setInterval(() => {
            if (!isPlaying) return;

            score++;
            scoreDisplay.textContent = score;

            updateLevel();
        }, 100);

        spawnObstacle();
        spawnPassaro();

        // Verifica colisões
        gameLoop = setInterval(checkCollision, 10);
    }
    // Cria uma moeda que anda junto com a pedra (mesma animação e velocidade)
    function criarMoeda(deslocamentoX, altura) {
        const moeda = document.createElement('div');
        moeda.className = 'moeda';
        moeda.style.bottom = `${altura}px`;
        moeda.style.marginLeft = `${deslocamentoX}px`;
        moeda.style.animation =
            `mover-obstaculo ${obstacleSpeed}s linear forwards, girar-moeda 0.6s ease-in-out infinite`;

        gameBoard.appendChild(moeda);
        moedas.push(moeda);

        moeda.addEventListener('animationend', e => {
            if (e.animationName !== 'mover-obstaculo') return;
            moeda.remove();
            moedas = moedas.filter(item => item !== moeda);
        });
    }

    // Em algumas pedras (varia), coloca de 1 a 3 moedas por cima
    function spawnCoinsOnObstacle() {
        if (Math.random() > COIN_CHANCE) return; // nem toda pedra tem moeda

        const quantidade = 1 + Math.floor(Math.random() * 3); // 1, 2 ou 3
        const larguraMoeda = 36;
        const espaco = 14;
        const larguraPedra = 220;

        const larguraGrupo = quantidade * larguraMoeda + (quantidade - 1) * espaco;
        const inicio = (larguraPedra - larguraGrupo) / 2;
        const altura = 130 + Math.random() * 20; // logo acima da pedra

        for (let i = 0; i < quantidade; i++) {
            criarMoeda(inicio + i * (larguraMoeda + espaco), altura);
        }
    }

    // Pássaros voando no céu
    function spawnPassaro() {
        if (!isPlaying || !gameBoard) return;

        const passaro = document.createElement('div');
        passaro.className = 'passaro';
        passaro.innerHTML = `
            <svg viewBox="0 0 50 24">
                <path class="asa" fill="#2b2b2b"
                    d="M2 14 Q14 0 25 12 Q36 0 48 14 Q36 8 25 17 Q14 8 2 14Z"/>
            </svg>`;

        const tamanho = 30 + Math.random() * 30;              // 30 a 60px
        passaro.style.width = `${tamanho}px`;
        passaro.style.height = `${tamanho / 2}px`;
        passaro.style.top = `${20 + Math.random() * 130}px`;  // altura no céu
        passaro.style.animationDuration = `${8 + Math.random() * 6}s`; // velocidade

        gameBoard.appendChild(passaro);

        passaro.addEventListener('animationend', e => {
            if (e.animationName !== 'voar-passaro') return;
            passaro.remove();
        });

        birdTimeout = setTimeout(spawnPassaro, 1500 + Math.random() * 2500);
    }

    function resetElements() {
        clearTimeout(spawnTimeout);
        clearTimeout(coinTimeout);
        clearTimeout(birdTimeout);

        document.querySelectorAll('.obstaculo-clone').forEach(item => item.remove());
        document.querySelectorAll('.moeda').forEach(item => item.remove());
        document.querySelectorAll('.explosao').forEach(item => item.remove());
        document.querySelectorAll('.passaro').forEach(item => item.remove());

        moedas = [];
        obstaculos = [];
        obstacleSpeed = 2.4;
        jumpQueued = false;

        mario.style.visibility = 'visible';

        if (obstaculoTemplate) {
            obstaculoTemplate.style.display = 'none';
            obstaculoTemplate.style.animation = '';
            obstaculoTemplate.style.left = '';
            obstaculoTemplate.style.right = '';
        }

        mario.src = currentCharacterImage;
        mario.style.animation = '';
        mario.style.bottom = '0px';
        mario.style.left = '20px';
        mario.style.transform = '';
        mario.style.removeProperty('--avanco-pulo');
        mario.style.width = '';
        mario.style.marginLeft = '';
        mario.classList.remove('jump');

        if (jumpTip) {
            jumpTip.style.opacity = '1';
        }
    }

    // Cria um obstáculo e programa o próximo
    function spawnObstacle() {
        if (!isPlaying || !obstaculoTemplate || !gameBoard) return;

        const novoObstaculo = obstaculoTemplate.cloneNode(true);

        novoObstaculo.classList.add('obstaculo-clone');
        novoObstaculo.style.display = 'block';
        novoObstaculo.style.position = 'absolute';
        novoObstaculo.style.bottom = '-30px';
        novoObstaculo.style.left = '100%';
        novoObstaculo.style.right = 'auto';
        novoObstaculo.style.width = '220px';
        novoObstaculo.style.height = '110px';
        novoObstaculo.style.objectFit = 'fill';

        novoObstaculo.style.animation =
            `mover-obstaculo ${obstacleSpeed}s linear forwards`;

        novoObstaculo.style.bottom = '-30px';
        novoObstaculo.style.width = '220px';
        novoObstaculo.style.height = '110px';
        novoObstaculo.style.objectFit = 'contain';

        gameBoard.appendChild(novoObstaculo);
        obstaculos.push(novoObstaculo);
        spawnCoinsOnObstacle();

        novoObstaculo.addEventListener('animationend', () => {
            novoObstaculo.remove();

            obstaculos = obstaculos.filter(
                item => item !== novoObstaculo
            );
        }, { once: true });

        // Próximo obstáculo entre 1,3 e 1,9 segundos
        const intervalo = 1300 + Math.random() * 600;

        spawnTimeout = setTimeout(spawnObstacle, intervalo);
    }

    function jump() {
        if (!isPlaying) return;

        if (mario.classList.contains('jump')) {
            if (jumpEndsAt - performance.now() < 250) {
                jumpQueued = true;
            }
            return;
        }   

        const posicaoAtual =
            parseFloat(getComputedStyle(mario).left) || 20;

        const novaPosicao = posicaoAtual;
        const distancia = 0;

        mario.style.left = `${posicaoAtual}px`;
        mario.style.setProperty('--avanco-pulo', `${distancia}px`);

        mario.classList.add('jump');
        somPulo();
        jumpEndsAt = performance.now() + JUMP_MS;

        if (jumpTip) {
            jumpTip.style.opacity = '0';
        }

        setTimeout(() => {
            mario.style.left = `${novaPosicao}px`;
            mario.style.removeProperty('--avanco-pulo');
            mario.classList.remove('jump');

            if (jumpQueued && isPlaying) {
                jumpQueued = false;
                jump();
            }
        }, JUMP_MS);
    }

    function checkCollision() {
        if (!isPlaying) return;

        const marioRect = mario.getBoundingClientRect();
        
        for (const obstaculo of obstaculos) {
            const obstaculoRect = obstaculo.getBoundingClientRect();

            const colidiu =
                obstaculoRect.left + 45 < marioRect.right - 35 &&
                obstaculoRect.right - 45 > marioRect.left + 35 &&
                obstaculoRect.top + 15 < marioRect.bottom - 10 &&
                obstaculoRect.bottom - 10 > marioRect.top + 20;

            if (colidiu) {
                triggerGameOver(obstaculo);
                break;
            }
        }

        if (!isPlaying) return;

            // Coleta de moedas
        for (const moeda of [...moedas]) {
            const r = moeda.getBoundingClientRect();

            const pegou =
                r.left < marioRect.right - 30 &&
                r.right > marioRect.left + 30 &&
                r.top < marioRect.bottom &&
                r.bottom > marioRect.top;

            if (pegou) {
                moeda.remove();
                moedas = moedas.filter(item => item !== moeda);
                score += COIN_POINTS;
                coinCount++;
                coinDisplay.textContent = coinCount;
                somMoeda();
                updateLevel();
                scoreDisplay.textContent = score;
            }
        }
    }

    function showExplosion() {
        const marioRect = mario.getBoundingClientRect();
        const boardRect = gameBoard.getBoundingClientRect();
        const size = 160; // tamanho da explosão em px

        const explosion = document.createElement('img');
        explosion.className = 'explosao';

        // O "?t=" faz o GIF recomeçar do zero a cada Game Over
        explosion.src = `assets/explosao.gif?t=${Date.now()}`;
        explosion.style.width = `${size}px`;
        explosion.style.height = `${size}px`;

        // Centraliza a explosão no personagem
        explosion.style.left =
            `${marioRect.left - boardRect.left - gameBoard.clientLeft
            + marioRect.width / 2 - size / 2}px`;
        explosion.style.top =
            `${marioRect.top - boardRect.top - gameBoard.clientTop
            + marioRect.height / 2 - size / 2}px`;

        gameBoard.appendChild(explosion);

        // Esconde o personagem enquanto explode
        mario.style.visibility = 'hidden';

        // Remove a explosão quando o GIF termina (ajuste ao tempo do seu GIF)
        setTimeout(() => {
            explosion.remove();
            mario.style.visibility = 'visible';
            }, 900);
    }

    function triggerGameOver(obstaculo) {
        if (!isPlaying) return;

        isPlaying = false;

        clearInterval(gameLoop);
        clearInterval(scoreLoop);
        clearTimeout(spawnTimeout);
        clearTimeout(coinTimeout);
        clearTimeout(birdTimeout);
        moedas.forEach(item => {
        item.style.animationPlayState = 'paused';
        });

        gameBoard.classList.remove('running');

        // Para os obstáculos
        obstaculos.forEach(item => {
            item.style.animationPlayState = 'paused';
        });

        // Mantém o obstáculo que atingiu o personagem na tela
        if (obstaculo) {
            const boardRect = gameBoard.getBoundingClientRect();
            const obstaculoRect = obstaculo.getBoundingClientRect();

            obstaculo.style.animation = 'none';
            obstaculo.style.left =
                `${obstaculoRect.left - boardRect.left}px`;
            obstaculo.style.right = 'auto';
        }
        showExplosion();
        // Mostra a imagem de Game Over
        const marioPosition = parseFloat(
            getComputedStyle(mario).bottom
        ) || 0;

        mario.style.animation = 'none';
        mario.style.bottom = `${marioPosition}px`;
        mario.src = 'assets/game-over.png';
        mario.style.width = '75px';
        mario.style.marginLeft = '50px';

        finalScoreValue.textContent = score;
        saveStatusMsg.textContent = 'Salvando pontuação no banco...';
        saveStatusMsg.style.color = '#ffcc00';

        gameoverModal.classList.add('active');

        saveScore(currentPlayer, score);
    }

    function saveScore(playerName, finalScore) {
        fetch('salvar_ranking.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: playerName,
                pontos: finalScore
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                saveStatusMsg.textContent =
                    'Pontuação registrada no banco!';
                saveStatusMsg.style.color = '#10b981';

                if (data.ranking) {
                    renderRanking(data.ranking, playerName, finalScore);
                }
            } else {
                saveStatusMsg.textContent =
                    '⚠️ ' + (data.message || 'Erro ao registrar.');
                saveStatusMsg.style.color = '#ef4444';
            }
        })
        .catch(err => {
            console.error('Erro na requisição:', err);

            saveStatusMsg.textContent =
                '⚠️ Erro ao conectar ao servidor Laragon.';
            saveStatusMsg.style.color = '#ef4444';
        });
    }

    function fetchRanking() {
        fetch('obter_ranking.php')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.ranking) {
                    renderRanking(data.ranking);
                }
            })
            .catch(err => {
                console.error('Erro ao buscar ranking:', err);
            });
    }

    function renderRanking(
        list,
        highlightName = null,
        highlightScore = null
    ) {
        if (!rankingBody) return;

        rankingBody.innerHTML = '';

        if (!list || list.length === 0) {
            rankingBody.innerHTML = `
                <tr>
                    <td colspan="3" class="loading-cell">
                        Nenhuma pontuação gravada ainda. Jogue para ser o 1º!
                    </td>
                </tr>
            `;
            return;
        }

        let highlighted = false;

        list.forEach((item, index) => {
            const tr = document.createElement('tr');

            if (
                !highlighted &&
                highlightName &&
                item.nome === highlightName &&
                parseInt(item.pontos, 10) === highlightScore
            ) {
                tr.classList.add('highlight-current');
                highlighted = true;
            }

            let medal = `${index + 1}º`;

            if (index === 0) medal = '🥇 1º';
            else if (index === 1) medal = '🥈 2º';
            else if (index === 2) medal = '🥉 3º';

            tr.innerHTML = `
                <td class="ranking-pos">${medal}</td>
                <td><strong>${escapeHtml(item.nome)}</strong></td>
                <td>${parseInt(item.pontos, 10)} pts</td>
            `;

            rankingBody.appendChild(tr);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';

        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Iniciar o jogo
    // Iniciar o jogo
    startForm.addEventListener('submit', e => {
        e.preventDefault();

        const nameValue = playerInput.value.trim();

        if (!nameValue) {
            playerInput.focus();
            return;
        }

        currentPlayer = nameValue;
        localStorage.setItem('mario_jump_player', currentPlayer);

        // Captura o personagem selecionado ANTES de iniciar o jogo
        const personagemSelecionado = document.querySelector('input[name="character"]:checked');
        currentCharacterImage = characterImages[personagemSelecionado?.value] || 'assets/marioo.gif';

        startModal.classList.remove('active');
        startGame();
    });

    // Ver ranking
    btnViewRanking.addEventListener('click', () => {
        fetchRanking();

        finalScoreValue.textContent = '---';
        saveStatusMsg.textContent = '';

        startModal.classList.remove('active');
        gameoverModal.classList.add('active');
    });

    // Jogar novamente (Mantém o jogador e o personagem escolhidos)
    btnRestart.addEventListener('click', () => {
        gameoverModal.classList.remove('active');

        if (!currentPlayer) {
            startModal.classList.add('active');
            playerInput.focus();
        } else {
            startGame();
        }
    });

    // Trocar jogador
    btnChangePlayer.addEventListener('click', () => {
        gameoverModal.classList.remove('active');

        resetElements();

        startModal.classList.add('active');
        playerInput.value = currentPlayer; // Mantém o nome anterior no campo para facilitar
        playerInput.focus();
    });

    // Controlo de Pulo - Teclado
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
            if (isPlaying) {
                e.preventDefault();
                jump();
            }
        }
    });

    // Controlo de Pulo - Clique/Toque (Apenas durante a partida e fora de modais)
    gameBoard.addEventListener('click', (e) => {
        if (!isPlaying) return;
        
        // Evita acionar o pulo ao clicar dentro de elementos de modal ou botões
        if (e.target.closest('.modal-card')) return;

        jump();
    });
});