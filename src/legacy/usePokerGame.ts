// src/hooks/usePokerGame.ts

import { useMemo, useState } from "react";
import { Card, createShuffledDeck } from "./poker/deck";
import {
  evaluateBestHand,
  compareHands,
  EvaluatedHand,
} from "./poker/handEvaluator";
import type { TournamentConfig } from "../types/poker";

export type Street =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export type PlayerState = {
  id: number;
  seatIndex: number;
  name: string;
  stack: number;
  holeCards: Card[];
  hasFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  isHero: boolean;
  bestHand?: EvaluatedHand;
};

export type SidePot = {
  eligiblePlayerIds: number[];
  amount: number;
};

export type TableState = {
  street: Street;
  pot: number;
  sidePots: SidePot[];
  board: Card[];
  currentPlayerIndex: number;
  dealerSeatIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  minRaise: number;
  lastAggressivePlayerIndex: number | null;
  lastAggressiveAction: "bet" | "raise" | null;
  lastAggressiveAmount: number;
  streetStartPlayerIndex: number;
  isHandComplete: boolean;
  winners: { playerId: number; amountWon: number }[];
};

export type ActionType = "fold" | "call" | "check" | "bet" | "raise" | "allin";

export type PlayerAction = {
  playerId: number;
  type: ActionType;
  amount?: number;
  street: Street;
};

export type ActionLogEntry = {
  handNumber: number;
  index: number;
  action: PlayerAction;
};

export type HandHistoryEntry = {
  handNumber: number;
  board: Card[];
  pot: number;
  winners: { playerId: number; amountWon: number }[];
};

/* ---------- Вычисление размеров из конфига ---------- */

function deriveTableSize(config?: TournamentConfig): number {
  if (!config) return 9;

  const anyCfg = config as any;

  // уже число
  if (typeof anyCfg.tableSize === "number") return anyCfg.tableSize;
  if (typeof anyCfg.maxPlayers === "number") return anyCfg.maxPlayers;

  // Возможные строковые варианты
  const opt: unknown =
    anyCfg.tableSizeOption ??
    anyCfg.tableSize ??
    anyCfg.table_type ??
    anyCfg.table ??
    "";

  if (typeof opt === "number") return opt;

  if (typeof opt === "string") {
    const lower = opt.toLowerCase();
    if (lower.includes("9")) return 9;
    if (lower.includes("6")) return 6;
    if (lower.includes("2") || lower.includes("heads")) return 2;
  }

  return 9;
}

function deriveStartingStack(config?: TournamentConfig): number {
  if (!config) return 20000;

  const anyCfg = config as any;
  const value =
    anyCfg.startingStack ??
    anyCfg.stack ??
    anyCfg.initialStack ??
    anyCfg.start_stack;

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 20000;
  return n;
}

/* ---------- Вспомогательные функции ---------- */

function createInitialPlayers(
  tableSize: number,
  startingStack: number
): PlayerState[] {
  const result: PlayerState[] = [];
  for (let i = 0; i < tableSize; i++) {
    result.push({
      id: i + 1,
      seatIndex: i,
      name: i === 0 ? "Hero" : `Bot ${i}`,
      stack: startingStack,
      holeCards: [],
      hasFolded: false,
      isAllIn: false,
      currentBet: 0,
      isHero: i === 0,
    });
  }
  return result;
}

function getNextIndex(players: PlayerState[], currentIndex: number): number {
  const n = players.length;
  return (currentIndex + 1) % n;
}

function getActivePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter((p) => !p.hasFolded && p.stack + p.currentBet > 0);
}

function getFirstActiveIndexPreflop(
  players: PlayerState[],
  bigBlindIndex: number
): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (bigBlindIndex + i) % n;
    const p = players[idx];
    if (!p.hasFolded && !p.isAllIn && p.stack > 0) {
      return idx;
    }
  }
  return bigBlindIndex;
}

function getFirstActiveIndexPostflop(
  players: PlayerState[],
  smallBlindIndex: number,
  bigBlindIndex: number
): number {
  const n = players.length;
  for (let i = 0; i < n; i++) {
    const idx = (smallBlindIndex + i) % n;
    const p = players[idx];
    if (!p.hasFolded && p.stack > 0) {
      return idx;
    }
  }
  return bigBlindIndex;
}

function dealBoard(deck: Card[], street: Street): Card[] {
  if (street === "flop") return deck.slice(0, 3);
  if (street === "turn") return deck.slice(0, 4);
  if (street === "river") return deck.slice(0, 5);
  return [];
}

function collectBetsIntoPot(
  players: PlayerState[],
  existingPot: number
): { players: PlayerState[]; pot: number } {
  let pot = existingPot;
  const updated = players.map((p) => {
    if (p.currentBet > 0) {
      pot += p.currentBet;
      return { ...p, currentBet: 0 };
    }
    return p;
  });
  return { players: updated, pot };
}

function createSidePots(
  players: PlayerState[],
  mainPot: number
): { sidePots: SidePot[]; mainPot: number } {
  // Пока без сложных сайд-потов
  return { sidePots: [], mainPot };
}

function isBettingRoundComplete(
  players: PlayerState[],
  tableState: TableState,
  lastActionIndex: number
): boolean {
  const active = getActivePlayers(players);
  if (active.length <= 1) return true;

  const currentBet = tableState.currentBet;

  const allMatched = active.every(
    (p) => p.currentBet === currentBet || p.isAllIn
  );
  if (!allMatched) return false;

  if (tableState.lastAggressivePlayerIndex === null) {
    return true;
  }

  const nextIndex = getNextIndex(players, lastActionIndex);
  return nextIndex === tableState.lastAggressivePlayerIndex;
}

function parseNumberOr(value: string, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/* ---------- Переход улиц / шоудаун ---------- */

function advanceStreetInternal(
  players: PlayerState[],
  tableState: TableState,
  deck: Card[]
): { players: PlayerState[]; tableState: TableState } {
  let nextStreet: Street = tableState.street;

  if (tableState.street === "preflop") nextStreet = "flop";
  else if (tableState.street === "flop") nextStreet = "turn";
  else if (tableState.street === "turn") nextStreet = "river";
  else if (tableState.street === "river") nextStreet = "showdown";

  const { players: afterCollect, pot } = collectBetsIntoPot(
    players,
    tableState.pot
  );

  if (nextStreet === "showdown") {
    const activePlayers = getActivePlayers(afterCollect);
    const board = dealBoard(deck, "river");

    const evaluated = activePlayers.map((p) => ({
      player: p,
      bestHand: evaluateBestHand(p.holeCards, board),
    }));

    let best: EvaluatedHand | null = null;
    let winners: { playerId: number; amountWon: number }[] = [];

    for (const { player, bestHand } of evaluated) {
      if (!best) {
        best = bestHand;
        winners = [{ playerId: player.id, amountWon: 0 }];
      } else {
        const cmp = compareHands(bestHand, best);
        if (cmp > 0) {
          best = bestHand;
          winners = [{ playerId: player.id, amountWon: 0 }];
        } else if (cmp === 0) {
          winners.push({ playerId: player.id, amountWon: 0 });
        }
      }
    }

    const share =
      winners.length > 0 ? Math.floor(pot / winners.length) : pot;
    let remainder =
      winners.length > 0 ? pot - share * winners.length : 0;

    const updatedPlayers = afterCollect.map((p) => {
      const wIdx = winners.findIndex((w) => w.playerId === p.id);
      if (wIdx >= 0) {
        let winAmount = share;
        if (remainder > 0) {
          winAmount += 1;
          remainder -= 1;
        }
        winners[wIdx].amountWon = winAmount;
        return { ...p, stack: p.stack + winAmount, bestHand: undefined };
      }
      return { ...p, bestHand: undefined };
    });

    const showdownPlayers = updatedPlayers.map((p) => {
      const isWinner = winners.some((w) => w.playerId === p.id);
      if (!isWinner && !p.hasFolded) {
        return {
          ...p,
          bestHand: evaluateBestHand(p.holeCards, board),
        };
      }
      return p;
    });

    const nextDealer = getNextIndex(showdownPlayers, tableState.dealerSeatIndex);
    const nextSB = getNextIndex(showdownPlayers, nextDealer);
    const nextBB = getNextIndex(showdownPlayers, nextSB);

    const reset = showdownPlayers.map((p) => ({
      ...p,
      hasFolded: false,
      isAllIn: false,
      currentBet: 0,
      holeCards: [],
      bestHand: undefined,
    }));

    return {
      players: reset,
      tableState: {
        ...tableState,
        street: "waiting",
        pot: 0,
        sidePots: [],
        board,
        currentPlayerIndex: nextSB,
        dealerSeatIndex: nextDealer,
        smallBlindIndex: nextSB,
        bigBlindIndex: nextBB,
        currentBet: 0,
        minRaise: tableState.minRaise,
        lastAggressivePlayerIndex: null,
        lastAggressiveAction: null,
        lastAggressiveAmount: 0,
        streetStartPlayerIndex: nextSB,
        isHandComplete: true,
        winners,
      },
    };
  }

  const board = dealBoard(deck, nextStreet);
  const { sidePots, mainPot } = createSidePots(afterCollect, pot);

  let nextCurrentIndex: number;

  if (nextStreet === "flop" || nextStreet === "turn" || nextStreet === "river") {
    nextCurrentIndex = getFirstActiveIndexPostflop(
      afterCollect,
      tableState.smallBlindIndex,
      tableState.bigBlindIndex
    );
  } else {
    nextCurrentIndex = tableState.currentPlayerIndex;
  }

  return {
    players: afterCollect,
    tableState: {
      ...tableState,
      street: nextStreet,
      board,
      pot: mainPot,
      sidePots,
      currentPlayerIndex: nextCurrentIndex,
      currentBet: 0,
      lastAggressivePlayerIndex: null,
      lastAggressiveAction: null,
      lastAggressiveAmount: 0,
      streetStartPlayerIndex: nextCurrentIndex,
    },
  };
}

/* ---------- Применение действия ---------- */

function applyActionInternal(
  players: PlayerState[],
  tableState: TableState,
  action: PlayerAction
): { players: PlayerState[]; tableState: TableState; nextIndex: number } {
  const idx = players.findIndex((p) => p.id === action.playerId);
  if (idx < 0) {
    return { players, tableState, nextIndex: tableState.currentPlayerIndex };
  }

  const player = players[idx];
  const updatedPlayers = [...players];
  const updatedTable: TableState = { ...tableState };

  const active = getActivePlayers(players);

  if (action.type === "fold") {
    updatedPlayers[idx] = { ...player, hasFolded: true };
  } else if (action.type === "check") {
    if (tableState.currentBet !== player.currentBet) {
      // некорректный чек — игнорируем
    }
  } else if (action.type === "call") {
    const toCall = tableState.currentBet - player.currentBet;
    const callAmount = Math.min(toCall, player.stack);
    updatedPlayers[idx] = {
      ...player,
      stack: player.stack - callAmount,
      currentBet: player.currentBet + callAmount,
      isAllIn: player.stack - callAmount === 0,
    };
  } else if (action.type === "bet" || action.type === "raise") {
    const amount = action.amount ?? 0;
    const toCall = tableState.currentBet - player.currentBet;
    const total = player.currentBet + toCall + amount;

    const maxBet = player.stack + player.currentBet;
    const finalBet = Math.min(maxBet, total);
    const put = finalBet - player.currentBet;

    updatedPlayers[idx] = {
      ...player,
      stack: player.stack - put,
      currentBet: finalBet,
      isAllIn: player.stack - put === 0,
    };

    const isNewBet = tableState.currentBet === 0;
    const newCurrentBet = finalBet;
    const raiseAmount = newCurrentBet - tableState.currentBet;

    updatedTable.currentBet = newCurrentBet;
    if (!isNewBet) {
      updatedTable.minRaise = Math.max(tableState.minRaise, raiseAmount);
    } else {
      updatedTable.minRaise = raiseAmount;
    }
    updatedTable.lastAggressivePlayerIndex = idx;
    updatedTable.lastAggressiveAction = isNewBet ? "bet" : "raise";
    updatedTable.lastAggressiveAmount = raiseAmount;
  } else if (action.type === "allin") {
    const allInTotal = player.stack + player.currentBet;

    if (allInTotal > tableState.currentBet) {
      const raiseAmount = allInTotal - tableState.currentBet;
      updatedTable.minRaise = Math.max(tableState.minRaise, raiseAmount);
      updatedTable.currentBet = allInTotal;
      updatedTable.lastAggressivePlayerIndex = idx;
      updatedTable.lastAggressiveAction =
        tableState.currentBet === 0 ? "bet" : "raise";
      updatedTable.lastAggressiveAmount = raiseAmount;
    }

    updatedPlayers[idx] = {
      ...player,
      stack: 0,
      currentBet: allInTotal,
      isAllIn: true,
    };
  }

  const remaining = getActivePlayers(updatedPlayers);
  if (remaining.length === 1) {
    const { players: afterCollect, pot } = collectBetsIntoPot(
      updatedPlayers,
      updatedTable.pot
    );
    const winner = remaining[0];
    const wIdx = afterCollect.findIndex((p) => p.id === winner.id);

    const withWinner = [...afterCollect];
    withWinner[wIdx] = {
      ...withWinner[wIdx],
      stack: withWinner[wIdx].stack + pot,
    };

    const nextDealer = getNextIndex(withWinner, updatedTable.dealerSeatIndex);
    const nextSB = getNextIndex(withWinner, nextDealer);
    const nextBB = getNextIndex(withWinner, nextSB);

    return {
      players: withWinner.map((p) => ({
        ...p,
        hasFolded: false,
        isAllIn: false,
        currentBet: 0,
        holeCards: [],
        bestHand: undefined,
      })),
      tableState: {
        ...updatedTable,
        street: "waiting",
        pot: 0,
        sidePots: [],
        board: [],
        currentPlayerIndex: nextSB,
        dealerSeatIndex: nextDealer,
        smallBlindIndex: nextSB,
        bigBlindIndex: nextBB,
        currentBet: 0,
        lastAggressivePlayerIndex: null,
        lastAggressiveAction: null,
        lastAggressiveAmount: 0,
        streetStartPlayerIndex: nextSB,
        isHandComplete: true,
        winners: [{ playerId: winner.id, amountWon: pot }],
      },
      nextIndex: nextSB,
    };
  }

  const lastActionIndex =
    active.length > 0
      ? players.findIndex((p) => p.id === action.playerId)
      : tableState.currentPlayerIndex;

  let nextIndex = getNextIndex(updatedPlayers, lastActionIndex);

  if (
    isBettingRoundComplete(updatedPlayers, updatedTable, lastActionIndex)
  ) {
    return {
      players: updatedPlayers,
      tableState: updatedTable,
      nextIndex: -1,
    };
  }

  if (getActivePlayers(updatedPlayers).length <= 1) {
    return {
      players: updatedPlayers,
      tableState: updatedTable,
      nextIndex: -1,
    };
  }

  for (let i = 0; i < updatedPlayers.length; i++) {
    const idx2 = (lastActionIndex + 1 + i) % updatedPlayers.length;
    const p = updatedPlayers[idx2];
    if (!p.hasFolded && p.stack > 0 && !p.isAllIn) {
      nextIndex = idx2;
      break;
    }
  }

  return { players: updatedPlayers, tableState: updatedTable, nextIndex };
}

/* ---------- Сам хук ---------- */

export function usePokerGame(config?: TournamentConfig) {
  const tableSize = deriveTableSize(config);
  const startingStack = deriveStartingStack(config);
  const smallBlind = 100;
  const bigBlind = 200;

  const [deck, setDeck] = useState<Card[]>(() => createShuffledDeck());
  const [players, setPlayers] = useState<PlayerState[]>(() =>
    createInitialPlayers(tableSize, startingStack)
  );

  const [tableState, setTableState] = useState<TableState>(() => {
    const dealerSeatIndex = 0;
    const smallBlindIndex = (dealerSeatIndex + 1) % tableSize;
    const bigBlindIndex = (dealerSeatIndex + 2) % tableSize;

    return {
      street: "waiting",
      pot: 0,
      sidePots: [],
      board: [],
      currentPlayerIndex: smallBlindIndex,
      dealerSeatIndex,
      smallBlindIndex,
      bigBlindIndex,
      currentBet: bigBlind,
      minRaise: bigBlind,
      lastAggressivePlayerIndex: null,
      lastAggressiveAction: null,
      lastAggressiveAmount: 0,
      streetStartPlayerIndex: smallBlindIndex,
      isHandComplete: true,
      winners: [],
    };
  });

  const [handNumber, setHandNumber] = useState(1);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [handHistory, setHandHistory] = useState<HandHistoryEntry[]>([]);

  const [heroBetSize, setHeroBetSize] = useState(bigBlind * 2);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoPlayBots, setAutoPlayBots] = useState(true);
  const [autoDealNewHand, setAutoDealNewHand] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const heroPlayer = useMemo(
    () => players.find((p) => p.isHero) ?? players[0],
    [players]
  );

  const isHeroTurn =
    !!heroPlayer &&
    players[tableState.currentPlayerIndex]?.id === heroPlayer.id &&
    !heroPlayer.hasFolded &&
    !heroPlayer.isAllIn &&
    tableState.street !== "waiting" &&
    !tableState.isHandComplete;

  const heroHasToCall =
    !!heroPlayer && tableState.currentBet > heroPlayer.currentBet;

  const heroMaxBet =
    heroPlayer?.stack && heroPlayer.currentBet !== undefined
      ? heroPlayer.stack + heroPlayer.currentBet
      : 0;

  const formattedBoard = tableState.board;

  const debugInfo = useMemo(
    () => ({ tableState, players, heroPlayer, handNumber }),
    [tableState, players, heroPlayer, handNumber]
  );

  const handleBetSizeInputChange = (raw: string) => {
    setHeroBetSize((prev) => parseNumberOr(raw, prev));
  };

  const handleStartHand = () => {
    const resetPlayers = players.map((p) => ({
      ...p,
      holeCards: [],
      hasFolded: false,
      isAllIn: false,
      currentBet: 0,
      bestHand: undefined,
    }));

    const newDeck = createShuffledDeck();

    const dealt = resetPlayers.map((p, index) => {
      const c1 = newDeck[index * 2];
      const c2 = newDeck[index * 2 + 1];
      return { ...p, holeCards: [c1, c2] };
    });

    const deckAfter = newDeck.slice(tableSize * 2);

    const dealerSeatIndex = tableState.dealerSeatIndex;
    const smallBlindIndex = (dealerSeatIndex + 1) % tableSize;
    const bigBlindIndex = (dealerSeatIndex + 2) % tableSize;

    const sbPlayer = dealt[smallBlindIndex];
    const bbPlayer = dealt[bigBlindIndex];

    const sbAmount = Math.min(smallBlind, sbPlayer.stack);
    const bbAmount = Math.min(bigBlind, bbPlayer.stack);

    const withBlinds = dealt.map((p, idx) => {
      if (idx === smallBlindIndex) {
        return {
          ...p,
          stack: p.stack - sbAmount,
          currentBet: sbAmount,
          isAllIn: p.stack - sbAmount === 0,
        };
      }
      if (idx === bigBlindIndex) {
        return {
          ...p,
          stack: p.stack - bbAmount,
          currentBet: bbAmount,
          isAllIn: p.stack - bbAmount === 0,
        };
      }
      return p;
    });

    const startPlayerIndex = getFirstActiveIndexPreflop(
      withBlinds,
      bigBlindIndex
    );

    const newTableState: TableState = {
      ...tableState,
      street: "preflop",
      pot: 0,
      sidePots: [],
      board: [],
      currentPlayerIndex: startPlayerIndex,
      smallBlindIndex,
      bigBlindIndex,
      currentBet: bbAmount,
      minRaise: bigBlind,
      lastAggressivePlayerIndex: bigBlindIndex,
      lastAggressiveAction: "bet",
      lastAggressiveAmount: bigBlind,
      streetStartPlayerIndex: startPlayerIndex,
      isHandComplete: false,
      winners: [],
    };

    setPlayers(withBlinds);
    setDeck(deckAfter);
    setTableState(newTableState);

    const firstToAct = withBlinds[startPlayerIndex];
    if (autoPlayBots && firstToAct && !firstToAct.isHero) {
      setTimeout(() => {
        runBots(withBlinds, newTableState);
      }, 300);
    }
  };

  const performAction = (action: PlayerAction) => {
    const { players: newPlayers, tableState: newTable, nextIndex } =
      applyActionInternal(players, tableState, action);

    const log: ActionLogEntry = {
      handNumber,
      index: actionLogs.length,
      action,
    };

    setPlayers(newPlayers);
    setTableState(newTable);
    setActionLogs((prev) => [...prev, log]);

    if (newTable.isHandComplete) {
      setHandHistory((prev) => [
        ...prev,
        {
          handNumber,
          board: newTable.board,
          pot: newTable.pot,
          winners: newTable.winners,
        },
      ]);
      setHandNumber((prev) => prev + 1);

      if (autoDealNewHand) {
        setTimeout(() => {
          setDeck(createShuffledDeck());
          handleStartHand();
        }, 500);
      }
      return;
    }

    if (nextIndex === -1) {
      const { players: afterPlayers, tableState: afterTable } =
        advanceStreetInternal(newPlayers, newTable, deck);

      setPlayers(afterPlayers);
      setTableState(afterTable);

      if (afterTable.street === "waiting") {
        if (autoDealNewHand) {
          setTimeout(() => {
            setDeck(createShuffledDeck());
            handleStartHand();
          }, 500);
        }
        return;
      }

      if (autoAdvance && autoPlayBots && !afterTable.isHandComplete) {
        setTimeout(() => {
          runBots(afterPlayers, afterTable);
        }, 15000);
      }
    } else {
      setTableState((prev) => ({
        ...prev,
        currentPlayerIndex: nextIndex,
      }));

      if (autoAdvance && autoPlayBots && !newTable.isHandComplete) {
        const cp = newPlayers[nextIndex];
        if (!cp.isHero) {
          setTimeout(() => {
            runBots(newPlayers, {
              ...newTable,
              currentPlayerIndex: nextIndex,
            });
          }, 300);
        }
      }
    }
  };

  const runBots = (playersIn: PlayerState[], tableIn: TableState) => {
    let ps = [...playersIn];
    let ts = { ...tableIn };

    for (let i = 0; i < ps.length; i++) {
      const current = ps[ts.currentPlayerIndex];
      if (!current || current.isHero) break;
      if (ts.isHandComplete || ts.street === "waiting") break;

      const toCall = ts.currentBet - current.currentBet;
      let act: PlayerAction;

      if (current.stack <= 0) {
        act = {
          playerId: current.id,
          type: "check",
          street: ts.street,
        };
      } else if (toCall === 0) {
        if (Math.random() < 0.1 && current.stack > ts.minRaise) {
          const raiseAmount = ts.minRaise;
          act = {
            playerId: current.id,
            type: "bet",
            amount: raiseAmount,
            street: ts.street,
          };
        } else {
          act = {
            playerId: current.id,
            type: "check",
            street: ts.street,
          };
        }
      } else {
        const potOdds = toCall / Math.max(1, ts.pot + toCall);
        if (potOdds < 0.25 || Math.random() < 0.6) {
          act = {
            playerId: current.id,
            type: "call",
            street: ts.street,
          };
        } else {
          act = {
            playerId: current.id,
            type: "fold",
            street: ts.street,
          };
        }
      }

      const { players: np, tableState: nt, nextIndex } =
        applyActionInternal(ps, ts, act);

      const log: ActionLogEntry = {
        handNumber,
        index: actionLogs.length,
        action: act,
      };

      setActionLogs((prev) => [...prev, log]);

      ps = np;
      ts = nt;

      if (ts.isHandComplete) {
        setPlayers(ps);
        setTableState(ts);
        setHandHistory((prev) => [
          ...prev,
          {
            handNumber,
            board: ts.board,
            pot: ts.pot,
            winners: ts.winners,
          },
        ]);
        setHandNumber((prev) => prev + 1);

        if (autoDealNewHand) {
          setTimeout(() => {
            setDeck(createShuffledDeck());
            handleStartHand();
          }, 500);
        }
        break;
      }

      if (nextIndex === -1) {
        const { players: afterPlayers, tableState: afterTable } =
          advanceStreetInternal(ps, ts, deck);
        ps = afterPlayers;
        ts = afterTable;

        if (afterTable.street === "waiting") {
          setPlayers(ps);
          setTableState(ts);
          if (autoDealNewHand) {
            setTimeout(() => {
              setDeck(createShuffledDeck());
              handleStartHand();
            }, 500);
          }
          break;
        }
      } else {
        ts.currentPlayerIndex = nextIndex;
      }
    }

    setPlayers(ps);
    setTableState(ts);
  };

  /* ---------- Хендлеры героя ---------- */

  const handleHeroFold = () => {
    if (!heroPlayer || tableState.street === "waiting") return;
    performAction({
      playerId: heroPlayer.id,
      type: "fold",
      street: tableState.street,
    });
  };

  const handleHeroCheckCall = () => {
    if (!heroPlayer || tableState.street === "waiting") return;
    if (tableState.currentBet === heroPlayer.currentBet) {
      performAction({
        playerId: heroPlayer.id,
        type: "check",
        street: tableState.street,
      });
    } else {
      performAction({
        playerId: heroPlayer.id,
        type: "call",
        street: tableState.street,
      });
    }
  };

  const handleHeroBetRaise = () => {
    if (!heroPlayer || tableState.street === "waiting") return;
    const type: ActionType =
      tableState.currentBet === heroPlayer.currentBet ? "bet" : "raise";
    const amount = heroBetSize;
    performAction({
      playerId: heroPlayer.id,
      type,
      amount,
      street: tableState.street,
    });
  };

  const handleHeroAllIn = () => {
    if (!heroPlayer || tableState.street === "waiting") return;
    performAction({
      playerId: heroPlayer.id,
      type: "allin",
      street: tableState.street,
    });
  };

  return {
    tableSize,
    smallBlind,
    bigBlind,
    players,
    tableState,
    formattedBoard,
    handNumber,
    heroPlayer,
    isHeroTurn,
    heroHasToCall,
    heroMaxBet,
    heroBetSize,
    handleBetSizeInputChange,
    handleStartHand,
    handleHeroFold,
    handleHeroCheckCall,
    handleHeroBetRaise,
    handleHeroAllIn,
    actionLogs,
    handHistory,
    debugInfo,
    debugMode,
    showHistory,
    setDebugMode,
    setShowHistory,
    autoAdvance,
    autoPlayBots,
    autoDealNewHand,
    setAutoAdvance,
    setAutoPlayBots,
    setAutoDealNewHand,
  };
}
