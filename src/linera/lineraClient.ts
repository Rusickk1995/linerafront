// src/linera/lineraClient.ts
//
// ЕДИНЫЙ клиент для твоего Linera-покера:
//
// 1) Read-only запросы в service.rs (PokerService::handle_query):
//    - fetchTable / fetchTables
//    - fetchTournament / fetchTournaments / fetchTournamentTables
//
// 2) Команды в contract.rs (Operation::Command(Command)):
//    - createTournament / registerToTournament / ... / sendPlayerAction
//
// Сетевые детали максимально абстрактные:
// - VITE_LINERA_SERVICE_URL  -> HTTP endpoint, который прокидывает JSON в PokerService
// - VITE_LINERA_COMMAND_URL  -> HTTP endpoint, который принимает JSON-команды и шлёт их в PokerContract
//
// Дальше ты сам решаешь, чем эти URL будут: прямой прокси к `linera service`,
// небольшой backend на Node/Rust, или что-то своё.

import {
  OnChainTableViewDto,
  OnChainTournamentViewDto,
} from "../types/onchain";
import type { TournamentConfig } from "../types/poker";

// ---------- ENV & вспомогалки ----------

const SERVICE_URL =
  (import.meta as any).env.VITE_LINERA_SERVICE_URL as string | undefined;
const COMMAND_URL =
  (import.meta as any).env.VITE_LINERA_COMMAND_URL as string | undefined;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing env variable ${name}. ` +
        `Configure import.meta.env.${name} in your Vite setup (.env.local).`
    );
  }
  return value;
}

async function postJson<TResponse>(
  url: string,
  body: unknown
): Promise<TResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Linera HTTP error ${res.status}: ${res.statusText}\n${text}`
    );
  }

  return (await res.json()) as TResponse;
}

// Вспомогалки, чтобы явно разделить read-only и команды.
async function callService<TResponse>(payload: unknown): Promise<TResponse> {
  const url = requireEnv("VITE_LINERA_SERVICE_URL", SERVICE_URL);
  return postJson<TResponse>(url, payload);
}

async function callCommand<TResponse>(payload: unknown): Promise<TResponse> {
  const url = requireEnv("VITE_LINERA_COMMAND_URL", COMMAND_URL);
  return postJson<TResponse>(url, payload);
}

// ---------- Типы команд (frontend-сторона) ----------

// Игровое действие игрока.
// Это фронтовое представление; на бэке ты уже сопоставишь с
// poker_engine::engine::actions::PlayerActionKind.
export type PlayerActionKindUi =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in";

// Общий формат payload'а для TableCommand.
export interface PlayerActionCommandPayload {
  table_id: number;
  action: PlayerActionKindUi;
  amount?: number;
}

// Общий формат payload'а для TournamentCommand.
// Мы осознанно делаем его простым и вербозным:
// на стороне Rust можно спокойно распарсить это как serde_json::Value
// и уже дальше сопоставить с enum TournamentCommand.
type TournamentCommandType =
  | "create_tournament"
  | "register_player"
  | "unregister_player"
  | "start_tournament"
  | "advance_level"
  | "close_tournament";

interface TournamentCommandPayloadBase {
  kind: "tournament_command";
  command_type: TournamentCommandType;
}

interface CreateTournamentPayload extends TournamentCommandPayloadBase {
  command_type: "create_tournament";
  // Конфиг из UI; на Rust-стороне можно иметь свой TournamentConfig,
  // и сделать From<UiTournamentConfig> для удобного маппинга.
  ui_config: TournamentConfig;
}

interface SimpleTournamentIdPayload extends TournamentCommandPayloadBase {
  tournament_id: number;
}

type RegisterTournamentPayload = SimpleTournamentIdPayload & {
  command_type: "register_player";
};

type UnregisterTournamentPayload = SimpleTournamentIdPayload & {
  command_type: "unregister_player";
};

type StartTournamentPayload = SimpleTournamentIdPayload & {
  command_type: "start_tournament";
};

type AdvanceLevelPayload = SimpleTournamentIdPayload & {
  command_type: "advance_level";
};

type CloseTournamentPayload = SimpleTournamentIdPayload & {
  command_type: "close_tournament";
};

type TournamentCommandPayload =
  | CreateTournamentPayload
  | RegisterTournamentPayload
  | UnregisterTournamentPayload
  | StartTournamentPayload
  | AdvanceLevelPayload
  | CloseTournamentPayload;

// ---------- READ-ONLY ЧАСТЬ (service.rs) ----------

// 1) Один стол по table_id
export async function fetchTable(
  tableId: number
): Promise<OnChainTableViewDto> {
  // Это ровно то, что ждёт твой PokerService::handle_query:
  //   { "type": "table", "table_id": <id> }
  return callService<OnChainTableViewDto>({
    type: "table",
    table_id: tableId,
  });
}

// 2) Все столы
export async function fetchTables(): Promise<OnChainTableViewDto[]> {
  return callService<OnChainTableViewDto[]>({
    type: "tables",
  });
}

// 3) Все турниры
export async function fetchTournaments(): Promise<OnChainTournamentViewDto[]> {
  return callService<OnChainTournamentViewDto[]>({
    type: "tournaments",
  });
}

// 4) Один турнир по id
export async function fetchTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  return callService<OnChainTournamentViewDto>({
    type: "tournament_by_id",
    tournament_id: tournamentId,
  });
}

// 5) Столы конкретного турнира
export async function fetchTournamentTables(
  tournamentId: number
): Promise<OnChainTableViewDto[]> {
  return callService<OnChainTableViewDto[]>({
    type: "tournament_tables",
    tournament_id: tournamentId,
  });
}

// ---------- МУТАЦИИ (contract.rs → Command) ----------
//
// Тут мы не лезем в детали BCS/GraphQL Linera.
// Клиент формирует "честный" JSON payload, в котором:
//  - явно указано, что это tournament_command или table_command,
//  - указана команда, id, и т.п.
// На стороне Rust ты можешь:
//  - поднять маленький HTTP-прокси;
//  - распарсить JSON в enum Command / TournamentCommand;
//  - передать в linera client / wallet как Operation::Command(Command).

// 6) Создать турнир
export async function createTournament(
  config: TournamentConfig
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "create_tournament",
    ui_config: config,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 7) Зарегистрироваться в турнире (по текущему аккаунту)
export async function registerToTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "register_player",
    tournament_id: tournamentId,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 8) Отменить регистрацию
export async function unregisterFromTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "unregister_player",
    tournament_id: tournamentId,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 9) Запустить турнир
export async function startTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "start_tournament",
    tournament_id: tournamentId,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 10) Продвинуть уровень блайндов
export async function advanceTournamentLevel(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "advance_level",
    tournament_id: tournamentId,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 11) Закрыть турнир (итоговое завершение)
export async function closeTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const payload: TournamentCommandPayload = {
    kind: "tournament_command",
    command_type: "close_tournament",
    tournament_id: tournamentId,
  };

  return callCommand<OnChainTournamentViewDto>(payload);
}

// 12) Игровое действие за столом
export async function sendPlayerAction(
  tableId: number,
  action: PlayerActionKindUi,
  amount?: number
): Promise<OnChainTableViewDto> {
  const payload: PlayerActionCommandPayload & {
    kind: "table_command";
  } = {
    kind: "table_command",
    table_id: tableId,
    action,
    amount,
  };

  return callCommand<OnChainTableViewDto>(payload);
}
