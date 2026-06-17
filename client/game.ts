type Color = 'red' | 'yellow' | 'blue' | 'green';

const COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];

interface DailyChallengeResponse {
  date: string;
  sequence: Color[];
  todayBest: number;
  allTimeHigh: number;
}

interface HighScoreResponse {
  highScore: number;
  isNewRecord?: boolean;
  todayBest: number;
  isTodayRecord?: boolean;
}

class ColorMemoryGame {
  private dailySequence: Color[] = [];
  private sequence: Color[] = [];
  private playerIndex: number = 0;
  private isPlaying: boolean = false;
  private isShowingSequence: boolean = false;
  private level: number = 0;
  private highScore: number = 0;
  private todayBest: number = 0;
  private todayDate: string = '';

  private readonly buttons: NodeListOf<HTMLButtonElement>;
  private readonly startBtn: HTMLButtonElement;
  private readonly currentLevelEl: HTMLElement;
  private readonly highScoreEl: HTMLElement;
  private readonly todayBestEl: HTMLElement;
  private readonly dateEl: HTMLElement;
  private readonly gameStatusEl: HTMLElement;

  private readonly lightOnDuration: number = 600;
  private readonly lightOffDuration: number = 300;

  constructor() {
    this.buttons = document.querySelectorAll('.color-btn');
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.currentLevelEl = document.getElementById('current-level') as HTMLElement;
    this.highScoreEl = document.getElementById('high-score') as HTMLElement;
    this.todayBestEl = document.getElementById('today-best') as HTMLElement;
    this.dateEl = document.getElementById('challenge-date') as HTMLElement;
    this.gameStatusEl = document.getElementById('game-status') as HTMLElement;

    this.init();
  }

  private async init(): Promise<void> {
    this.setupEventListeners();
    await this.fetchDailyChallenge();
  }

  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.startGame());

    this.buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = (e.target as HTMLButtonElement).dataset.color as Color;
        this.handlePlayerInput(color);
      });
    });
  }

  private async fetchDailyChallenge(): Promise<void> {
    try {
      const response = await fetch('/api/daily-challenge');
      const data = await response.json() as DailyChallengeResponse;
      this.dailySequence = data.sequence;
      this.highScore = data.allTimeHigh;
      this.todayBest = data.todayBest;
      this.todayDate = data.date;

      this.highScoreEl.textContent = this.highScore.toString();
      this.todayBestEl.textContent = this.todayBest.toString();
      this.dateEl.textContent = `挑战日期: ${this.todayDate}`;
    } catch (error) {
      console.error('获取每日挑战失败:', error);
      this.showStatus('无法连接服务器，请刷新重试', 'gameover');
    }
  }

  private async saveHighScore(score: number): Promise<void> {
    try {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });
      const data = await response.json() as HighScoreResponse;
      this.highScore = data.highScore;
      this.todayBest = data.todayBest;
      this.highScoreEl.textContent = this.highScore.toString();
      this.todayBestEl.textContent = this.todayBest.toString();

      if (data.isTodayRecord && data.isNewRecord) {
        this.showStatus('🎉 新纪录！今日最佳 & 历史最佳！', 'success');
      } else if (data.isTodayRecord) {
        this.showStatus('🎉 今日新纪录！', 'success');
      } else if (data.isNewRecord) {
        this.showStatus('🎉 历史新纪录！', 'success');
      }
    } catch (error) {
      console.error('保存最高分失败:', error);
    }
  }

  private startGame(): void {
    if (this.dailySequence.length === 0) {
      this.showStatus('正在加载每日挑战...', 'playing');
      return;
    }

    this.sequence = [];
    this.playerIndex = 0;
    this.level = 0;
    this.isPlaying = true;
    this.currentLevelEl.textContent = '0';

    this.setButtonsDisabled(true);
    this.startBtn.disabled = true;

    this.showStatus('每日挑战开始！', 'playing');
    this.nextRound();
  }

  private nextRound(): void {
    this.level++;
    this.currentLevelEl.textContent = this.level.toString();
    this.playerIndex = 0;

    if (this.level <= this.dailySequence.length) {
      this.sequence.push(this.dailySequence[this.level - 1]);
    } else {
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.sequence.push(randomColor);
    }

    this.showStatus(`第 ${this.level} 关 - 记住序列`, 'playing');
    this.showSequence();
  }

  private async showSequence(): Promise<void> {
    this.isShowingSequence = true;
    this.setButtonsDisabled(true);

    await this.delay(500);

    for (let i = 0; i < this.sequence.length; i++) {
      const color = this.sequence[i];
      await this.lightUpButton(color);

      if (i < this.sequence.length - 1) {
        await this.delay(this.lightOffDuration);
      }
    }

    this.isShowingSequence = false;
    this.setButtonsDisabled(false);
    this.showStatus('请按顺序点击按钮', 'playing');
  }

  private async lightUpButton(color: Color): Promise<void> {
    const button = this.getButtonByColor(color);
    if (!button) return;

    button.classList.add('active');
    await this.delay(this.lightOnDuration);
    button.classList.remove('active');
  }

  private getButtonByColor(color: Color): HTMLButtonElement | null {
    return document.querySelector(`.color-btn[data-color="${color}"]`);
  }

  private async handlePlayerInput(color: Color): Promise<void> {
    if (!this.isPlaying || this.isShowingSequence) return;

    const expectedColor = this.sequence[this.playerIndex];
    const button = this.getButtonByColor(color);

    if (color === expectedColor) {
      button?.classList.add('correct');
      await this.delay(200);
      button?.classList.remove('correct');

      this.playerIndex++;

      if (this.playerIndex === this.sequence.length) {
        this.showStatus('正确！准备下一关...', 'success');
        this.setButtonsDisabled(true);
        await this.delay(1000);
        this.nextRound();
      }
    } else {
      button?.classList.add('wrong');
      await this.delay(500);
      button?.classList.remove('wrong');

      this.gameOver();
    }
  }

  private async gameOver(): Promise<void> {
    this.isPlaying = false;
    this.setButtonsDisabled(true);
    this.startBtn.disabled = false;

    const finalScore = this.level - 1;

    if (finalScore > this.todayBest || finalScore > this.highScore) {
      await this.saveHighScore(finalScore);
    } else {
      this.showStatus(`游戏结束！你完成了 ${finalScore} 关`, 'gameover');
    }
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.buttons.forEach(btn => {
      btn.disabled = disabled;
    });
  }

  private showStatus(message: string, type: 'playing' | 'gameover' | 'success' | '' = ''): void {
    this.gameStatusEl.textContent = message;
    this.gameStatusEl.className = 'game-status';
    if (type) {
      this.gameStatusEl.classList.add(type);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

new ColorMemoryGame();
