import mongoose from "mongoose";
import { ITeam, IPlayer, IIndividualSignup, TeamFormationMode } from "../models/Tournament";
import { TEAM_FORMATION_MODES } from "../config/constants";

/**
 * Lógica pura (sin Mongoose, sin red) que valida y arma el resultado de
 * `PUT /tournaments/:id/roster`. Se separa del controller para poder
 * verificarla con un script (`scripts/checkRoster.ts`) sin levantar Mongo.
 */

export interface RosterPlayerInput {
  signupId?: string;
  playerId?: string;
  name: string;
  isGuest?: boolean;
}

export interface RosterTeamInput {
  teamId?: string;
  name?: string;
  players: RosterPlayerInput[];
}

export interface RosterPayload {
  teams: RosterTeamInput[];
}

export interface ValidateRosterArgs {
  payload: unknown;
  teamFormationMode: TeamFormationMode;
  teamSize: number;
  /** `tournament.numberOfTeams`: tope de equipos del cuadro. */
  numberOfTeams: number;
  /** `tournament.teams` tal cual están hoy en el documento. */
  existingTeams: ITeam[];
  /** `tournament.individualSignups` tal cual están hoy en el documento. */
  individualSignups: IIndividualSignup[];
}

export type ValidateRosterResult =
  | { ok: true; teams: ITeam[]; draftInvalidated: boolean }
  | { ok: false; error: string; status: number };

/**
 * Clave para comparar un jugador entre el pool (`individualSignups`) y los
 * equipos. Preferimos `signupId`; los torneos ya sorteados en producción no lo
 * tienen, así que caemos a `playerId` y, para invitados legacy, al nombre
 * normalizado — no hay mejor ancla, los invitados no tienen id propio.
 */
export const playerKey = (p: { signupId?: unknown; playerId?: unknown; name: string }): string => {
  if (p.signupId) return `s:${p.signupId}`;
  if (p.playerId) return `u:${p.playerId}`;
  return `g:${p.name.trim().toLowerCase()}`;
};

const STALE_MESSAGE =
  "La lista de jugadores no coincide con los inscriptos del torneo. Recargá la página e intentá de nuevo.";

export const validateRosterPayload = (args: ValidateRosterArgs): ValidateRosterResult => {
  const { payload, teamFormationMode, teamSize, numberOfTeams, existingTeams, individualSignups } = args;

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as RosterPayload).teams)) {
    return { ok: false, error: "Falta la lista de equipos", status: 400 };
  }
  const inputTeams = (payload as RosterPayload).teams;

  if (inputTeams.length > numberOfTeams) {
    return { ok: false, error: `No puede haber más de ${numberOfTeams} equipos`, status: 400 };
  }

  for (const t of inputTeams) {
    if (!Array.isArray(t.players)) {
      return { ok: false, error: "Cada equipo debe tener una lista de jugadores", status: 400 };
    }
    if (t.players.length > teamSize) {
      return {
        ok: false,
        error: `Cada equipo puede tener hasta ${teamSize} jugadores (formato ${teamSize === 3 ? "trios" : "duos"})`,
        status: 400
      };
    }
  }

  const isPoolBased = teamFormationMode !== TEAM_FORMATION_MODES.USER_FORMED;

  // Equipos "fijos" (cargados enteros a mano en modo pool): no pasan por acá.
  const editableExisting = new Map<string, ITeam>();
  const fixedTeamIds = new Set<string>();
  for (const t of existingTeams) {
    const id = t.teamId.toString();
    if (isPoolBased && !t.isDrawn) {
      fixedTeamIds.add(id);
    } else {
      editableExisting.set(id, t);
    }
  }

  const seenTeamIds = new Set<string>();
  for (const t of inputTeams) {
    if (t.teamId === undefined) {
      if (!isPoolBased) {
        return { ok: false, error: "En este modo no se pueden crear equipos nuevos", status: 400 };
      }
      continue;
    }
    if (fixedTeamIds.has(t.teamId)) {
      return { ok: false, error: `El equipo ${t.teamId} es fijo y no se puede reorganizar acá`, status: 400 };
    }
    if (!editableExisting.has(t.teamId)) {
      return { ok: false, error: `El equipo ${t.teamId} no pertenece a este torneo`, status: 400 };
    }
    if (seenTeamIds.has(t.teamId)) {
      return { ok: false, error: "Hay equipos repetidos en la lista", status: 400 };
    }
    seenTeamIds.add(t.teamId);
  }

  if (!isPoolBased && seenTeamIds.size !== editableExisting.size) {
    return { ok: false, error: "Faltan equipos del torneo en la lista", status: 400 };
  }

  // Universo de jugadores movibles: el pool en modos pool-based, o el conjunto
  // de jugadores ya repartidos en los equipos editables en user-formed.
  const universe: Map<string, IIndividualSignup | IPlayer> = isPoolBased
    ? new Map(individualSignups.map((s) => [playerKey(s), s]))
    : new Map(
        [...editableExisting.values()]
          .flatMap((t) => t.players)
          .map((p) => [playerKey(p), p] as const)
      );

  const payloadKeys = new Set<string>();
  for (const t of inputTeams) {
    for (const p of t.players) {
      if (!p || typeof p.name !== "string" || !p.name.trim()) {
        return { ok: false, error: "Falta el nombre de un jugador", status: 400 };
      }
      const key = playerKey(p);
      if (!universe.has(key)) {
        return { ok: false, error: STALE_MESSAGE, status: 409 };
      }
      if (payloadKeys.has(key)) {
        return { ok: false, error: `El jugador ${p.name} aparece en más de un equipo`, status: 400 };
      }
      payloadKeys.add(key);
    }
  }

  // En user-formed no se puede dejar a nadie afuera: el multiconjunto tiene
  // que ser exactamente el mismo, no un subconjunto.
  if (!isPoolBased && payloadKeys.size !== universe.size) {
    return { ok: false, error: STALE_MESSAGE, status: 409 };
  }

  // Arma los jugadores desde la fuente confiable (pool o equipo actual), nunca
  // desde los campos sueltos que mandó el cliente (playerId/isGuest podrían
  // no corresponder a `signupId`).
  const buildPlayer = (key: string): IPlayer => {
    const source = universe.get(key)!;
    if (isPoolBased) {
      const s = source as IIndividualSignup;
      return { playerId: s.userId, name: s.name, isGuest: s.isGuest, signupId: s.signupId };
    }
    const p = source as IPlayer;
    return { playerId: p.playerId, name: p.name, isGuest: p.isGuest, signupId: p.signupId };
  };

  let newTeamCount = 0;
  const resultTeams: ITeam[] = [];

  for (const t of inputTeams) {
    if (t.players.length === 0) continue; // placeholder vacío: no crea equipo

    const players = t.players.map((p) => buildPlayer(playerKey(p)));

    if (t.teamId !== undefined) {
      const existing = editableExisting.get(t.teamId)!;
      resultTeams.push({
        teamId: existing.teamId,
        name: t.name?.trim() || existing.name,
        registeredBy: existing.registeredBy,
        isDrawn: existing.isDrawn,
        players
      });
    } else {
      newTeamCount += 1;
      resultTeams.push({
        teamId: new mongoose.Types.ObjectId(),
        name: t.name?.trim() || `Equipo ${existingTeams.length + newTeamCount}`,
        isDrawn: true,
        players
      });
    }
  }

  if (!isPoolBased) {
    const incomplete = resultTeams.find((t) => t.players.length !== teamSize);
    if (incomplete) {
      return {
        ok: false,
        error: `En este modo todos los equipos deben quedar completos (${teamSize} jugadores). Intercambiá jugadores en vez de moverlos.`,
        status: 400
      };
    }
  }

  const finalTeams = [...existingTeams.filter((t) => fixedTeamIds.has(t.teamId.toString())), ...resultTeams];

  const beforeIds = new Set(existingTeams.map((t) => t.teamId.toString()));
  const afterIds = new Set(finalTeams.map((t) => t.teamId.toString()));
  const draftInvalidated =
    beforeIds.size !== afterIds.size || [...beforeIds].some((id) => !afterIds.has(id));

  return { ok: true, teams: finalTeams, draftInvalidated };
};
