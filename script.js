/**
 * Lógica principal del juego "Lucha contra Don Mate".
 * Se encapsula todo en un objeto 'Game' para evitar contaminar el scope global.
 * El juego se inicia cuando el DOM está completamente cargado.
 */
document.addEventListener('DOMContentLoaded', () => {

  // Función de ayuda para crear pausas
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // =========================================================================
  // === DEFINICIÓN DE PREGUNTAS Y DATOS DEL JUEGO =========================
  // =========================================================================
  const gameQuestions = [
    { "question": "¿Cuánto es 7 + 5?", "answer": 12, "options": [10, 12, 15, 11] },
    { "question": "¿Cuál es el resultado de 10 + 3?", "answer": 13, "options": [11, 12, 13, 14] },
    { "question": "Si tienes 4 + 3 manzanas, ¿cuántas tienes?", "answer": 7, "options": [5, 6, 7, 8] },
    { "question": "Suma: 8 + 6", "answer": 14, "options": [12, 13, 14, 15] },
    { "question": "¿Cuánto es 9 + 9?", "answer": 18, "options": [16, 17, 18, 19] },
    { "question": "Calcula: 15 + 5", "answer": 20, "options": [18, 19, 20, 21] },
    { "question": "Si tienes 12 y te dan 4 más, ¿cuánto tienes?", "answer": 16, "options": [14, 15, 16, 17] },
    { "question": "Resultado de 11 + 7", "answer": 18, "options": [17, 18, 19, 20] },
    { "question": "Suma los números 13 y 6", "answer": 19, "options": [18, 19, 20, 21] },
    { "question": "¿Cuánto es 20 + 10?", "answer": 30, "options": [25, 28, 30, 32] },
    { "question": "1 + 1", "answer": 2, "options": [1, 2, 3, 4] },
    { "question": "5 + 2", "answer": 7, "options": [6, 7, 8, 9] },
    { "question": "4 + 4", "answer": 8, "options": [6, 7, 8, 9] },
    { "question": "10 + 10", "answer": 20, "options": [18, 19, 20, 21] },
    { "question": "15 + 15", "answer": 30, "options": [25, 28, 30, 35] }
  ];

  // NUEVO: Array con consejos matemáticos para la pantalla de pausa
  const mathTips = [
    "¿Sabías que cualquier número multiplicado por 9, si sumas sus dígitos, el resultado es 9? (Ej: 9x7=63 -> 6+3=9)",
    "El número PI (π) es infinito y nunca repite un patrón. ¡Es un número irracional!",
    "Un 'Gúgol' (Googol) es un 1 seguido de 100 ceros. ¡Es un número increíblemente grande!",
    "La secuencia de Fibonacci (1, 1, 2, 3, 5, 8...) aparece a menudo en la naturaleza, como en los pétalos de las flores.",
    "El cero fue inventado en la India y es fundamental para el sistema numérico que usamos hoy.",
    "Multiplicar por 11 es fácil: para 25x11, separa el 2 y 5, y en medio pon su suma (2+5=7). ¡El resultado es 275!"
  ];
  // =========================================================================

  const Game = {
    config: {
      maxHp: 100,
      timeLimits: { facil: 30, medio: 15, dificil: 10, hardcore: 6 },
      damageValues: { playerAttack: 25, enemyWrongAnswer: 20, enemyTimeout: 15 },
      pointsValues: { baseCorrect: 10, penaltyWrongAnswer: 5, penaltyTimeout: 10 },
      trashTalkFrequency: 2,
      villainTaunts: ["¡Casi!", "¡Más rápido!", "¡Mis problemas son difíciles!", "¡Sigue intentando!", "¿Calculadora? Jeje", "¡Uy, esa no era!"]
    },

    state: {
      playerHp: 0,
      bossHp: 0,
      score: 0,
      failureCounter: 0,
      timeLeft: 0,
      gameTimeLimit: 0,
      currentCorrectAnswer: null,
      currentQuestionOptions: [],
      gameActive: false,
      isPaused: false, // NUEVO: Estado para controlar la pausa
      timer: null,
      speechBubbleTimeout: null,
      questions: [],
      currentQuestionIndex: 0,
      correctAnswersCount: 0,
      incorrectAnswersCount: 0,
      gameStartTime: null,
      gameEndTime: null
    },

    elements: {},

    init() {
      this.cacheDOMElements();
      this.bindEvents();
      this.createStars(200);
    },

    cacheDOMElements() {
      this.elements = {
        menuContainer: document.getElementById('menu-container'),
        gameContainer: document.getElementById('game-container'),
        startGameBtn: document.getElementById('startGameBtn'),
        // NUEVO: Elementos para la pausa
        pauseBtn: document.getElementById('pauseBtn'),
        pauseOverlay: document.getElementById('pause-overlay'),
        mathTip: document.getElementById('math-tip'),
        // ---
        attackFlash: document.getElementById('attackFlash'),
        scoreDisplay: document.getElementById('scoreDisplay'),
        playerLifeBar: document.getElementById('playerLifeBar'),
        bossLifeBar: document.getElementById('bossLifeBar'),
        playerHpText: document.getElementById('playerHpText'),
        bossHpText: document.getElementById('bossHpText'),
        question: document.getElementById('question'),
        timer: document.getElementById('timer'),
        feedback: document.getElementById('feedback'),
        answerOptions: document.getElementById('answerOptions'),
        finalMessage: document.getElementById('finalMessage'),
        playerCharacter: document.getElementById('playerCharacter'),
        enemyCharacter: document.getElementById('enemyCharacter'),
        villainSpeechBubble: document.getElementById('villainSpeechBubble'),
        countdownOverlay: document.getElementById('countdown-overlay'),
        countdownText: document.getElementById('countdown-text'),
        gameUi: document.querySelector('.game-ui'),
        gameHeader: document.getElementById('game-header')
      };
    },

    bindEvents() {
      this.elements.startGameBtn.addEventListener('click', () => this.startGame());
      // NUEVO: Evento para el botón de pausa
      this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    },

    async startGame() {
      const selectedDifficulty = 'medio';
      
      this.state.gameTimeLimit = this.config.timeLimits[selectedDifficulty];
      this.state.playerHp = this.config.maxHp;
      this.state.bossHp = this.config.maxHp;
      this.state.score = 0;
      this.state.failureCounter = 0;
      this.state.correctAnswersCount = 0;
      this.state.incorrectAnswersCount = 0;
      this.state.gameStartTime = null;
      this.state.gameEndTime = null;
      this.state.isPaused = false; // NUEVO: Asegurarse que el juego no inicie en pausa

      this.state.gameActive = false;
      this.elements.finalMessage.style.display = 'none';
      this.elements.pauseOverlay.classList.add('hidden'); // NUEVO: Ocultar overlay de pausa
      this.elements.pauseBtn.textContent = '⏸'; // NUEVO: Resetear ícono del botón

      this.state.questions = [...gameQuestions].sort(() => Math.random() - 0.5);
      this.state.currentQuestionIndex = 0;

      this.elements.menuContainer.classList.add('hidden');
      this.elements.gameContainer.classList.remove('hidden');

      this.updateUI();
      
      await this.runCountdown();

      this.state.gameStartTime = Date.now(); 
      this.state.gameActive = true;
      this.elements.pauseBtn.classList.remove('hidden'); // NUEVO: Mostrar el botón de pausa
      this.newQuestion();
    },

    // NUEVO: Función para volver al menú principal
    goHome() {
        this.elements.gameContainer.classList.add('hidden');
        this.elements.finalMessage.style.display = 'none';
        this.elements.menuContainer.classList.remove('hidden');
    },

    // NUEVO: Función para pausar y reanudar el juego
    togglePause() {
        if (!this.state.gameActive && !this.state.isPaused) return;

        this.state.isPaused = !this.state.isPaused;

        if (this.state.isPaused) {
            clearInterval(this.state.timer);
            this.elements.pauseOverlay.classList.remove('hidden');
            this.elements.mathTip.textContent = mathTips[Math.floor(Math.random() * mathTips.length)];
            this.elements.pauseBtn.textContent = '▶️';
        } else {
            this.elements.pauseOverlay.classList.add('hidden');
            this.elements.pauseBtn.textContent = '⏸';
            this.resumeTimer();
        }
    },

    async runCountdown() {
      const { countdownOverlay, countdownText, gameUi, gameHeader, playerCharacter, enemyCharacter } = this.elements;
      const allCharacterInfo = document.querySelectorAll('.character-info');
      const elementsToToggle = [gameUi, gameHeader, playerCharacter, enemyCharacter, ...allCharacterInfo];
      elementsToToggle.forEach(el => el.style.visibility = 'hidden');

      countdownOverlay.classList.remove('hidden');
      for (let i = 3; i > 0; i--) {
        countdownText.textContent = i;
        await sleep(1500);
      }
      countdownText.textContent = '¡A pelear!';
      await sleep(1000);
      countdownOverlay.classList.add('hidden');
      elementsToToggle.forEach(el => el.style.visibility = 'visible');
    },

    newQuestion() {
      if (!this.state.gameActive || this.state.isPaused) return;
      this.generateQuestionData();
      this.renderNewQuestion();
      this.updateUI();
      this.startTimer();
    },

    generateQuestionData() {
      if (this.state.currentQuestionIndex >= this.state.questions.length) {
        this.state.questions.sort(() => Math.random() - 0.5);
        this.state.currentQuestionIndex = 0;
      }
      const questionData = this.state.questions[this.state.currentQuestionIndex++];
      this.elements.question.textContent = questionData.question;
      this.state.currentCorrectAnswer = questionData.answer;
      this.state.currentQuestionOptions = questionData.options;
    },
    
    handleAnswer(selectedAnswer) {
      if (!this.state.gameActive || this.state.isPaused) return;

      this.state.gameActive = false;
      clearInterval(this.state.timer);

      if (selectedAnswer === this.state.currentCorrectAnswer) {
        this.handleCorrectAnswer();
      } else {
        this.handleIncorrectAnswer();
      }
      this.updateUI();
      this.checkGameStatus();
    },

    handleCorrectAnswer() {
      const pointsEarned = this.config.pointsValues.baseCorrect + this.state.timeLeft;
      this.state.score += pointsEarned;
      this.state.bossHp = Math.max(0, this.state.bossHp - this.config.damageValues.playerAttack);
      this.state.correctAnswersCount++;
      this.elements.feedback.textContent = `¡IMPACTO CRÍTICO! +${pointsEarned} puntos`;
      this.elements.feedback.className = 'feedback correct';
      this.triggerEffect('attack');
    },

    handleIncorrectAnswer() {
      this.state.score = Math.max(0, this.state.score - this.config.pointsValues.penaltyWrongAnswer);
      this.state.playerHp = Math.max(0, this.state.playerHp - this.config.damageValues.enemyWrongAnswer);
      this.state.incorrectAnswersCount++;
      this.elements.feedback.textContent = `¡FALLO! -${this.config.pointsValues.penaltyWrongAnswer} puntos`;
      this.elements.feedback.className = 'feedback incorrect';
      this.handleFailure();
      this.triggerEffect('playerHit');
    },
    
    handleTimeout() {
      if (this.state.isPaused) return;
      clearInterval(this.state.timer);
      if (!this.state.gameActive) return;
      this.state.gameActive = false;

      this.state.score = Math.max(0, this.state.score - this.config.pointsValues.penaltyTimeout);
      this.state.playerHp = Math.max(0, this.state.playerHp - this.config.damageValues.enemyTimeout);
      this.state.incorrectAnswersCount++;
      this.elements.feedback.textContent = `¡TIEMPO AGOTADO! -${this.config.pointsValues.penaltyTimeout} puntos`;
      this.elements.feedback.className = 'feedback incorrect';
      this.handleFailure();
      this.triggerEffect('playerHit');
      this.updateUI();
      this.checkGameStatus();
    },

    handleFailure() {
      this.state.failureCounter++;
      if (this.state.failureCounter % this.config.trashTalkFrequency === 0) {
        this.showVillainTaunt();
      }
    },

    checkGameStatus() {
      if (this.state.bossHp <= 0 || this.state.playerHp <= 0) {
        setTimeout(() => this.endGame(), 500);
      } else {
        setTimeout(() => {
          this.state.gameActive = true;
          this.newQuestion();
        }, 1200);
      }
    },
    
    endGame() {
      this.state.gameActive = false;
      clearInterval(this.state.timer);
      this.state.gameEndTime = Date.now();
      this.elements.pauseBtn.classList.add('hidden'); // NUEVO: Ocultar botón de pausa
      this.displayFinalMessage();
      this.logGameStats();
    },

    startTimer() {
      clearInterval(this.state.timer);
      this.state.timeLeft = this.state.gameTimeLimit;
      this.updateUI();
      this.state.timer = setInterval(() => {
        if (this.state.isPaused) return;
        this.state.timeLeft--;
        this.updateUI();
        if (this.state.timeLeft < 0) {
          this.handleTimeout();
        }
      }, 1000);
    },

    // NUEVO: Función para reanudar el temporizador sin reiniciarlo
    resumeTimer() {
        this.state.timer = setInterval(() => {
            if (this.state.isPaused) return;
            this.state.timeLeft--;
            this.updateUI();
            if (this.state.timeLeft < 0) {
                this.handleTimeout();
            }
        }, 1000);
    },

    updateUI() {
      this.elements.playerLifeBar.style.width = `${(this.state.playerHp / this.config.maxHp) * 100}%`;
      this.elements.bossLifeBar.style.width = `${(this.state.bossHp / this.config.maxHp) * 100}%`;
      this.elements.playerHpText.textContent = `${this.state.playerHp} / ${this.config.maxHp}`;
      this.elements.bossHpText.textContent = `${this.state.bossHp} / ${this.config.maxHp}`;
      this.elements.scoreDisplay.textContent = `Puntaje: ${this.state.score}`;
      this.elements.timer.textContent = `Tiempo: ${Math.max(0, this.state.timeLeft)}s`;
      this.elements.timer.classList.toggle('blink-warning', this.state.timeLeft <= 5 && this.state.gameActive && !this.state.isPaused);
    },

    renderNewQuestion() {
      this.elements.feedback.textContent = ""; 
      const options = [...this.state.currentQuestionOptions].sort(() => Math.random() - 0.5);
      this.elements.answerOptions.innerHTML = '';
      options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.onclick = () => this.handleAnswer(option);
        this.elements.answerOptions.appendChild(button);
      });
    },

    // MODIFICADO: Muestra el mensaje final con los botones de acción
    displayFinalMessage() {
      const playerWon = this.state.bossHp <= 0;
      this.elements.finalMessage.style.display = 'flex';
      this.elements.finalMessage.innerHTML = `
        <div class="result-text">
          ${playerWon ? '¡VICTORIA!' : '¡DERROTA!'}
          
        </div>
        <small>Puntaje Final: ${this.state.score}</small>
        <div class="end-game-buttons">
          <button class="end-game-btn" onclick="Game.startGame()">Reiniciar</button>
          <button class="end-game-btn" onclick="Game.goHome()">Volver al Inicio</button>
        </div>
      `;
      this.elements.finalMessage.className = `final-message ${playerWon ? 'win' : 'lose'}`;
    },

    logGameStats() {
      let totalDurationSeconds = 0;
      if (this.state.gameStartTime && this.state.gameEndTime) {
        totalDurationSeconds = ((this.state.gameEndTime - this.state.gameStartTime) / 1000).toFixed(2);
      }
      const gameStats = {
        puntajeObtenido: this.state.score,
        preguntasFalladas: this.state.incorrectAnswersCount,
        preguntasAcertadas: this.state.correctAnswersCount,
        tiempoTotalDeJuegoSegundos: totalDurationSeconds
      };
      console.log("=== Estadísticas Finales del Juego ===", JSON.stringify(gameStats, null, 2));
    },

    showVillainTaunt() {
      clearTimeout(this.state.speechBubbleTimeout);
      const taunt = this.config.villainTaunts[Math.floor(Math.random() * this.config.villainTaunts.length)];
      this.elements.villainSpeechBubble.textContent = taunt;
      this.elements.villainSpeechBubble.classList.add('visible');
      this.state.speechBubbleTimeout = setTimeout(() => {
        this.elements.villainSpeechBubble.classList.remove('visible');
      }, 3500);
    },

    triggerEffect(effectType) {
        if (effectType === 'attack') {
            this.elements.enemyCharacter.classList.add('shake', 'hit-effect');
            this.elements.attackFlash.classList.add('active');
            setTimeout(() => {
                this.elements.enemyCharacter.classList.remove('shake', 'hit-effect');
                this.elements.attackFlash.classList.remove('active');
            }, 500);
        } else if (effectType === 'playerHit') {
            this.elements.playerCharacter.classList.add('shake');
            setTimeout(() => this.elements.playerCharacter.classList.remove('shake'), 500);
        }
    },

    createStars(count) {
      const container = document.getElementById('stars-container');
      for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.top = `${Math.random() * -100}vh`; 
        star.style.left = `${Math.random() * 100}vw`;
        const duration = Math.random() * 5 + 3;
        const delay = Math.random() * 5;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${delay}s`;
        container.appendChild(star);
      }
    }
  };

  // NUEVO: Hacer el objeto Game accesible globalmente para que los botones onclick() funcionen
  window.Game = Game; 
  Game.init();
});