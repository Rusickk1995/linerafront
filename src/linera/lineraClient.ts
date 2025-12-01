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
// Сетевые детали абстрагированы через две переменные окружения:
//
//   VITE_LINERA_SERVICE_URL  -> HTTP endpoint, который принимает JSON-query
//                              и прокидывает его в PokerService::handle_query.
//
//   VITE_LINERA_COMMAND_URL  -> HTTP endpoint, который принимает JSON-command
//                              и прокидывает её в PokerContract::execute_operation.
//
// Всё, что ниже, настроено так, чтобы:
//
// - не падать по типовым мелким ошибкам;
// - максимально прозрачно логировать неожиданные ответы;
// - всегда возвращать фронту строго типизированный результат.

import type {
  OnChainTableViewDto,
  OnChainTournamentViewDto,
} from "../types/onchain";
import type { TournamentConfig } from "../types/poker";

// ============================================================================
//                ENV-ПЕРЕМЕННЫЕ И БАЗОВЫЕ ВСПОМОГАТЕЛЬНЫЕ Ф-ЦИИ
// ============================================================================

/**
 * URL для read-only запросов (PokerService).
 * Пример:
 *   http://localhost:8081/chains/<CHAIN_ID>/applications/<APP_ID>
 */
const SERVICE_URL =
  (import.meta as any).env.VITE_LINERA_SERVICE_URL as string | undefined;

/**
 * URL для команд (PokerContract).
 * Это может быть:
 *   - прямой прокси к `linera service`;
 *   - маленький backend (Node / Rust), который сам дергает `linera` CLI;
 *   - любой другой шлюз, который понимает наш JSON.
 */
const COMMAND_URL =
  (import.meta as any).env.VITE_LINERA_COMMAND_URL as string | undefined;

/**
 * Жёстко требуем наличие env-переменных.
 * Если их нет – кидаем понятную ошибку сразу при первом запросе.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing env variable ${name}. ` +
        `Configure import.meta.env.${name} in your Vite setup (.env, .env.local, etc.).`
    );
  }
  return value;
}

/**
 * Универсальный POST JSON → JSON.
 * Добавляет в ошибку статус, статус-текст и body ответа, если есть.
 */
async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkError: any) {
    console.error("[lineraClient] Network error", {
      url,
      body,
      error: networkError,
    });
    throw new Error(
      `Network error while calling Linera endpoint ${url}: ${networkError?.message ?? networkError}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[lineraClient] HTTP error", {
      url,
      body,
      status: res.status,
      statusText: res.statusText,
      text,
    });
    throw new Error(
      `Linera HTTP error ${res.status}: ${res.statusText}\n${text}`.trim()
    );
  }

  try {
    return (await res.json()) as TResponse;
  } catch (parseError: any) {
    const text = await res.text().catch(() => "");
    console.error("[lineraClient] JSON parse error", {
      url,
      body,
      error: parseError,
      rawBody: text,
    });
    throw new Error(
      `Failed to parse JSON from Linera endpoint ${url}: ${parseError?.message ?? parseError}`
    );
  }
}

/**
 * Обёртка для вызова read-only сервиса (PokerService).
 */
async function callService<TResponse>(payload: unknown): Promise<TResponse> {
  const url = requireEnv("VITE_LINERA_SERVICE_URL", SERVICE_URL);
  return postJson<TResponse>(url, payload);
}

/**
 * Обёртка для вызова командного шлюза (PokerContract / Command).
 */
async function callCommand<TResponse>(payload: unknown): Promise<TResponse> {
  const url = requireEnv("VITE_LINERA_COMMAND_URL", COMMAND_URL);
  return postJson<TResponse>(url, payload);
}

// ============================================================================
//                  ТИПЫ КОМАНД (ФРОНТОВЫЙ УРОВЕНЬ)
// ============================================================================

/**
 * Игровое действие игрока.
 * Это фронтовое представление; на бэке ты его сопоставляешь
 * с poker_engine::engine::actions::PlayerActionKind.
 */
export type PlayerActionKindUi =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in";

/**
 * Общий формат payload'а для TableCommand.
 */
export interface PlayerActionCommandPayload {
  table_id: number;
  action: PlayerActionKindUi;
  amount?: number;
}

// ---------- Турнирные команды (TournamentCommand) ----------

type TournamentCommandType =
  | "create_tournament"
  | "register_player"
  | "unregister_player"
  | "start_tournament"
  | "advance_level"
  | "close_tournament";

/**
 * Базовый shape для всех турнирных команд.
 */
interface TournamentCommandPayloadBase {
  kind: "tournament_command";
  command_type: TournamentCommandType;
}

/**
 * Payload для create_tournament: несём полный TournamentConfig из UI.
 * На Rust-стороне есть UiTournamentConfig → TournamentConfig.
 */
interface CreateTournamentPayload extends TournamentCommandPayloadBase {
  command_type: "create_tournament";
  ui_config: TournamentConfig;
}

/**
 * Базовый payload "по id турнира".
 */
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

// ============================================================================
//                           READ-ONLY ЧАСТЬ (service.rs)
// ============================================================================

/**
 * 1) ОДИН стол по table_id.
 *
 * PokerService::handle_query ожидает JSON:
 *   { "type": "table", "table_id": <id> }
 */
export async function fetchTable(
  tableId: number
): Promise<OnChainTableViewDto> {
  return callService<OnChainTableViewDto>({
    type: "table",
    table_id: tableId,
  });
}

/**
 * 2) ВСЕ столы.
 *
 * Query:
 *   { "type": "tables" }
 *
 * Ответом должен быть массив TableViewDto.
 */
export async function fetchTables(): Promise<OnChainTableViewDto[]> {
  const json = await callService<unknown>({
    type: "tables",
  });

  if (!Array.isArray(json)) {
    console.error("[lineraClient] Unexpected response for fetchTables", json);
    throw new Error("Invalid tables response from Linera service (expected array)");
  }

  return json as OnChainTableViewDto[];
}

/**
 * 3) ВСЕ турниры (то, что использует Lobby).
 *
 * Query:
 *   { "type": "tournaments" }
 *
 * PokerService::handle_tournaments формирует:
 *   Vec<TournamentViewDto> → чистый JSON-массив.
 *
 * Но на всякий случай добавлена защита, если шлюз / backend оборачивает
 * результат в объект, например: { tournaments: [...] }.
 */
export async function fetchTournaments(): Promise<OnChainTournamentViewDto[]> {
  const json = await callService<unknown>({
    type: "tournaments",
  });

  // Нормальный ожидаемый вариант: сразу массив DTO.
  if (Array.isArray(json)) {
    return json as OnChainTournamentViewDto[];
  }

  // Защитный вариант: вдруг backend/прокси завернул в объект.
  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as any).tournaments)
  ) {
    console.warn(
      "[lineraClient] fetchTournaments: response has shape { tournaments: [...] }, " +
        "adapting to OnChainTournamentViewDto[]."
    );
    return (json as any).tournaments as OnChainTournamentViewDto[];
  }

  // Всё остальное считаем ошибкой.
  console.error("[lineraClient] Unexpected response for fetchTournaments", json);
  throw new Error(
    "Invalid tournaments response from Linera service (expected array of tournaments)"
  );
}

/**
 * 4) ОДИН турнир по id.
 *
 * Query:
 *   { "type": "tournament_by_id", "tournament_id": <id> }
 */
export async function fetchTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  return callService<OnChainTournamentViewDto>({
    type: "tournament_by_id",
    tournament_id: tournamentId,
  });
}

/**
 * 5) Столы конкретного турнира.
 *
 * Query:
 *   { "type": "tournament_tables", "tournament_id": <id> }
 */
export async function fetchTournamentTables(
  tournamentId: number
): Promise<OnChainTableViewDto[]> {
  const json = await callService<unknown>({
    type: "tournament_tables",
    tournament_id: tournamentId,
  });

  if (!Array.isArray(json)) {
    console.error(
      "[lineraClient] Unexpected response for fetchTournamentTables",
      json
    );
    throw new Error(
      "Invalid tournament tables response from Linera service (expected array)"
    );
  }

  return json as OnChainTableViewDto[];
}

/**
 * (Опционально, если где-то пригодится)
 * 6) Краткое summary: всего раздач / столов / турниров.
 *
 * Query:
 *   { "type": "summary" }
 *
 * Ответ:
 *   { "total_hands_played": u64, "tables_count": u64, "tournaments_count": u64 }
 */
export interface SummaryResponse {
  total_hands_played: number;
  tables_count: number;
  tournaments_count: number;
}

export async function fetchSummary(): Promise<SummaryResponse> {
  const json = await callService<unknown>({ type: "summary" });

  if (!json || typeof json !== "object") {
    console.error("[lineraClient] Unexpected response for fetchSummary", json);
    throw new Error("Invalid summary response from Linera service");
  }

  const obj = json as any;

  return {
    total_hands_played: Number(obj.total_hands_played ?? 0),
    tables_count: Number(obj.tables_count ?? 0),
    tournaments_count: Number(obj.tournaments_count ?? 0),
  };
}

// ============================================================================
//                               МУТАЦИИ (COMMAND)
// ============================================================================
//
// Тут мы НЕ лезем в детали BCS/GraphQL Linera.
// Клиент формирует честный JSON-payload, где явно указано:
//
//   kind: "tournament_command" | "table_command"
//   command_type: "create_tournament" | ...
//
// На стороне Rust:
//
//   - маленький HTTP-прокси читает JSON;
//   - маппит его в enum Command / TournamentCommand / TableCommand;
//   - шлёт Operation::Command(Command) в linera-client / wallet.

// 7) Создать турнир.
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

// 8) Зарегистрироваться в турнире (по текущему аккаунту / signer).
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

// 9) Отменить регистрацию.
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

// 10) Запустить турнир.
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

// 11) Продвинуть уровень блайндов (manual next level).
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

// 12) Закрыть турнир (итоговое завершение).
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

// 13) Игровое действие за столом.
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
