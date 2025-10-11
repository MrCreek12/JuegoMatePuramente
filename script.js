/**
 * Lógica principal del juego "Lucha contra Don Mate".
 * Se encapsula todo en un objeto 'Game' para evitar contaminar el scope global.
 * El juego se inicia cuando el DOM está completamente cargado.
 */
document.addEventListener('DOMContentLoaded', () => {

  // Función de ayuda para crear pausas
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Función para extraer user_id de la URL
  const getUserId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    return userId ? userId : null;
  };

  const currentUserId = getUserId();

  const showDataSendingIndicator = () => {
    document.getElementById('data-sending-overlay')?.classList.remove('hidden');
  };

  const hideDataSendingIndicator = () => {
    document.getElementById('data-sending-overlay')?.classList.add('hidden');
  };

  const updateLoadingText = (text) => {
    document.getElementById('loading-text').textContent = text;
  };
  
  let gameQuestions = [];

  const mathTips = [
    "¿Sabías que cualquier número multiplicado por 9, si sumas sus dígitos, el resultado es 9? (Ej: 9x7=63 -> 6+3=9)",
    "El número PI (π) es infinito y nunca repite un patrón. ¡Es un número irracional!",
    "Un 'Gúgol' (Googol) es un 1 seguido de 100 ceros. ¡Es un número increíblemente grande!",
    "La secuencia de Fibonacci (1, 1, 2, 3, 5, 8...) aparece a menudo en la naturaleza, como en los pétalos de las flores.",
    "El cero fue inventado en la India y es fundamental para el sistema numérico que usamos hoy.",
    "Multiplicar por 11 es fácil: para 25x11, separa el 2 y 5, y en medio pon su suma (2+5=7). ¡El resultado es 275!"
  ];

  async function loadQuestionsFromAPI() {
    try {
      showDataSendingIndicator();
      updateLoadingText('Cargando preguntas...');
      const response = await fetch('https://puramentebackend.onrender.com/api/gamedata/game/1/category/matematicas');
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      if (data?.success && data.data?.[0]?.gamedata?.Sumas?.length > 0) {
        gameQuestions = data.data[0].gamedata.Sumas;
      } else {
        throw new Error('No se encontraron preguntas de Sumas en gamedata o formato de respuesta inesperado.');
      }
    } catch (error) {
      console.error('❌ Error cargando preguntas desde la API:', error.message);
      updateLoadingText('Error: No se pudieron cargar las preguntas');
      throw new Error(`No se pudieron cargar las preguntas: ${error.message}`);
    } finally {
      setTimeout(() => hideDataSendingIndicator(), 2000);
    }
  }

  const Game = {
    config: {
      maxHp: 100,
      timeLimits: { facil: 30, medio: 15, dificil: 10, hardcore: 6 },
      damageValues: { playerAttack: 25, enemyWrongAnswer: 20, enemyTimeout: 15 },
      pointsValues: { baseCorrect: 10, baseIncorrect: 0, rapidBonus: 2, streakBonus: 5, completionBonus: 10 },
      trashTalkFrequency: 2,
      villainTaunts: ["¡Casi!", "¡Más rápido!", "¡Mis problemas son difíciles!", "¡Sigue intentando!", "¿Calculadora? Jeje", "¡Uy, esa no era!"],
      audio: {
        volumes: { bgm: 0.2, sfx: 0.8, win: 0.6, lose: 0.6, timerWarning: 0.8, countdown: 0.7 },
        timerWarningThreshold: 5
      }
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
      isPaused: false,
      timer: null,
      speechBubbleTimeout: null,
      questions: [],
      currentQuestionIndex: 0,
      correctAnswersCount: 0,
      incorrectAnswersCount: 0,
      totalQuestionsPresented: 0,
      gameStartTime: null,
      gameEndTime: null,
      consecutiveCorrectAnswers: 0,
      answerStartTime: null,
      gameCompleted: false,
      lastTimerWarningSoundTime: null
    },

    elements: {},

    sound: {
      sfxList: [], // Array para guardar todos los efectos de sonido
      init(elements, config) {
        this.bgMusic = elements.bgMusic;
        // Agrupar todos los SFX en una lista para manejarlos fácilmente
        this.sfxList = [
            elements.sfxCorrect, elements.sfxIncorrect, elements.sfxPlayerAttack,
            elements.sfxEnemyHit, elements.sfxPlayerHit, elements.sfxWin, elements.sfxLose,
            elements.sfxButton, elements.sfxCountdown, elements.sfxTimerWarning
        ];
        
        // Asignar volúmenes iniciales
        this.setBgmVolume(config.audio.volumes.bgm);
        this.setSfxVolume(config.audio.volumes.sfx, false); // No reproducir sonido de prueba al inicio

        // Asignar volúmenes específicos a ciertos SFX si es necesario
        elements.sfxWin.volume = config.audio.volumes.win;
        elements.sfxLose.volume = config.audio.volumes.lose;
        elements.sfxCountdown.volume = config.audio.volumes.countdown;
        elements.sfxTimerWarning.volume = config.audio.volumes.timerWarning;
      },
      playBGM() { this.bgMusic?.play().catch(e => console.log("Error BGM:", e)); },
      pauseBGM() { this.bgMusic?.pause(); },
      stopBGM() { if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic.currentTime = 0; } },
      playSFX(sfxElement) {
        if (sfxElement) {
          sfxElement.currentTime = 0;
          sfxElement.play().catch(e => console.log("Error SFX:", e));
        }
      },
      playSFXGroup(...sfxElements) { sfxElements.forEach(sfx => this.playSFX(sfx)); },
      setBgmVolume(volume) { if (this.bgMusic) this.bgMusic.volume = volume; },
      setSfxVolume(volume, playTestSound = true) {
        this.sfxList.forEach(sfx => { if (sfx) sfx.volume = volume; });
        if (playTestSound) this.playSFX(this.sfxList[7]); // sfxButton es el 8vo en la lista
      }
    },

    init() {
      this.cacheDOMElements();
      this.sound.init(this.elements, this.config);
      this.bindEvents();
      this.createStars(200);
    },

    cacheDOMElements() {
      this.elements = {
        menuContainer: document.getElementById('menu-container'),
        gameContainer: document.getElementById('game-container'),
        startGameBtn: document.getElementById('startGameBtn'),
        pauseBtn: document.getElementById('pauseBtn'),
        pauseOverlay: document.getElementById('pause-overlay'),
        mathTip: document.getElementById('math-tip'),
        resumeBtn: document.getElementById('resumeBtn'), // NUEVO
        homeBtn: document.getElementById('homeBtn'),     // NUEVO
        musicVolumeSlider: document.getElementById('musicVolume'), // NUEVO
        sfxVolumeSlider: document.getElementById('sfxVolume'),     // NUEVO
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
        gameHeader: document.getElementById('game-header'),
        dataSendingOverlay: document.getElementById('data-sending-overlay'),
        loadingText: document.getElementById('loading-text'),
        // Audio elements
        bgMusic: document.getElementById('bgMusic'),
        sfxCorrect: document.getElementById('sfxCorrect'),
        sfxIncorrect: document.getElementById('sfxIncorrect'),
        sfxPlayerAttack: document.getElementById('sfxPlayerAttack'),
        sfxEnemyHit: document.getElementById('sfxEnemyHit'),
        sfxPlayerHit: document.getElementById('sfxPlayerHit'),
        sfxWin: document.getElementById('sfxWin'),
        sfxLose: document.getElementById('sfxLose'),
        sfxButton: document.getElementById('sfxButton'),
        sfxCountdown: document.getElementById('sfxCountdown'),
        sfxTimerWarning: document.getElementById('sfxTimerWarning'),
      };
    },

    bindEvents() {
      this.elements.startGameBtn.addEventListener('click', () => {
        this.sound.playSFX(this.sound.sfxList[7]); // sfxButton
        this.startGame();
      });
      // Eventos para pausar, reanudar y volver al inicio
      this.elements.pauseBtn.addEventListener('click', () => {
        this.sound.playSFX(this.sound.sfxList[7]);
        this.togglePause();
      });
      this.elements.resumeBtn.addEventListener('click', () => {
        this.sound.playSFX(this.sound.sfxList[7]);
        this.togglePause();
      });
      this.elements.homeBtn.addEventListener('click', () => {
        this.goHome();
      });
      // Eventos para los sliders de volumen
      this.elements.musicVolumeSlider.addEventListener('input', (e) => this.sound.setBgmVolume(e.target.value));
      this.elements.sfxVolumeSlider.addEventListener('input', (e) => this.sound.setSfxVolume(e.target.value));
      // Sonido para botones de respuesta
      this.elements.answerOptions.addEventListener('click', (event) => {
        if (event.target.classList.contains('answer-btn')) {
          this.sound.playSFX(this.sound.sfxList[7]);
        }
      });
    },

    async startGame() {
      const selectedDifficulty = 'medio';
      try {
        await loadQuestionsFromAPI();
        if (!gameQuestions || gameQuestions.length === 0) throw new Error('No hay preguntas válidas.');
      } catch (error) {
        alert(`Error al iniciar el juego: ${error.message}`);
        return;
      }
      
      this.state.gameTimeLimit = this.config.timeLimits[selectedDifficulty];
      this.state = {
          ...this.state, // Mantener estado de volumen
          playerHp: this.config.maxHp, bossHp: this.config.maxHp, score: 0,
          failureCounter: 0, correctAnswersCount: 0, incorrectAnswersCount: 0,
          totalQuestionsPresented: 0, gameStartTime: null, gameEndTime: null,
          isPaused: false, consecutiveCorrectAnswers: 0, answerStartTime: null,
          gameCompleted: false, lastTimerWarningSoundTime: null, gameActive: false
      };
      
      this.elements.finalMessage.style.display = 'none';
      this.elements.pauseOverlay.classList.add('hidden');
      this.elements.pauseBtn.textContent = '⏸';
      this.state.questions = [...gameQuestions].sort(() => Math.random() - 0.5);
      this.state.currentQuestionIndex = 0;
      this.elements.menuContainer.classList.add('hidden');
      this.elements.gameContainer.classList.remove('hidden');
      this.updateUI();
      this.sound.playBGM();

      await this.runCountdown();

      this.state.gameStartTime = Date.now();
      this.state.gameActive = true;
      this.elements.pauseBtn.classList.remove('hidden');
      this.newQuestion();
    },

    goHome() {
        this.sound.playSFX(this.sound.sfxList[7]); // sfxButton
        this.sound.stopBGM();
        this.state.gameActive = false;
        clearInterval(this.state.timer);
        this.elements.gameContainer.classList.add('hidden');
        this.elements.finalMessage.style.display = 'none';
        this.elements.pauseOverlay.classList.add('hidden');
        this.elements.menuContainer.classList.remove('hidden');
    },

    togglePause() {
        if (!this.state.gameActive && this.state.isPaused === false) return;

        this.state.isPaused = !this.state.isPaused;

        if (this.state.isPaused) {
            clearInterval(this.state.timer);
            this.sound.pauseBGM();
            this.elements.pauseOverlay.classList.remove('hidden');
            this.elements.mathTip.textContent = mathTips[Math.floor(Math.random() * mathTips.length)];
            // Sincronizar sliders con volumen actual
            this.elements.musicVolumeSlider.value = this.sound.bgMusic.volume;
            this.elements.sfxVolumeSlider.value = this.sound.sfxList[0].volume; // Usar cualquier SFX como referencia
        } else {
            this.elements.pauseOverlay.classList.add('hidden');
            this.sound.playBGM();
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
        this.sound.playSFX(this.elements.sfxCountdown);
        await sleep(1200);
      }
      countdownText.textContent = '¡A pelear!';
      this.sound.playSFX(this.elements.sfxCountdown);
      await sleep(1200);
      countdownOverlay.classList.add('hidden');
      elementsToToggle.forEach(el => el.style.visibility = 'visible');
    },

    newQuestion() {
      if (!this.state.gameActive || this.state.isPaused) return;
      if (this.state.currentQuestionIndex >= this.state.questions.length) {
        this.state.questions.sort(() => Math.random() - 0.5);
        this.state.currentQuestionIndex = 0;
      }
      const questionData = this.state.questions[this.state.currentQuestionIndex++];
      this.elements.question.textContent = questionData.question;
      this.state.currentCorrectAnswer = questionData.answer;
      this.state.currentQuestionOptions = questionData.options;

      this.renderNewQuestion();
      this.updateUI();
      this.startTimer();
      this.state.totalQuestionsPresented++;
      this.state.answerStartTime = Date.now();
    },
    
    handleAnswer(selectedAnswer) {
      if (!this.state.gameActive || this.state.isPaused) return;

      this.state.gameActive = false;
      clearInterval(this.state.timer);
      this.state.lastTimerWarningSoundTime = null;

      if (selectedAnswer === this.state.currentCorrectAnswer) {
        this.sound.playSFX(this.elements.sfxCorrect);
        this.handleCorrectAnswer();
      } else {
        this.sound.playSFX(this.elements.sfxIncorrect);
        this.handleIncorrectAnswer();
      }
      this.updateUI();
      this.checkGameStatus();
    },

    handleCorrectAnswer() {
      const responseTime = (Date.now() - this.state.answerStartTime) / 1000;
      let pointsEarned = this.config.pointsValues.baseCorrect;
      let bonusMessages = [];
      
      if (responseTime < 2) {
        pointsEarned += this.config.pointsValues.rapidBonus;
        bonusMessages.push(`¡RAPIDEZ! +${this.config.pointsValues.rapidBonus}`);
      }
      
      this.state.consecutiveCorrectAnswers++;
      
      if (this.state.consecutiveCorrectAnswers > 0 && this.state.consecutiveCorrectAnswers % 3 === 0) {
        pointsEarned += this.config.pointsValues.streakBonus;
        bonusMessages.push(`¡RACHA x3! +${this.config.pointsValues.streakBonus}`);
      }
      
      this.state.score += pointsEarned;
      this.state.bossHp = Math.max(0, this.state.bossHp - this.config.damageValues.playerAttack);
      this.state.correctAnswersCount++;
      
      let feedbackText = `¡IMPACTO CRÍTICO! +${this.config.pointsValues.baseCorrect} puntos`;
      if (bonusMessages.length > 0) feedbackText += ` (${bonusMessages.join(', ')})`;
      
      this.elements.feedback.textContent = feedbackText;
      this.elements.feedback.className = 'feedback correct';
      this.triggerEffect('attack');
    },

    handleIncorrectAnswer() {
      this.state.consecutiveCorrectAnswers = 0;
      this.state.playerHp = Math.max(0, this.state.playerHp - this.config.damageValues.enemyWrongAnswer);
      this.state.incorrectAnswersCount++;
      this.elements.feedback.textContent = `¡FALLO! +0 puntos`;
      this.elements.feedback.className = 'feedback incorrect';
      this.handleFailure();
      this.triggerEffect('playerHit');
    },
    
    handleTimeout() {
      if (this.state.isPaused || !this.state.gameActive) return;
      clearInterval(this.state.timer);
      this.state.gameActive = false;
      this.state.lastTimerWarningSoundTime = null;
      this.state.consecutiveCorrectAnswers = 0;
      this.state.playerHp = Math.max(0, this.state.playerHp - this.config.damageValues.enemyTimeout);
      this.state.incorrectAnswersCount++;
      this.elements.feedback.textContent = `¡TIEMPO AGOTADO! +0 puntos`;
      this.elements.feedback.className = 'feedback incorrect';
      this.handleFailure();
      this.triggerEffect('playerHit');
      this.updateUI();
      this.checkGameStatus();
    },

    handleFailure() {
      this.state.failureCounter++;
      if (this.state.failureCounter % this.config.trashTalkFrequency === 0) this.showVillainTaunt();
    },

    checkGameStatus() {
      if (this.state.bossHp <= 0) {
        this.state.gameCompleted = true;
        setTimeout(() => this.endGame(), 500);
      } else if (this.state.playerHp <= 0) {
        this.state.gameCompleted = false;
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
      this.elements.pauseBtn.classList.add('hidden');
      this.sound.stopBGM();
      
      if (this.state.gameCompleted) this.state.score += this.config.pointsValues.completionBonus;
      
      this.displayFinalMessage();
      this.logGameStats();

      if (this.state.bossHp <= 0) this.sound.playSFX(this.elements.sfxWin);
      else this.sound.playSFX(this.elements.sfxLose);
    },

    startTimer() {
      clearInterval(this.state.timer);
      this.state.timeLeft = this.state.gameTimeLimit;
      this.updateUI();
      this.state.timer = setInterval(() => {
        if (this.state.isPaused) return;
        this.state.timeLeft--;
        this.updateUI();
        if (this.state.timeLeft < 0) this.handleTimeout();
      }, 1000);
    },

    resumeTimer() {
      this.state.timer = setInterval(() => {
        if (this.state.isPaused) return;
        this.state.timeLeft--;
        this.updateUI();
        if (this.state.timeLeft < 0) this.handleTimeout();
      }, 1000);
    },

    updateUI() {
      this.elements.playerLifeBar.style.width = `${(this.state.playerHp / this.config.maxHp) * 100}%`;
      this.elements.bossLifeBar.style.width = `${(this.state.bossHp / this.config.maxHp) * 100}%`;
      this.elements.playerHpText.textContent = `${this.state.playerHp} / ${this.config.maxHp}`;
      this.elements.bossHpText.textContent = `${this.state.bossHp} / ${this.config.maxHp}`;
      this.elements.scoreDisplay.textContent = `Puntaje: ${this.state.score}`;
      this.elements.timer.textContent = `Tiempo: ${Math.max(0, this.state.timeLeft)}s`;
      
      const isWarningZone = this.state.timeLeft <= this.config.audio.timerWarningThreshold && this.state.timeLeft > 0 && this.state.gameActive && !this.state.isPaused;
      this.elements.timer.classList.toggle('blink-warning', isWarningZone);

      if (isWarningZone && this.state.timeLeft !== this.state.lastTimerWarningSoundTime) {
        this.sound.playSFX(this.elements.sfxTimerWarning);
        this.state.lastTimerWarningSoundTime = this.state.timeLeft;
      } else if (!isWarningZone) {
        this.state.lastTimerWarningSoundTime = null;
      }
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

    displayFinalMessage() {
      const playerWon = this.state.bossHp <= 0;
      const normalizedScore = this.calculateNormalizedScore();
      let gameTimeDisplay = "0s";
      if (this.state.gameStartTime && this.state.gameEndTime) {
        const totalDurationSeconds = Math.round((this.state.gameEndTime - this.state.gameStartTime) / 1000);
        const minutes = Math.floor(totalDurationSeconds / 60);
        const seconds = totalDurationSeconds % 60;
        gameTimeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }
      
      this.elements.finalMessage.style.display = 'flex';
      this.elements.finalMessage.innerHTML = `
        <div class="result-text">${playerWon ? '¡VICTORIA!' : '¡DERROTA!'}</div>
        <div style="margin: 20px 0; display: flex; justify-content: center; gap: 40px; font-size: 0.9em; font-weight: 400;">
          <div>PUNTOS: ${normalizedScore}/100</div>
          <div>TIEMPO: ${gameTimeDisplay}</div>
        </div>
        <div class="end-game-buttons">
          <button class="end-game-btn" onclick="Game.startGame()">Reiniciar</button>
          <button class="end-game-btn" onclick="Game.goHome()">Volver al Inicio</button>
        </div>
      `;
      this.elements.finalMessage.className = `final-message ${playerWon ? 'win' : 'lose'}`;
      
      const restartBtn = this.elements.finalMessage.querySelector('.end-game-btn:nth-child(1)');
      const homeBtn = this.elements.finalMessage.querySelector('.end-game-btn:nth-child(2)');
      restartBtn.addEventListener('click', () => this.sound.playSFX(this.sound.sfxList[7]));
      homeBtn.addEventListener('click', () => this.sound.playSFX(this.sound.sfxList[7]));
    },

    calculateNormalizedScore() {
      const maxPossibleScore = this.calculateMaxPossibleScore();
      if (maxPossibleScore === 0) return 0;
      const normalizedScore = Math.round((this.state.score / maxPossibleScore) * 100);
      return Math.min(100, Math.max(0, normalizedScore));
    },

    logGameStats() {
      let totalDurationSeconds = 0;
      if (this.state.gameStartTime && this.state.gameEndTime) {
        totalDurationSeconds = Math.round((this.state.gameEndTime - this.state.gameStartTime) / 1000);
      }
      const normalizedScore = this.calculateNormalizedScore();
      const gameStats = {
        puntajeObtenido: this.state.score,
        puntajeNormalizado: normalizedScore,
        preguntasFalladas: this.state.incorrectAnswersCount,
        preguntasAcertadas: this.state.correctAnswersCount,
        totalPreguntasMostradas: this.state.totalQuestionsPresented,
        tiempoTotalDeJuegoSegundos: totalDurationSeconds,
        juegoCompletado: this.state.gameCompleted,
        bonusCompletado: this.state.gameCompleted ? this.config.pointsValues.completionBonus : 0
      };
      this.sendGameDataToAPI(gameStats, totalDurationSeconds);
    },

    calculateMaxPossibleScore() {
      const totalQuestions = this.state.totalQuestionsPresented;
      const baseScore = totalQuestions * this.config.pointsValues.baseCorrect;
      const rapidBonus = totalQuestions * this.config.pointsValues.rapidBonus;
      const streakBonuses = Math.floor(totalQuestions / 3) * this.config.pointsValues.streakBonus;
      const completionBonus = this.config.pointsValues.completionBonus;
      return baseScore + rapidBonus + streakBonuses + completionBonus;
    },

    async sendGameDataToAPI(gameStats, timeInSeconds) {
      if (!currentUserId) return;
      const scoreOutOf100 = this.calculateNormalizedScore();
      const gameData = {
        user_id: currentUserId, game_id: 1,
        correct_challenges: scoreOutOf100,
        total_challenges: 100,
        time_spent: timeInSeconds
      };
      
      showDataSendingIndicator();
      updateLoadingText('Enviando datos...');
      
      try {
        const response = await fetch(`https://puramentebackend.onrender.com/api/game-attempts/from-game`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gameData)
        });
        const data = await response.json();
        if (response.ok) {
          updateLoadingText('¡Datos enviados correctamente!');
        } else {
          throw new Error(`Error del servidor: ${response.status} - ${data.message || 'Error desconocido'}`);
        }
      } catch (error) {
        console.error('Error enviando datos:', error);
        updateLoadingText('Error al enviar datos');
      } finally {
        setTimeout(() => hideDataSendingIndicator(), 2500);
      }
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
            this.sound.playSFXGroup(this.elements.sfxPlayerAttack, this.elements.sfxEnemyHit);
            setTimeout(() => {
                this.elements.enemyCharacter.classList.remove('shake', 'hit-effect');
                this.elements.attackFlash.classList.remove('active');
            }, 500);
        } else if (effectType === 'playerHit') {
            this.elements.playerCharacter.classList.add('shake');
            this.sound.playSFX(this.elements.sfxPlayerHit);
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

  window.Game = Game; 
  Game.init();
});