// src/linera/lineraClient.ts
//
// Клиент для Linera Poker (GraphQL service.rs).
//
// Все операции (READ + WRITE) идут через GraphQL endpoint:
//
//   VITE_LINERA_SERVICE_URL = "http://localhost:8081/chains/<CHAIN_ID>/applications/<APP_ID>"
//
// service.rs внутри сам вызывает schedule_operation(&Operation::Command(...)).

import type {
  OnChainCard,
  OnChainPlayerAtTableDto,
  OnChainTableViewDto,
  OnChainTournamentViewDto,
} from "../types/onchain";
import type {
  AnteType,
  BlindLevel,
  BlindPace,
  PayoutType,
  TournamentConfig,
} from "../types/poker";

// ============================================================================
//                   ENV и базовые сетевые хелперы
// ============================================================================

const SERVICE_URL =
  (import.meta as any).env.VITE_LINERA_SERVICE_URL as string | undefined;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing env variable ${name}. Configure import.meta.env.${name} (e.g. in .env.local).`
    );
  }
  return value;
}

async function postJson<TResponse>(
  url: string,
  body: unknown
): Promise<TResponse> {
  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkError: unknown) {
    console.error("[lineraClient] Network error", {
      url,
      body,
      error: networkError,
    });

    const message =
      networkError instanceof Error
        ? networkError.message
        : String(networkError);

    throw new Error(
      `Network error while calling Linera endpoint ${url}: ${message}`
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

  const json = (await res.json()) as TResponse;
  return json;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: { message: string }[];
}

async function callServiceGraphQL<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const url = requireEnv("VITE_LINERA_SERVICE_URL", SERVICE_URL);

  const payload = { query, variables };
  const resp = await postJson<GraphQLResponse<TData>>(url, payload);

  if (resp.errors && resp.errors.length > 0) {
    console.error("[lineraClient] GraphQL errors", resp.errors);
    const msg = resp.errors.map((e) => e.message).join("; ");
    throw new Error(`Linera GraphQL error: ${msg}`);
  }

  if (!resp.data) {
    throw new Error("Linera GraphQL error: missing `data` in response");
  }

  return resp.data;
}

// ============================================================================
//              ВНУТРЕННИЕ типы (как в service.rs / GraphQL)
// ============================================================================

type GqlAnteType = "None" | "Classic" | "BigBlind";

type GqlPlayerActionKind =
  | "Fold"
  | "Check"
  | "Call"
  | "Bet"
  | "Raise"
  | "AllIn";

interface GqlCard {
  rank: string;
  suit: string;
}

interface GqlPlayerAtTable {
  playerId: number;
  displayName: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  status: string;
  holeCards?: GqlCard[] | null;
}

interface GqlTableView {
  tableId: number;
  name: string;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  street: string;
  dealerButton?: number | null;
  totalPot: number;
  board: GqlCard[];
  players: GqlPlayerAtTable[];
  handInProgress: boolean;
  currentActorSeat?: number | null;
}

interface GqlTournamentView {
  tournamentId: number;
  name: string;
  status: string;
  currentLevel: number;
  playersRegistered: number;
  tablesRunning: number;
}

interface GqlSummary {
  totalHandsPlayed: number;
  tablesCount: number;
  tournamentsCount: number;
}

export interface SummaryResponse {
  total_hands_played: number;
  tables_count: number;
  tournaments_count: number;
}

export interface MutationAck {
  ok: boolean;
  message: string;
}

// ============================================================================
//           Маппинги GQL <-> твои DTO (snake_case формы)
// ============================================================================

function mapCard(g: GqlCard): OnChainCard {
  return { rank: g.rank, suit: g.suit };
}

function mapPlayer(g: GqlPlayerAtTable): OnChainPlayerAtTableDto {
  return {
    player_id: g.playerId,
    display_name: g.displayName,
    seat_index: g.seatIndex,
    stack: g.stack,
    current_bet: g.currentBet,
    status: g.status,
    hole_cards: g.holeCards ? g.holeCards.map(mapCard) : null,
  };
}

function mapTable(g: GqlTableView): OnChainTableViewDto {
  return {
    table_id: g.tableId,
    name: g.name,
    max_seats: g.maxSeats,
    small_blind: g.smallBlind,
    big_blind: g.bigBlind,
    ante: g.ante,
    street: g.street,
    dealer_button: g.dealerButton ?? null,
    total_pot: g.totalPot,
    board: g.board.map(mapCard),
    players: g.players.map(mapPlayer),
    hand_in_progress: g.handInProgress,
    current_actor_seat: g.currentActorSeat ?? null,
  };
}

function mapTournament(g: GqlTournamentView): OnChainTournamentViewDto {
  return {
    tournament_id: g.tournamentId,
    name: g.name,
    status: g.status,
    current_level: g.currentLevel,
    players_registered: g.playersRegistered,
    tables_running: g.tablesRunning,
  };
}

function mapSummary(g: GqlSummary): SummaryResponse {
  return {
    total_hands_played: g.totalHandsPlayed,
    tables_count: g.tablesCount,
    tournaments_count: g.tournamentsCount,
  };
}

// ============================================================================
//                           READ-ONLY ЧАСТЬ
// ============================================================================

export async function fetchTable(
  tableId: number
): Promise<OnChainTableViewDto | null> {
  const query = `
    query FetchTable($tableId: Int!) {
      table(tableId: $tableId) {
        tableId
        name
        maxSeats
        smallBlind
        bigBlind
        ante
        street
        dealerButton
        totalPot
        board { rank suit }
        players {
          playerId
          displayName
          seatIndex
          stack
          currentBet
          status
          holeCards { rank suit }
        }
        handInProgress
        currentActorSeat
      }
    }
  `;

  type Resp = { table: GqlTableView | null };

  const data = await callServiceGraphQL<Resp>(query, { tableId });
  if (!data.table) return null;
  return mapTable(data.table);
}

export async function fetchTables(): Promise<OnChainTableViewDto[]> {
  const query = `
    query FetchTables {
      tables {
        tableId
        name
        maxSeats
        smallBlind
        bigBlind
        ante
        street
        dealerButton
        totalPot
        board { rank suit }
        players {
          playerId
          displayName
          seatIndex
          stack
          currentBet
          status
          holeCards { rank suit }
        }
        handInProgress
        currentActorSeat
      }
    }
  `;

  type Resp = { tables: GqlTableView[] };

  const data = await callServiceGraphQL<Resp>(query);
  return data.tables.map(mapTable);
}

export async function fetchTournaments(): Promise<OnChainTournamentViewDto[]> {
  const query = `
    query FetchTournaments {
      tournaments {
        tournamentId
        name
        status
        currentLevel
        playersRegistered
        tablesRunning
      }
    }
  `;

  type Resp = { tournaments: GqlTournamentView[] };

  const data = await callServiceGraphQL<Resp>(query);
  return data.tournaments.map(mapTournament);
}

export async function fetchTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto | null> {
  const query = `
    query FetchTournament($tournamentId: Int!) {
      tournament_by_id(tournamentId: $tournamentId) {
        tournamentId
        name
        status
        currentLevel
        playersRegistered
        tablesRunning
      }
    }
  `;

  type Resp = { tournament_by_id: GqlTournamentView | null };

  const data = await callServiceGraphQL<Resp>(query, { tournamentId });
  if (!data.tournament_by_id) return null;
  return mapTournament(data.tournament_by_id);
}

export async function fetchTournamentTables(
  tournamentId: number
): Promise<OnChainTableViewDto[]> {
  const query = `
    query FetchTournamentTables($tournamentId: Int!) {
      tournament_tables(tournamentId: $tournamentId) {
        tableId
        name
        maxSeats
        smallBlind
        bigBlind
        ante
        street
        dealerButton
        totalPot
        board { rank suit }
        players {
          playerId
          displayName
          seatIndex
          stack
          currentBet
          status
          holeCards { rank suit }
        }
        handInProgress
        currentActorSeat
      }
    }
  `;

  type Resp = { tournament_tables: GqlTableView[] };

  const data = await callServiceGraphQL<Resp>(query, { tournamentId });
  return data.tournament_tables.map(mapTable);
}

export async function fetchSummary(): Promise<SummaryResponse> {
  const query = `
    query FetchSummary {
      summary {
        totalHandsPlayed
        tablesCount
        tournamentsCount
      }
    }
  `;

  type Resp = { summary: GqlSummary };

  const data = await callServiceGraphQL<Resp>(query);
  return mapSummary(data.summary);
}

// ============================================================================
//                           МУТАЦИИ (contract commands)
// ============================================================================

export async function createTable(params: {
  tableId: number;
  name: string;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  anteType: GqlAnteType;
}): Promise<MutationAck> {
  const query = `
    mutation CreateTable(
      $tableId: Int!,
      $name: String!,
      $maxSeats: Int!,
      $smallBlind: Int!,
      $bigBlind: Int!,
      $ante: Int!,
      $anteType: GqlAnteType!
    ) {
      createTable(
        tableId: $tableId,
        name: $name,
        maxSeats: $maxSeats,
        smallBlind: $smallBlind,
        bigBlind: $bigBlind,
        ante: $ante,
        anteType: $anteType
      ) {
        ok
        message
      }
    }
  `;

  type Resp = { createTable: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.createTable;
}

export async function seatPlayer(params: {
  tableId: number;
  playerId: number;
  seatIndex: number;
  displayName: string;
  initialStack: number;
}): Promise<MutationAck> {
  const query = `
    mutation SeatPlayer(
      $tableId: Int!,
      $playerId: Int!,
      $seatIndex: Int!,
      $displayName: String!,
      $initialStack: Int!
    ) {
      seatPlayer(
        tableId: $tableId,
        playerId: $playerId,
        seatIndex: $seatIndex,
        displayName: $displayName,
        initialStack: $initialStack
      ) {
        ok
        message
      }
    }
  `;

  type Resp = { seatPlayer: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.seatPlayer;
}

export async function unseatPlayer(params: {
  tableId: number;
  seatIndex: number;
}): Promise<MutationAck> {
  const query = `
    mutation UnseatPlayer($tableId: Int!, $seatIndex: Int!) {
      unseatPlayer(tableId: $tableId, seatIndex: $seatIndex) {
        ok
        message
      }
    }
  `;

  type Resp = { unseatPlayer: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.unseatPlayer;
}

export async function adjustStack(params: {
  tableId: number;
  seatIndex: number;
  delta: number;
}): Promise<MutationAck> {
  const query = `
    mutation AdjustStack($tableId: Int!, $seatIndex: Int!, $delta: Int!) {
      adjustStack(tableId: $tableId, seatIndex: $seatIndex, delta: $delta) {
        ok
        message
      }
    }
  `;

  type Resp = { adjustStack: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.adjustStack;
}

export async function startHand(params: {
  tableId: number;
  handId: number;
}): Promise<MutationAck> {
  const query = `
    mutation StartHand($tableId: Int!, $handId: Int!) {
      startHand(tableId: $tableId, handId: $handId) {
        ok
        message
      }
    }
  `;

  type Resp = { startHand: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.startHand;
}

// UI action тип
export type PlayerActionKindUi =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in";

function mapUiActionToGql(kind: PlayerActionKindUi): GqlPlayerActionKind {
  switch (kind) {
    case "fold":
      return "Fold";
    case "check":
      return "Check";
    case "call":
      return "Call";
    case "bet":
      return "Bet";
    case "raise":
      return "Raise";
    case "all_in":
      return "AllIn";
  }
}

export async function playerAction(params: {
  tableId: number;
  action: PlayerActionKindUi;
  amount?: number;
}): Promise<MutationAck> {
  const query = `
    mutation PlayerAction(
      $tableId: Int!,
      $action: GqlPlayerActionKind!,
      $amount: Int
    ) {
      playerAction(tableId: $tableId, action: $action, amount: $amount) {
        ok
        message
      }
    }
  `;

  const variables = {
    tableId: params.tableId,
    action: mapUiActionToGql(params.action),
    amount: params.amount ?? null,
  };

  type Resp = { playerAction: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, variables);
  return data.playerAction;
}

export async function tickTable(params: {
  tableId: number;
  deltaSecs: number;
}): Promise<MutationAck> {
  const query = `
    mutation TickTable($tableId: Int!, $deltaSecs: Int!) {
      tickTable(tableId: $tableId, deltaSecs: $deltaSecs) {
        ok
        message
      }
    }
  `;

  type Resp = { tickTable: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.tickTable;
}

// ============================================================================
//                       ТУРНИРНЫЕ МУТАЦИИ (низкий уровень)
// ============================================================================

interface WireTournamentConfig {
  name: string;
  description: string;
  prize_description: string;
  start_time: string;
  reg_close_time: string;
  table_size: number;
  action_time: number;
  blind_level_duration: number;
  blind_pace: BlindPace;
  starting_stack: number;
  max_players: number;
  late_reg_minutes: number;
  ante_type: AnteType;
  is_progressive_ante: boolean;
  payout_type: PayoutType;
  min_payout_places: number;
  guaranteed_prize_pool: number;
  is_bounty: boolean;
  bounty_amount: number;
  has_final_table_bonus: boolean;
  final_table_bonus: number;
  time_bank_seconds: number;
  break_every_minutes: number;
  break_duration_minutes: number;
  instant_registration: boolean;
  reentry_allowed: boolean;
  rebuys_allowed: boolean;
  blind_levels: BlindLevel[];
  min_players_to_start: number;
  freezeout: boolean;
}

// Явное приведение UI-конфига к формату, который ждёт Rust `TournamentConfig`.
function mapUiTournamentConfigToWire(
  config: TournamentConfig
): WireTournamentConfig {
  const cfgWithOptional = config as TournamentConfig & {
    minPlayersToStart?: number;
  };

  const minPlayersToStart =
    cfgWithOptional.minPlayersToStart ??
    config.maxPlayers ??
    config.tableSize ??
    2;

  const freezeout = !config.reEntryAllowed && !config.rebuysAllowed;

  return {
    name: config.name,
    description: config.description,
    prize_description: config.prizeDescription,
    start_time: config.startTime,
    reg_close_time: config.regCloseTime,
    table_size: config.tableSize,
    action_time: config.actionTime,
    blind_level_duration: config.blindLevelDuration,
    blind_pace: config.blindPace,
    starting_stack: config.startingStack,
    max_players: config.maxPlayers,
    late_reg_minutes: config.lateRegMinutes,
    ante_type: config.anteType,
    is_progressive_ante: config.isProgressiveAnte,
    payout_type: config.payoutType,
    min_payout_places: config.minPayoutPlaces,
    guaranteed_prize_pool: config.guaranteedPrizePool,
    is_bounty: config.isBounty,
    bounty_amount: config.bountyAmount,
    has_final_table_bonus: config.hasFinalTableBonus,
    final_table_bonus: config.finalTableBonus,
    time_bank_seconds: config.timeBankSeconds,
    break_every_minutes: config.breakEveryMinutes,
    break_duration_minutes: config.breakDurationMinutes,
    instant_registration: config.instantRegistration,
    reentry_allowed: config.reEntryAllowed,
    rebuys_allowed: config.rebuysAllowed,
    blind_levels: config.blindLevels,
    min_players_to_start: minPlayersToStart,
    freezeout,
  };
}

async function createTournamentMutation(params: {
  tournamentId: number;
  config: TournamentConfig;
}): Promise<MutationAck> {
  const query = `
    mutation CreateTournament($tournamentId: Int!, $config: JSON!) {
      createTournament(tournamentId: $tournamentId, config: $config) {
        ok
        message
      }
    }
  `;

  type Resp = { createTournament: MutationAck };

  const wireConfig = mapUiTournamentConfigToWire(params.config);

  const data = await callServiceGraphQL<Resp>(query, {
    tournamentId: params.tournamentId,
    config: wireConfig,
  });
  return data.createTournament;
}

async function registerPlayerToTournamentMutation(params: {
  tournamentId: number;
  playerId: number;
  displayName: string;
}): Promise<MutationAck> {
  const query = `
    mutation RegisterPlayerToTournament(
      $tournamentId: Int!,
      $playerId: Int!,
      $displayName: String!
    ) {
      registerPlayerToTournament(
        tournamentId: $tournamentId,
        playerId: $playerId,
        displayName: $displayName
      ) {
        ok
        message
      }
    }
  `;

  type Resp = { registerPlayerToTournament: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.registerPlayerToTournament;
}

async function unregisterPlayerFromTournamentMutation(params: {
  tournamentId: number;
  playerId: number;
}): Promise<MutationAck> {
  const query = `
    mutation UnregisterPlayerFromTournament(
      $tournamentId: Int!,
      $playerId: Int!
    ) {
      unregisterPlayerFromTournament(
        tournamentId: $tournamentId,
        playerId: $playerId
      ) {
        ok
        message
      }
    }
  `;

  type Resp = { unregisterPlayerFromTournament: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.unregisterPlayerFromTournament;
}

export async function startTournamentMutation(params: {
  tournamentId: number;
}): Promise<MutationAck> {
  const query = `
    mutation StartTournament($tournamentId: Int!) {
      startTournament(tournamentId: $tournamentId) {
        ok
        message
      }
    }
  `;

  type Resp = { startTournament: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.startTournament;
}

export async function advanceTournamentLevelMutation(params: {
  tournamentId: number;
}): Promise<MutationAck> {
  const query = `
    mutation AdvanceTournamentLevel($tournamentId: Int!) {
      advanceTournamentLevel(tournamentId: $tournamentId) {
        ok
        message
      }
    }
  `;

  type Resp = { advanceTournamentLevel: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.advanceTournamentLevel;
}

export async function closeTournamentMutation(params: {
  tournamentId: number;
}): Promise<MutationAck> {
  const query = `
    mutation CloseTournament($tournamentId: Int!) {
      closeTournament(tournamentId: $tournamentId) {
        ok
        message
      }
    }
  `;

  type Resp = { closeTournament: MutationAck };

  const data = await callServiceGraphQL<Resp>(query, params);
  return data.closeTournament;
}

// ============================================================================
//                 LEGACY-ОБЁРТКИ (API как раньше для фронта)
// ============================================================================

export async function createTournament(
  config: TournamentConfig
): Promise<OnChainTournamentViewDto> {
  const tournamentId = Math.floor(Math.random() * 1_000_000_000);

  const ack = await createTournamentMutation({ tournamentId, config });
  if (!ack.ok) {
    throw new Error(ack.message || "CreateTournament failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after createTournament");
  }
  return view;
}

export async function registerToTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const ack = await registerPlayerToTournamentMutation({
    tournamentId,
    playerId: 1,
    displayName: "Player #1",
  });

  if (!ack.ok) {
    throw new Error(ack.message || "RegisterPlayer failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after registerToTournament");
  }
  return view;
}

export async function unregisterFromTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const ack = await unregisterPlayerFromTournamentMutation({
    tournamentId,
    playerId: 1,
  });

  if (!ack.ok) {
    throw new Error(ack.message || "UnregisterPlayer failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after unregisterFromTournament");
  }
  return view;
}

export async function startTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const ack = await startTournamentMutation({ tournamentId });
  if (!ack.ok) {
    throw new Error(ack.message || "StartTournament failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after startTournament");
  }
  return view;
}

export async function advanceTournamentLevel(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const ack = await advanceTournamentLevelMutation({ tournamentId });
  if (!ack.ok) {
    throw new Error(ack.message || "AdvanceTournamentLevel failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after advanceTournamentLevel");
  }
  return view;
}

export async function closeTournament(
  tournamentId: number
): Promise<OnChainTournamentViewDto> {
  const ack = await closeTournamentMutation({ tournamentId });
  if (!ack.ok) {
    throw new Error(ack.message || "CloseTournament failed");
  }

  const view = await fetchTournament(tournamentId);
  if (!view) {
    throw new Error("Tournament not found after closeTournament");
  }
  return view;
}

export async function sendPlayerAction(
  tableId: number,
  action: PlayerActionKindUi,
  amount?: number
): Promise<OnChainTableViewDto | null> {
  const ack = await playerAction({ tableId, action, amount });
  if (!ack.ok) {
    throw new Error(ack.message || "PlayerAction failed");
  }

  return fetchTable(tableId);
}
