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
    let spawnTimeout = null;
    let obstaculos = [];
    let moedas = [];
    const JUMP_MS = 700;
    let jumpEndsAt = 0;
    let jumpQueued = false;
    let coinTimeout = null;
    let obstacleSpeed = 2.4;

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
        hudPlayerName.textContent = currentPlayer || 'Jogador';

        gameBoard.classList.add('running');

        obstacleSpeed = 2.4;

        // Aumenta a pontuação durante o jogo
        scoreLoop = setInterval(() => {
            if (!isPlaying) return;

            score++;
            scoreDisplay.textContent = score;

            if (score >= 80 && obstacleSpeed > 1.6) {
                obstacleSpeed = 1.6;
            } else if (score >= 40 && obstacleSpeed > 2.0) {
                obstacleSpeed = 2.0;
            }
        }, 100);

        spawnObstacle();
        coinTimeout = setTimeout(spawnCoin, 900);

        // Verifica colisões
        gameLoop = setInterval(checkCollision, 10);
    }
        function spawnCoin() {
            if (!isPlaying || !gameBoard) return;

            const moeda = document.createElement('div');
            moeda.className = 'moeda';

            // Altura que exige pulo (entre 170px e 230px)
            moeda.style.bottom = `${165 + Math.random() * 45}px`;
            moeda.style.animation =
                `mover-obstaculo ${obstacleSpeed}s linear forwards, girar-moeda 0.6s ease-in-out infinite`;

            gameBoard.appendChild(moeda);
            moedas.push(moeda);

            moeda.addEventListener('animationend', e => {
                if (e.animationName !== 'mover-obstaculo') return;
                moeda.remove();
                moedas = moedas.filter(item => item !== moeda);
            });

            coinTimeout = setTimeout(spawnCoin, 2200 + Math.random() * 1800);
        }

    function resetElements() {
        clearTimeout(spawnTimeout);
        clearTimeout(coinTimeout);

        document.querySelectorAll('.obstaculo-clone').forEach(item => item.remove());
        document.querySelectorAll('.moeda').forEach(item => item.remove());
        document.querySelectorAll('.explosao').forEach(item => item.remove());

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
        novoObstaculo.style.width = '250px';
        novoObstaculo.style.height = '140px';
        novoObstaculo.style.objectFit = 'fill';

        novoObstaculo.style.animation =
            `mover-obstaculo ${obstacleSpeed}s linear forwards`;

        novoObstaculo.style.bottom = '-30px';
        novoObstaculo.style.width = '250px';
        novoObstaculo.style.height = '140px';
        novoObstaculo.style.objectFit = 'contain';

        gameBoard.appendChild(novoObstaculo);
        obstaculos.push(novoObstaculo);

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
            // Só guarda o pulo se faltar pouco para pousar
            if (jumpEndsAt - performance.now() < 250) {
                jumpQueued = true;
            }
            return;
        }

        mario.classList.add('jump');
        jumpEndsAt = performance.now() + JUMP_MS;

        if (jumpTip) {
            jumpTip.style.opacity = '0';
        }

        setTimeout(() => {
            mario.classList.remove('jump');

            if (jumpQueued && isPlaying) {
                jumpQueued = false;
                void mario.offsetWidth; // reinicia a animação
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
                obstaculoRect.left < marioRect.right - 50 &&
                obstaculoRect.right > marioRect.left + 50 &&
                obstaculoRect.top < marioRect.bottom - 10 &&
                obstaculoRect.bottom > marioRect.top + 10;

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
                score += 10;
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
    startForm.addEventListener('submit', e => {
        e.preventDefault();

        const nameValue = playerInput.value.trim();

        if (!nameValue) {
            playerInput.focus();
            return;
        }

        currentPlayer = nameValue;

        localStorage.setItem('mario_jump_player', currentPlayer);

        const personagemSelecionado = document.querySelector(
            'input[name="character"]:checked'
        );

        currentCharacterImage =
        characterImages[personagemSelecionado?.value] || 'assets/marioo.gif';
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

    // Jogar novamente
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
        playerInput.value = '';
        playerInput.focus();
    });

    // Pular usando Espaço ou seta para cima
    document.addEventListener('keydown', e => {
        if (
            e.code === 'Space' ||
            e.key === ' ' ||
            e.code === 'ArrowUp'
        ) {
            if (isPlaying) {
                e.preventDefault();
                jump();
            }
        }
    });
    gameBoard.addEventListener('pointerdown', jump);
});