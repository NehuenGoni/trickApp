import mongoose from "mongoose";
import TournamentModel from "../models/Tournament";
import League from "../models/League";
import User from "../models/User";
import { PLANS, PlanId } from "../config/plans";
import { isAdmin } from "../middlewares/roleMiddleware";
import { IdentifiablePlayer, playerIdentityKey } from "./playerIdentity";

/**
 * Cuántos jugadores únicos tiene una liga, y el gate que compara ese número
 * contra `PLANS[plan].maxMembers` antes de dejar sumar gente nueva.
 *
 * Es el módulo central de la feature "jugadores por liga": lo usa el listado
 * de ligas, el detalle, el medidor de "Mi Plan" y el gate de inscripción. Un
 * solo criterio de conteo para las cuatro cosas — si el chip dice 40 y el
 * bloqueo dispara a los 40, no hay forma de que el usuario vea números
 * contradictorios.
 *
 * A diferencia de `leagueStandings.ts` (que solo mira torneos `completed`,
 * porque ahí importa el puntaje ganado), acá cuenta CUALQUIER torneo de la
 * liga: alguien anotado en un torneo `upcoming` ya ocupa un cupo, aunque
 * todavía no haya jugado nada.
 */

/** Campos de Tournament necesarios para contar participantes de una liga. */
export const TOURNAMENT_PLAYER_FIELDS =
  "league playerStats.playerId playerStats.name playerStats.isGuest " +
  "individualSignups.userId individualSignups.name individualSignups.isGuest " +
  "teams.players.playerId teams.players.name teams.players.isGuest";

type PlayerIdRef = mongoose.Types.ObjectId | string | null | undefined;

interface TournamentPlayerSource {
  _id?: unknown;
  league?: mongoose.Types.ObjectId | null;
  playerStats?: { playerId?: PlayerIdRef; name?: string; isGuest?: boolean }[];
  individualSignups?: { userId?: PlayerIdRef; name?: string; isGuest?: boolean }[];
  teams?: { players?: { playerId?: PlayerIdRef; name?: string; isGuest?: boolean }[] }[];
}

export interface LeaguePlayerCounts {
  /** Únicos totales (registrados + invitados). Es lo que se compara contra `maxMembers`. */
  playerCount: number;
  /** Únicos con cuenta — desglose para la UI. */
  registeredCount: number;
  guestCount: number;
}

/**
 * Claves de identidad (`playerIdentityKey`) de un torneo, uniendo las tres
 * fuentes donde puede haber gente: `playerStats` (torneos cerrados),
 * `individualSignups` (pool de inscriptos — OJO: el campo es `userId`, no
 * `playerId`) y `teams[].players`. El valor del Map es `isGuest`, para poder
 * derivar `registeredCount`/`guestCount` sin volver a mirar el torneo.
 *
 * Clave vacía (`"guest:"`, invitado sin nombre) se descarta: no representa a
 * nadie identificable, igual que en `leagueStandings.ts`.
 */
export const collectPlayerIdentities = (t: TournamentPlayerSource): Map<string, boolean> => {
  const identities = new Map<string, boolean>();

  const add = (p: IdentifiablePlayer) => {
    const key = playerIdentityKey(p);
    if (key === "guest:") return;
    identities.set(key, !!p.isGuest);
  };

  for (const s of t.playerStats ?? []) add(s);
  for (const s of t.individualSignups ?? []) add({ playerId: s.userId, name: s.name, isGuest: s.isGuest });
  for (const team of t.teams ?? []) {
    for (const p of team.players ?? []) add(p);
  }

  return identities;
};

/**
 * Todos los participantes de UN torneo (documento Mongoose, no `.lean()`),
 * como `IdentifiablePlayer[]` sin deduplicar — para pasarlos tal cual a
 * `checkLeaguePlayerCap` cuando se vincula el torneo a una liga (ahí SÍ
 * importa la lista completa: la dedupe la hace el propio chequeo contra los
 * que ya juegan en la liga destino). Usado por `attachTournament`
 * (`league.controller.ts`) y `applyTournamentUpdate` (`tournamentUpdate.ts`)
 * — los dos únicos lugares donde un torneo con jugadores puede pasar a
 * pertenecer a una liga.
 */
export const tournamentParticipants = (t: {
  playerStats: { playerId?: mongoose.Types.ObjectId; name: string; isGuest?: boolean }[];
  individualSignups: { userId?: mongoose.Types.ObjectId; name: string; isGuest?: boolean }[];
  teams: { players: { playerId?: mongoose.Types.ObjectId; name: string; isGuest?: boolean }[] }[];
}): IdentifiablePlayer[] => [
  ...t.playerStats.map((s) => ({ playerId: s.playerId, name: s.name, isGuest: s.isGuest })),
  ...t.individualSignups.map((s) => ({ playerId: s.userId, name: s.name, isGuest: s.isGuest })),
  ...t.teams.flatMap((team) => team.players.map((p) => ({ playerId: p.playerId, name: p.name, isGuest: p.isGuest })))
];

const countsFromIdentities = (identities: Map<string, boolean>): LeaguePlayerCounts => {
  let guestCount = 0;
  for (const isGuest of identities.values()) {
    if (isGuest) guestCount += 1;
  }
  return {
    playerCount: identities.size,
    registeredCount: identities.size - guestCount,
    guestCount
  };
};

/**
 * Agrega por liga en una sola query, acotada a `leagueIds`. Devuelve un
 * `Map<leagueId, LeaguePlayerCounts>` — las ligas sin torneos ni participantes
 * no aparecen en el Map (el llamador debe tratar eso como conteo 0).
 */
export const computeLeaguePlayerCounts = async (
  leagueIds: (mongoose.Types.ObjectId | string)[]
): Promise<Map<string, LeaguePlayerCounts>> => {
  if (leagueIds.length === 0) return new Map();

  const tournaments = await TournamentModel.find({ league: { $in: leagueIds } })
    .select(TOURNAMENT_PLAYER_FIELDS)
    .lean<TournamentPlayerSource[]>();

  const identitiesByLeague = new Map<string, Map<string, boolean>>();
  for (const t of tournaments) {
    if (!t.league) continue;
    const leagueKey = t.league.toString();
    let identities = identitiesByLeague.get(leagueKey);
    if (!identities) {
      identities = new Map();
      identitiesByLeague.set(leagueKey, identities);
    }
    for (const [key, isGuest] of collectPlayerIdentities(t)) {
      identities.set(key, isGuest);
    }
  }

  const result = new Map<string, LeaguePlayerCounts>();
  for (const [leagueKey, identities] of identitiesByLeague) {
    result.set(leagueKey, countsFromIdentities(identities));
  }
  return result;
};

export interface LeagueCapCheck {
  allowed: boolean;
  /** Personas únicas en la liga hoy, antes del alta. */
  current: number;
  /** Cuántas quedarían si se aprueba el alta. */
  next: number;
  /** `maxMembers` del plan del DUEÑO de la liga. */
  limit: number;
  plan: PlanId;
  ownerId: string;
  isLeagueOwner: boolean;
}

/**
 * Compara el set actual de jugadores de una liga contra `newPlayers` (los que
 * una operación intenta sumar) y decide si el plan del dueño lo permite.
 *
 * `leagueId` es la liga DESTINO — no siempre `tournament.league` (ver el caso
 * de vincular un torneo ya jugado a una liga, en `tournamentUpdate.ts`).
 * `requesterId` es quien hace la operación, solo para saber si es el propio
 * dueño (afecta el mensaje, no el resultado).
 *
 * Devuelve `null` cuando el cupo simplemente no aplica: sin liga, dueño
 * admin, o plan con `maxMembers` infinito. En esos casos ni siquiera se
 * corre la query de conteo.
 */
export const checkLeaguePlayerCap = async (
  leagueId: mongoose.Types.ObjectId | string | null | undefined,
  newPlayers: IdentifiablePlayer[],
  requesterId?: string
): Promise<LeagueCapCheck | null> => {
  if (!leagueId) return null;

  const league = await League.findById(leagueId).select("createdBy").lean();
  if (!league) return null;

  const ownerId = league.createdBy.toString();
  const owner = await User.findById(ownerId).select("billing role").lean();
  if (!owner) return null;
  if (isAdmin(owner.role)) return null;

  const plan = owner.billing.plan;
  const limit = PLANS[plan].maxMembers;
  if (limit === Infinity) return null;

  // Set completo de identidades actuales de la liga, para poder saber cuáles
  // de `newPlayers` son realmente NUEVAS (unión, no suma) al agregarlas.
  const tournaments = await TournamentModel.find({ league: leagueId })
    .select(TOURNAMENT_PLAYER_FIELDS)
    .lean<TournamentPlayerSource[]>();
  const identities = new Map<string, boolean>();
  for (const t of tournaments) {
    for (const [key, isGuest] of collectPlayerIdentities(t)) identities.set(key, isGuest);
  }
  const current = identities.size;

  for (const p of newPlayers) {
    const key = playerIdentityKey(p);
    if (key === "guest:") continue;
    identities.set(key, !!p.isGuest);
  }
  const next = identities.size;

  // Grandfathering: una liga que ya excedía el cupo (nunca se validó antes de
  // este gate) sigue operando. Solo se rechaza un alta que AUMENTA el
  // conjunto por encima del límite — nunca una que no lo aumenta.
  const allowed = next <= limit || next <= current;

  return { allowed, current, next, limit, plan, ownerId, isLeagueOwner: requesterId === ownerId };
};
