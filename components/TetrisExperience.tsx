"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 22; // includes 2 hidden spawn rows
const VISIBLE_ROWS = 20;
const INITIAL_DROP_DELAY = 1000;
const MIN_DROP_DELAY = 60;

type GameStateStatus = "idle" | "playing" | "paused" | "gameover";

type TetrominoKey = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

type Cell = {
  type: TetrominoKey;
  locked: boolean;
  clearing?: boolean;
};

type ActivePiece = {
  type: TetrominoKey;
  rotation: number;
  position: { x: number; y: number };
};

type GameStats = {
  singles: number;
  doubles: number;
  triples: number;
  tetrises: number;
  combos: number;
  maxCombo: number;
};

type GameState = {
  board: (Cell | null)[][];
  current: ActivePiece;
  nextQueue: TetrominoKey[];
  holdPiece: TetrominoKey | null;
  canHold: boolean;
  status: GameStateStatus;
  score: number;
  level: number;
  lines: number;
  combo: number;
  stats: GameStats;
  linesToClear: number[];
  dropDelay: number;
};

type Action =
  | { type: "RESET"; payload: { piece: ActivePiece; queue: TetrominoKey[] } }
  | { type: "TICK" }
  | { type: "MOVE"; payload: { dx: number; dy: number } }
  | { type: "ROTATE"; payload: { direction: 1 | -1 } }
  | { type: "HARD_DROP" }
  | { type: "HOLD" }
  | { type: "PAUSE_TOGGLE" }
  | { type: "RESUME" }
  | { type: "GAME_OVER" }
  | { type: "APPLY_CLEARING" }
  | { type: "APPLY_LINES" }
  | { type: "SET_STATUS"; payload: GameStateStatus }
  | { type: "SET_HIGH_SCORE"; payload: number };

type GameContextValue = {
  state: GameState;
  dispatch: React.Dispatch<Action>;
};

const TETROMINOES: Record<TetrominoKey, number[][][]> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0]
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0]
    ]
  ],
  J: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0]
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1]
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0]
    ]
  ],
  L: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1]
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0]
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0]
    ]
  ],
  O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  ],
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ],
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0]
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    ]
  ],
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0]
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0]
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0]
    ]
  ],
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0]
    ],
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1]
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0]
    ]
  ]
};

const PIECE_COLORS: Record<TetrominoKey, string> = {
  I: "from-sky-400 via-cyan-300 to-sky-500",
  J: "from-indigo-400 via-violet-400 to-indigo-600",
  L: "from-amber-400 via-orange-400 to-amber-500",
  O: "from-yellow-300 via-amber-300 to-yellow-500",
  S: "from-emerald-400 via-teal-300 to-emerald-500",
  T: "from-fuchsia-400 via-purple-400 to-fuchsia-600",
  Z: "from-rose-400 via-pink-400 to-rose-600"
};

const SCORES = [0, 100, 300, 500, 800];

const SRS_KICKS_I: Record<string, { x: number; y: number }[]> = {
  "0>1": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 }
  ],
  "1>0": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 }
  ],
  "1>2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 }
  ],
  "2>1": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 }
  ],
  "2>3": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 }
  ],
  "3>2": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 }
  ],
  "3>0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 }
  ],
  "0>3": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 }
  ]
};

const SRS_KICKS_DEFAULT: Record<string, { x: number; y: number }[]> = {
  "0>1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 }
  ],
  "1>0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ],
  "1>2": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ],
  "2>1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 }
  ],
  "2>3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 }
  ],
  "3>2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 }
  ],
  "3>0": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 }
  ],
  "0>3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 }
  ]
};

const EMPTY_BOARD = (): (Cell | null)[][] =>
  Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null));

const getPieceMatrix = (piece: TetrominoKey, rotation: number) => {
  const variations = TETROMINOES[piece];
  return variations[rotation % variations.length];
};

const randomBag = (): TetrominoKey[] => {
  const bag: TetrominoKey[] = ["I", "J", "L", "O", "S", "T", "Z"];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

const startingState = (): GameState => {
  const queue = randomBag();
  const first = queue.shift()!;
  return {
    board: EMPTY_BOARD(),
    current: {
      type: first,
      rotation: 0,
      position: { x: 3, y: 0 }
    },
    nextQueue: [...queue, ...randomBag()],
    holdPiece: null,
    canHold: true,
    status: "idle",
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    stats: {
      singles: 0,
      doubles: 0,
      triples: 0,
      tetrises: 0,
      combos: 0,
      maxCombo: 0
    },
    linesToClear: [],
    dropDelay: INITIAL_DROP_DELAY
  };
};

const cloneBoard = (board: (Cell | null)[][]) => board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

const isCellOccupied = (board: (Cell | null)[][], x: number, y: number) => {
  if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true;
  if (y < 0) return false;
  return Boolean(board[y][x]);
};

const collides = (board: (Cell | null)[][], piece: ActivePiece, position?: { x: number; y: number }, rotation?: number) => {
  const { type } = piece;
  const matrix = getPieceMatrix(type, rotation ?? piece.rotation);
  const pos = position ?? piece.position;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const boardX = pos.x + x;
      const boardY = pos.y + y;
      if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
};

const mergePiece = (board: (Cell | null)[][], piece: ActivePiece) => {
  const nextBoard = cloneBoard(board);
  const matrix = getPieceMatrix(piece.type, piece.rotation);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardX = piece.position.x + x;
      const boardY = piece.position.y + y;
      if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        nextBoard[boardY][boardX] = { type: piece.type, locked: true };
      }
    });
  });
  return nextBoard;
};

const findFullLines = (board: (Cell | null)[][]) => {
  const lines: number[] = [];
  board.forEach((row, y) => {
    if (row.every((cell) => cell)) lines.push(y);
  });
  return lines;
};

const clearFullLines = (board: (Cell | null)[][], lines: number[]) => {
  if (!lines.length) return board;
  const nextBoard = cloneBoard(board);
  lines.forEach((line) => {
    nextBoard.splice(line, 1);
    nextBoard.unshift(Array.from({ length: BOARD_WIDTH }, () => null));
  });
  return nextBoard;
};

const getRotationKey = (from: number, to: number) => `${from % 4}>${to % 4}`;

const applyKickTests = (
  board: (Cell | null)[][],
  piece: ActivePiece,
  direction: 1 | -1
): { position: { x: number; y: number }; rotation: number } | null => {
  const nextRotation = (piece.rotation + direction + 4) % 4;
  const key = getRotationKey(piece.rotation, nextRotation);
  const kicksTable =
    piece.type === "O"
      ? { [key]: [{ x: 0, y: 0 }] }
      : piece.type === "I"
        ? SRS_KICKS_I
        : SRS_KICKS_DEFAULT;
  const kicks = kicksTable[key] ?? [{ x: 0, y: 0 }];

  for (const kick of kicks) {
    const candidatePos = {
      x: piece.position.x + kick.x,
      y: piece.position.y + kick.y
    };
    if (!collides(board, piece, candidatePos, nextRotation)) {
      return { rotation: nextRotation, position: candidatePos };
    }
  }

  return null;
};

const spawnPiece = (queue: TetrominoKey[]) => {
  if (!queue.length) queue.push(...randomBag());
  const [nextPiece, ...rest] = queue;
  return {
    piece: {
      type: nextPiece,
      rotation: 0,
      position: { x: 3, y: 0 }
    },
    queue: rest.length <= 7 ? [...rest, ...randomBag()] : rest
  };
};

const calculateLevel = (lines: number) => Math.min(20, Math.floor(lines / 10) + 1);

const calculateDelay = (level: number) => Math.max(MIN_DROP_DELAY, INITIAL_DROP_DELAY - (level - 1) * 70);

const reducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case "RESET": {
      return {
        ...startingState(),
        board: EMPTY_BOARD(),
        current: action.payload.piece,
        nextQueue: action.payload.queue,
        status: "playing"
      };
    }
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "PAUSE_TOGGLE":
      return { ...state, status: state.status === "paused" ? "playing" : "paused" };
    case "RESUME":
      return { ...state, status: "playing" };
    case "MOVE": {
      if (state.status !== "playing") return state;
      const position = {
        x: state.current.position.x + action.payload.dx,
        y: state.current.position.y + action.payload.dy
      };
      if (collides(state.board, state.current, position)) {
        return state;
      }
      return {
        ...state,
        current: {
          ...state.current,
          position
        }
      };
    }
    case "ROTATE": {
      if (state.status !== "playing") return state;
      const kicked = applyKickTests(state.board, state.current, action.payload.direction);
      if (!kicked) return state;
      return {
        ...state,
        current: {
          ...state.current,
          position: kicked.position,
          rotation: kicked.rotation
        }
      };
    }
    case "TICK": {
      if (state.status !== "playing") return state;
      const nextPos = { x: state.current.position.x, y: state.current.position.y + 1 };
      if (!collides(state.board, state.current, nextPos)) {
        return {
          ...state,
          current: {
            ...state.current,
            position: nextPos
          }
        };
      }

      const merged = mergePiece(state.board, state.current);
      const lines = findFullLines(merged);
      if (lines.length) {
        const marked = cloneBoard(merged);
        lines.forEach((line) =>
          marked[line]?.forEach((cell, idx) => {
            if (cell) marked[line]![idx] = { ...cell, clearing: true };
          })
        );

        const combo = state.combo + 1;
        const level = calculateLevel(state.lines + lines.length);
        const baseScore = SCORES[lines.length];
        const comboBonus = combo > 0 ? combo * 50 : 0;
        const totalScore = (baseScore + comboBonus) * level;

        const stats: GameStats = {
          ...state.stats,
          combos: combo > 0 ? state.stats.combos + 1 : state.stats.combos,
          maxCombo: Math.max(state.stats.maxCombo, combo)
        };
        if (lines.length === 1) stats.singles += 1;
        if (lines.length === 2) stats.doubles += 1;
        if (lines.length === 3) stats.triples += 1;
        if (lines.length === 4) stats.tetrises += 1;

        return {
          ...state,
          board: marked,
          linesToClear: lines,
          combo,
          stats,
          score: state.score + totalScore,
          lines: state.lines + lines.length,
          level,
          dropDelay: calculateDelay(level),
          canHold: true
        };
      }

      const next = spawnPiece(state.nextQueue);
      if (collides(merged, next.piece)) {
        return { ...state, board: merged, status: "gameover" };
      }

      return {
        ...state,
        board: merged,
        current: next.piece,
        nextQueue: next.queue,
        canHold: true,
        combo: -1
      };
    }
    case "APPLY_CLEARING": {
      if (!state.linesToClear.length) return state;
      const clearedBoard = clearFullLines(state.board, state.linesToClear);
      const next = spawnPiece(state.nextQueue);
      if (collides(clearedBoard, next.piece)) {
        return {
          ...state,
          board: clearedBoard,
          status: "gameover",
          linesToClear: []
        };
      }
      return {
        ...state,
        board: clearedBoard,
        current: next.piece,
        nextQueue: next.queue,
        linesToClear: []
      };
    }
    case "HOLD": {
      if (state.status !== "playing" || !state.canHold) return state;
      const hold = state.holdPiece;
      const nextQueue = [...state.nextQueue];
      let nextPiece: ActivePiece;
      let nextHold: TetrominoKey | null;

      if (hold) {
        nextPiece = {
          type: hold,
          rotation: 0,
          position: { x: 3, y: 0 }
        };
        nextHold = state.current.type;
      } else {
        const spawn = spawnPiece(nextQueue);
        nextPiece = spawn.piece;
        nextQueue.splice(0, nextQueue.length, ...spawn.queue);
        nextHold = state.current.type;
      }

      if (collides(state.board, nextPiece)) {
        return { ...state, status: "gameover" };
      }

      return {
        ...state,
        current: nextPiece,
        holdPiece: nextHold,
        canHold: false
      };
    }
    case "HARD_DROP": {
      if (state.status !== "playing") return state;
      let dropDistance = 0;
      while (!collides(state.board, state.current, { x: state.current.position.x, y: state.current.position.y + dropDistance + 1 })) {
        dropDistance += 1;
      }
      const landedPiece = {
        ...state.current,
        position: {
          x: state.current.position.x,
          y: state.current.position.y + dropDistance
        }
      };

      const merged = mergePiece(state.board, landedPiece);
      const lines = findFullLines(merged);
      const bonusScore = 2 * dropDistance;

      if (lines.length) {
        const marked = cloneBoard(merged);
        lines.forEach((line) =>
          marked[line]?.forEach((cell, idx) => {
            if (cell) marked[line]![idx] = { ...cell, clearing: true };
          })
        );

        const combo = state.combo + 1;
        const level = calculateLevel(state.lines + lines.length);
        const baseScore = SCORES[lines.length];
        const comboBonus = combo > 0 ? combo * 50 : 0;
        const totalScore = (baseScore + comboBonus) * level + bonusScore;

        const stats: GameStats = {
          ...state.stats,
          combos: combo > 0 ? state.stats.combos + 1 : state.stats.combos,
          maxCombo: Math.max(state.stats.maxCombo, combo)
        };
        if (lines.length === 1) stats.singles += 1;
        if (lines.length === 2) stats.doubles += 1;
        if (lines.length === 3) stats.triples += 1;
        if (lines.length === 4) stats.tetrises += 1;

        return {
          ...state,
          board: marked,
          linesToClear: lines,
          combo,
          stats,
          score: state.score + totalScore,
          lines: state.lines + lines.length,
          level,
          dropDelay: calculateDelay(level),
          canHold: true
        };
      }

      const next = spawnPiece(state.nextQueue);
      if (collides(merged, next.piece)) {
        return { ...state, board: merged, score: state.score + bonusScore, status: "gameover" };
      }
      return {
        ...state,
        board: merged,
        current: next.piece,
        nextQueue: next.queue,
        score: state.score + bonusScore,
        combo: -1,
        canHold: true
      };
    }
    case "GAME_OVER":
      return { ...state, status: "gameover" };
    default:
      return state;
  }
};

const useInterval = (callback: () => void, delay: number | null, active: boolean) => {
  const savedCallback = useRef<() => void>();
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active || delay === null) return;
    const id = window.setInterval(() => savedCallback.current?.(), delay);
    return () => window.clearInterval(id);
  }, [delay, active]);
};

const useKeyPresses = (handler: (event: KeyboardEvent) => void, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;
    const handle = (event: KeyboardEvent) => {
      handler(event);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handler, enabled]);
};

const computeGhostPosition = (board: (Cell | null)[][], piece: ActivePiece) => {
  let offset = 0;
  while (!collides(board, piece, { x: piece.position.x, y: piece.position.y + offset + 1 })) {
    offset += 1;
  }
  return piece.position.y + offset;
};

const formatNumber = (value: number) => value.toLocaleString();

const getVisibleBoard = (board: (Cell | null)[][]) => board.slice(BOARD_HEIGHT - VISIBLE_ROWS);

const getHighScore = () => {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem("lumina-high-score") ?? "0");
};

const setHighScore = (value: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lumina-high-score", String(value));
};

type ControlHint = {
  label: string;
  keys: string[];
};

const CONTROL_HINTS: ControlHint[] = [
  { label: "Move", keys: ["←", "→"] },
  { label: "Soft Drop", keys: ["↓"] },
  { label: "Rotate CW", keys: ["X", "↑"] },
  { label: "Rotate CCW", keys: ["Z"] },
  { label: "Hard Drop", keys: ["Space"] },
  { label: "Hold", keys: ["Shift", "C"] },
  { label: "Pause", keys: ["P"] }
];

const GamePanel = ({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="glass-panel flex flex-col gap-3 p-4 text-white/90">
    <div className="flex items-center justify-between">
      <h3 className="font-display text-sm tracking-[0.3em] uppercase text-white/60">{title}</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
    {children}
  </div>
);

const ScoreCard = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-60" />
    <div className="relative flex flex-col gap-1">
      <span className="text-xs uppercase tracking-[0.4em] text-white/60">{label}</span>
      <span className={clsx("font-display text-2xl font-semibold text-white drop-shadow", accent)}>{value}</span>
    </div>
  </div>
);

const NeonButton = ({ children, ...props }: { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={clsx(
      "group relative overflow-hidden rounded-full border border-white/20 bg-white/10 px-6 py-3 font-display text-sm uppercase tracking-[0.35em] text-white transition hover:border-white/40 hover:shadow-neon focus:outline-none focus:ring-2 focus:ring-white/30",
      props.className
    )}
  >
    <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
    <span className="absolute inset-0 opacity-0 mix-blend-screen group-hover:opacity-100">
      <motion.div
        className="h-full w-full"
        initial={{ x: "-100%" }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent 70%)"
        }}
      />
    </span>
    <span className="relative z-10">{children}</span>
  </button>
);

const TetrisExperience = () => {
  const [state, dispatch] = useReducer(reducer, undefined, startingState);
  const [highScore, setHighScoreState] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [lastDropTime, setLastDropTime] = useState(0);
  const requestRef = useRef<number | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const clearTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setHighScoreState(getHighScore());
  }, []);

  useEffect(() => {
    if (state.status === "gameover") {
      if (state.score > highScore) {
        setHighScore(state.score);
        setHighScoreState(state.score);
      }
    }
  }, [state.status, state.score, highScore]);

  useEffect(() => {
    if (!musicRef.current) return;
    if (musicEnabled && state.status === "playing") {
      void musicRef.current.play().catch(() => undefined);
    } else {
      musicRef.current.pause();
    }
  }, [musicEnabled, state.status]);

  const startGame = useCallback(() => {
    const queue = randomBag();
    const first = queue.shift()!;
    dispatch({ type: "RESET", payload: { piece: { type: first, rotation: 0, position: { x: 3, y: 0 } }, queue } });
    setLastDropTime(performance.now());
    if (musicEnabled) {
      setTimeout(() => {
        if (musicRef.current && state.status !== "playing") {
          void musicRef.current.play().catch(() => undefined);
        }
      }, 150);
    }
  }, [musicEnabled, state.status]);

  const step = useCallback(
    (time: number) => {
      if (state.status !== "playing") return;
      const elapsed = time - lastDropTime;
      if (elapsed > state.dropDelay) {
        dispatch({ type: "TICK" });
        setLastDropTime(time);
      }
    },
    [lastDropTime, state.dropDelay, state.status]
  );

  useEffect(() => {
    const loop = (time: number) => {
      step(time);
      requestRef.current = requestAnimationFrame(loop);
    };
    if (state.status === "playing") {
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state.status, step]);

  useEffect(() => {
    if (!state.linesToClear.length) return;
    if (clearTimeoutRef.current) window.clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "APPLY_CLEARING" });
    }, effectsEnabled ? 210 : 0);
    return () => {
      if (clearTimeoutRef.current) window.clearTimeout(clearTimeoutRef.current);
    };
  }, [state.linesToClear, effectsEnabled]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (state.status === "idle" && event.code === "Space") {
        event.preventDefault();
        startGame();
        return;
      }

      if (state.status === "gameover") {
        if (event.code === "Space") {
          event.preventDefault();
          startGame();
        }
        return;
      }

      if (state.status === "paused" && event.code !== "KeyP") return;

      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          dispatch({ type: "MOVE", payload: { dx: -1, dy: 0 } });
          break;
        case "ArrowRight":
          event.preventDefault();
          dispatch({ type: "MOVE", payload: { dx: 1, dy: 0 } });
          break;
        case "ArrowDown":
          event.preventDefault();
          setLastDropTime(performance.now());
          dispatch({ type: "MOVE", payload: { dx: 0, dy: 1 } });
          break;
        case "ArrowUp":
        case "KeyX":
          event.preventDefault();
          dispatch({ type: "ROTATE", payload: { direction: 1 } });
          break;
        case "KeyZ":
          event.preventDefault();
          dispatch({ type: "ROTATE", payload: { direction: -1 } });
          break;
        case "Space":
          event.preventDefault();
          dispatch({ type: "HARD_DROP" });
          break;
        case "ShiftLeft":
        case "ShiftRight":
        case "KeyC":
          event.preventDefault();
          dispatch({ type: "HOLD" });
          break;
        case "KeyP":
          event.preventDefault();
          dispatch({ type: "PAUSE_TOGGLE" });
          break;
        default:
          break;
      }
    },
    [state.status, startGame]
  );

  useKeyPresses(handleKeyDown, true);

  const ghostY = computeGhostPosition(state.board, state.current);

  const visibleBoard = useMemo(() => getVisibleBoard(state.board), [state.board]);

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[1fr_minmax(320px,380px)] xl:gap-10">
      <div className="relative flex flex-col items-center justify-start gap-6">
        <div className="glass-panel relative flex w-full flex-col overflow-hidden border-white/10 px-4 pb-6 pt-4 sm:px-6">
          <div className="absolute -top-24 right-10 hidden h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl md:block" />
          <div className="absolute -bottom-16 left-10 hidden h-48 w-48 rounded-full bg-rose-500/10 blur-3xl md:block" />

          <div className="relative grid justify-center gap-6 md:grid-cols-[minmax(280px,1fr)_220px]">
            <div className="relative mx-auto flex h-[520px] w-[280px] max-w-full items-center justify-center rounded-[2.5rem] border border-white/20 bg-black/30 p-3 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.8)] backdrop-blur-xl md:h-[600px] md:w-[320px]">
              <div className="relative h-full w-full rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-950/90 to-slate-900/70 p-3 shadow-inner shadow-black/60">
                <div className="absolute inset-3 rounded-[1.8rem] border border-white/5 backdrop-blur-xl" />

                <div className="relative grid h-full w-full grid-rows-[auto_1fr] gap-3">
                  <div className="flex items-center justify-between px-4 pt-2">
                    <div>
                      <span className="text-xs uppercase tracking-[0.45em] text-indigo-300/80">Level {state.level}</span>
                      <h2 className="font-display text-lg text-white/90">Flux Arena</h2>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-3 py-1 text-xs uppercase tracking-[0.4em] text-indigo-200/80">
                      <span className="h-2 w-2 animate-pulseSoft rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                      Live
                    </div>
                  </div>
                  <div className="relative mx-auto grid h-full w-full gap-[2px] rounded-3xl border border-white/10 bg-slate-950/60 p-3 shadow-[inset_0_15px_40px_rgba(15,23,42,0.8)]">
                    <div
                      className="relative grid h-full w-full place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/70 to-slate-900/30 p-4 shadow-[inset_0_15px_35px_rgba(15,23,42,0.7)]"
                      style={{
                        gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${VISIBLE_ROWS}, minmax(0, 1fr))`
                      }}
                    >
                      {visibleBoard.map((row, y) =>
                        row.map((cell, x) => {
                          const absoluteY = y + (BOARD_HEIGHT - VISIBLE_ROWS);
                          const isGhost =
                            !cell &&
                            state.current &&
                            absoluteY === ghostY &&
                            getPieceMatrix(state.current.type, state.current.rotation)?.[absoluteY - state.current.position.y]?.[
                              x - state.current.position.x
                            ];

                          const isCurrent =
                            absoluteY >= state.current.position.y &&
                            absoluteY < state.current.position.y + getPieceMatrix(state.current.type, state.current.rotation).length &&
                            x >= state.current.position.x &&
                            x < state.current.position.x + getPieceMatrix(state.current.type, state.current.rotation)[0].length &&
                            getPieceMatrix(state.current.type, state.current.rotation)[absoluteY - state.current.position.y]?.[
                              x - state.current.position.x
                            ] &&
                            !(cell && cell.locked);

                          const pieceType = isCurrent ? state.current.type : cell?.type;
                          const showClearing = cell?.clearing;
                          const isLocked = Boolean(cell && cell.locked);

                          return (
                            <div
                              key={`${x}-${y}`}
                              className={clsx(
                                "relative flex h-full w-full items-center justify-center rounded-[6px] border border-white/5 transition-all duration-75",
                                !pieceType && "border-white/5 bg-slate-900/30",
                                pieceType &&
                                  clsx(
                                    "pixel-shadow border-white/30 bg-gradient-to-br",
                                    PIECE_COLORS[pieceType],
                                    isGhost && "opacity-30 blur-[0.2px]",
                                    showClearing && "animate-pulseSoft border-white/60"
                                  ),
                                isCurrent && !isLocked && "shadow-[0_0_15px_rgba(96,165,250,0.6)]"
                              )}
                            >
                              {isLocked && !showClearing && (
                                <div className="pointer-events-none absolute inset-0 rounded-[6px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
                              )}
                            </div>
                          );
                        })
                      )}
                      <motion.div
                        className="pointer-events-none absolute inset-x-2 top-3 flex justify-between text-[10px] uppercase tracking-[0.5em] text-white/20"
                        animate={{ opacity: [0.35, 0.65, 0.35] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <span>Flux</span>
                        <span>Pulse</span>
                        <span>Grid</span>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex flex-col gap-4">
              <GamePanel title="Scoreboard">
                <div className="grid grid-cols-2 gap-3">
                  <ScoreCard label="Score" value={formatNumber(state.score)} accent="text-3xl" />
                  <ScoreCard label="High Score" value={formatNumber(highScore)} />
                  <ScoreCard label="Lines" value={String(state.lines)} />
                  <ScoreCard label="Combo" value={state.combo >= 0 ? `x${state.combo}` : "—"} />
                </div>
              </GamePanel>

              <GamePanel title="Next Queue">
                <div className="grid grid-cols-2 gap-3">
                  {state.nextQueue.slice(0, 6).map((piece, index) => (
                    <motion.div
                      key={`${piece}-${index}`}
                      className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <MiniPiece type={piece} />
                    </motion.div>
                  ))}
                </div>
              </GamePanel>

              <GamePanel title="Hold">
                <div className="flex h-20 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10">
                  {state.holdPiece ? (
                    <div className="flex flex-col items-center gap-2">
                      <MiniPiece type={state.holdPiece} />
                      <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                        {state.canHold ? "Ready" : "Locked"}
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-full border border-dashed border-white/20 px-6 py-1 text-xs uppercase tracking-[0.4em] text-white/40">
                      Empty
                    </span>
                  )}
                </div>
              </GamePanel>

              <GamePanel title="Analytics">
                <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                  <StatLine label="Singles" value={state.stats.singles} />
                  <StatLine label="Doubles" value={state.stats.doubles} />
                  <StatLine label="Triples" value={state.stats.triples} />
                  <StatLine label="Tetrises" value={state.stats.tetrises} />
                  <StatLine label="Combos" value={state.stats.combos} />
                  <StatLine label="Max Combo" value={state.stats.maxCombo} />
                </div>
              </GamePanel>
            </div>
          </div>

          <div className="relative mt-6 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
              {CONTROL_HINTS.map((hint) => (
                <div key={hint.label} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="uppercase tracking-[0.4em] text-white/50">{hint.label}</span>
                  <span className="text-white/70">•</span>
                  <span className="flex gap-1 text-white">
                    {hint.keys.map((key) => (
                      <span key={key} className="rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px]">
                        {key}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {state.status === "idle" && (
                <NeonButton onClick={startGame} data-testid="start-game">
                  Initiate Play
                </NeonButton>
              )}
              {state.status === "playing" && (
                <NeonButton onClick={() => dispatch({ type: "PAUSE_TOGGLE" })}>Pause</NeonButton>
              )}
              {state.status === "paused" && (
                <NeonButton onClick={() => dispatch({ type: "PAUSE_TOGGLE" })}>Resume</NeonButton>
              )}
              {state.status === "gameover" && (
                <NeonButton onClick={startGame}>Restart</NeonButton>
              )}
              <button
                onClick={() => setMusicEnabled((prev) => !prev)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.35em] transition",
                  musicEnabled
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/60 hover:text-white/90"
                )}
              >
                {musicEnabled ? "Music On" : "Music Off"}
              </button>
              <button
                onClick={() => setEffectsEnabled((prev) => !prev)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.35em] transition",
                  effectsEnabled
                    ? "border-sky-300/40 bg-sky-400/10 text-sky-200"
                    : "border-white/15 bg-white/5 text-white/60 hover:text-white/90"
                )}
              >
                {effectsEnabled ? "FX On" : "FX Off"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {state.status === "paused" && (
              <motion.div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="glass-panel flex w-64 flex-col items-center gap-3 p-6 text-center"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <span className="text-sm uppercase tracking-[0.4em] text-white/60">Paused</span>
                  <h3 className="font-display text-xl text-white">Breather Mode</h3>
                  <p className="text-sm text-white/70">Tap resume or press P to dive back into the neon flow.</p>
                  <NeonButton onClick={() => dispatch({ type: "PAUSE_TOGGLE" })}>Resume</NeonButton>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {state.status === "gameover" && (
              <motion.div
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="glass-panel flex w-[320px] flex-col items-center gap-4 p-6 text-center"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <span className="text-sm uppercase tracking-[0.4em] text-white/60">Game Over</span>
                  <h3 className="font-display text-2xl text-white">Neon Crash</h3>
                  <p className="text-sm text-white/70">
                    Score {formatNumber(state.score)} • Level {state.level} • Lines {state.lines}
                  </p>
                  {state.score >= highScore && (
                    <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-amber-100 shadow-neon">
                      <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(253,224,71,0.6)]" />
                      New High Score
                    </div>
                  )}
                  <NeonButton onClick={startGame}>Restart</NeonButton>
                  <div className="grid w-full grid-cols-2 gap-2 text-left text-xs text-white/60">
                    <span>Singles</span>
                    <span className="text-right text-white/80">{state.stats.singles}</span>
                    <span>Doubles</span>
                    <span className="text-right text-white/80">{state.stats.doubles}</span>
                    <span>Triples</span>
                    <span className="text-right text-white/80">{state.stats.triples}</span>
                    <span>Tetrises</span>
                    <span className="text-right text-white/80">{state.stats.tetrises}</span>
                    <span>Max Combo</span>
                    <span className="text-right text-white/80">{state.stats.maxCombo}</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <audio
            ref={musicRef}
            loop
            preload="auto"
            src="https://cdn.pixabay.com/download/audio/2023/03/23/audio_aa71983c1d.mp3?filename=cyberpunk-moonlight-141138.mp3"
          />
        </div>
      </div>

      <aside className="flex flex-col gap-6">
        <GamePanel title="Live Feed">
          <div className="flex flex-col gap-4 text-sm text-white/70">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <span className="text-xs uppercase tracking-[0.35em] text-white/60">Speed</span>
                <p className="font-display text-lg text-white">
                  {(1000 / state.dropDelay).toFixed(1)} <span className="text-xs text-white/60">pps</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-[0.35em] text-white/60">Timer</span>
                <p className="font-display text-lg text-white">{state.status === "idle" ? "00:00" : "~"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                <span className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">Streak</span>
                <p className="font-display text-2xl text-emerald-100">{state.combo >= 0 ? `x${state.combo}` : "—"}</p>
              </div>
              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3">
                <span className="text-xs uppercase tracking-[0.3em] text-sky-200/80">Lines</span>
                <p className="font-display text-2xl text-sky-100">{state.lines}</p>
              </div>
            </div>
          </div>
        </GamePanel>

        <GamePanel title="Game Modes">
          <div className="grid gap-3 text-sm text-white/70">
            <ModeCard
              title="Arcade Surge"
              subtitle="Classic score chase with escalating synthwave intensity."
              active
            />
            <ModeCard
              title="Zen Flow"
              subtitle="Relaxed pacing with adaptive ambient soundtrack."
            />
            <ModeCard
              title="Hyper Blitz"
              subtitle="Supercharged drop speeds and combo multipliers."
            />
          </div>
        </GamePanel>

        <GamePanel title="Abilities">
          <div className="grid gap-3 text-sm text-white/70">
            <AbilityCard
              title="Lumina Hold"
              description="Strategic piece vaulting with instant swap and cooldown lock."
              active={Boolean(state.holdPiece)}
            />
            <AbilityCard
              title="Spectral Ghost"
              description="Projected landing previews for pro precision placement."
              active
            />
            <AbilityCard
              title="Combo Flux"
              description="Reactive scoring multiplier that escalates on streaks."
              active={state.combo > 0}
            />
          </div>
        </GamePanel>

        <GamePanel title="Global Share">
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <p>
              Tag <span className="font-semibold text-indigo-200">#LuminaTetris</span> and sync your high scores across the neon
              arena. Global leaderboards ignite soon.
            </p>
            <div className="flex gap-3">
              <SocialButton label="Share Highlight" />
              <SocialButton label="Challenge Link" />
            </div>
          </div>
        </GamePanel>
      </aside>
    </div>
  );
};

const ModeCard = ({ title, subtitle, active }: { title: string; subtitle: string; active?: boolean }) => (
  <div
    className={clsx(
      "flex flex-col gap-1 rounded-2xl border px-4 py-3 transition",
      active
        ? "border-purple-300/30 bg-purple-400/10 shadow-[0_10px_30px_rgba(139,92,246,0.25)]"
        : "border-white/10 bg-white/5 hover:border-white/20"
    )}
  >
    <div className="flex items-center justify-between">
      <h4 className="font-display text-sm text-white">{title}</h4>
      {active && <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.4em] text-purple-100">Live</span>}
    </div>
    <p className="text-xs text-white/70">{subtitle}</p>
  </div>
);

const AbilityCard = ({ title, description, active }: { title: string; description: string; active?: boolean }) => (
  <div
    className={clsx(
      "rounded-2xl border px-4 py-3 transition",
      active
        ? "border-emerald-300/30 bg-emerald-400/10 shadow-[0_10px_25px_rgba(52,211,153,0.2)]"
        : "border-white/10 bg-white/5"
    )}
  >
    <div className="flex items-center justify-between">
      <h4 className="font-display text-sm text-white">{title}</h4>
      <span
        className={clsx(
          "h-2 w-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.45)]",
          active ? "bg-emerald-300" : "bg-white/30"
        )}
      />
    </div>
    <p className="mt-1 text-xs text-white/70">{description}</p>
  </div>
);

const StatLine = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
    <span className="text-xs uppercase tracking-[0.35em] text-white/60">{label}</span>
    <span className="font-display text-sm text-white">{value}</span>
  </div>
);

const MiniPiece = ({ type }: { type: TetrominoKey }) => {
  const matrix = getPieceMatrix(type, 0);
  return (
    <div className="grid gap-1">
      {matrix.map((row, y) => (
        <div key={y} className="flex gap-1">
          {row.map((cell, x) => (
            <div
              key={x}
              className={clsx(
                "h-4 w-4 rounded-sm border border-white/10 bg-gradient-to-br",
                cell ? PIECE_COLORS[type] : "bg-transparent"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const SocialButton = ({ label }: { label: string }) => (
  <button className="flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-white/70 transition hover:border-white/30 hover:text-white">
    {label}
  </button>
);

export default TetrisExperience;
