import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

type Color = 'red' | 'yellow' | 'blue' | 'green';

const COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];
const MAX_SEQUENCE_LENGTH = 100;

interface DailyScore {
  [date: string]: number;
}

interface ScoreData {
  dailyScores: DailyScore;
  allTimeHigh: number;
}

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

const app = express();
const PORT = 42020;
const DATA_FILE = path.join(process.cwd(), 'server', 'data', 'scores.json');

app.use(cors());
app.use(express.json());

const getTodayString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const seededRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
};

const hashDate = (dateStr: string): number => {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateDailySequence = (dateStr: string): Color[] => {
  const seed = hashDate(dateStr);
  const random = seededRandom(seed);
  const sequence: Color[] = [];

  for (let i = 0; i < MAX_SEQUENCE_LENGTH; i++) {
    const colorIndex = Math.floor(random() * COLORS.length);
    sequence.push(COLORS[colorIndex]);
  }

  return sequence;
};

const ensureDataFile = (): void => {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData: ScoreData = {
      dailyScores: {},
      allTimeHigh: 0,
    };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
};

const readScoreData = (): ScoreData => {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
};

const writeScoreData = (data: ScoreData): void => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

app.get('/api/daily-challenge', (_req, res) => {
  try {
    const today = getTodayString();
    const sequence = generateDailySequence(today);
    const data = readScoreData();
    const todayBest = data.dailyScores[today] || 0;

    const response: DailyChallengeResponse = {
      date: today,
      sequence,
      todayBest,
      allTimeHigh: data.allTimeHigh,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: '获取每日挑战失败' });
  }
});

app.post('/api/highscore', (req, res) => {
  try {
    const { score } = req.body as { score?: number };

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: '无效的分数' });
    }

    const today = getTodayString();
    const data = readScoreData();

    const isTodayRecord = !data.dailyScores[today] || score > data.dailyScores[today];
    if (isTodayRecord) {
      data.dailyScores[today] = score;
    }

    const isNewRecord = score > data.allTimeHigh;
    if (isNewRecord) {
      data.allTimeHigh = score;
    }

    writeScoreData(data);

    const response: HighScoreResponse = {
      highScore: data.allTimeHigh,
      isNewRecord,
      todayBest: data.dailyScores[today],
      isTodayRecord,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: '保存分数失败' });
  }
});

app.get('/api/highscore', (_req, res) => {
  try {
    const today = getTodayString();
    const data = readScoreData();
    const todayBest = data.dailyScores[today] || 0;

    res.json({
      highScore: data.allTimeHigh,
      todayBest,
      date: today,
    });
  } catch (error) {
    res.status(500).json({ error: '读取分数失败' });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
