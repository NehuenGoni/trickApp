import mongoose from "mongoose";
import { ITournament, GuestDrawMode } from "../models/Tournament";
import { UserRole } from "../models/User";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES,
  GUEST_DRAW_MODES
} from "../config/constants";
import {
  resolveTournamentLeague,
  computePlayerStats,
  awardTournamentPoints,
  revertTournamentPoints
} from "../controllers/tournament.controller";
import { enforceLeagueCap } from "./leagueCapGate";
import { tournamentParticipants } from "../utils/leaguePlayers";

interface UpdateActor {
  id: string;
  role: UserRole;
}

export interface TournamentUpdateBody {
  name?: string;
  description?: string;
  startDate?: string;
  type?: string;
  format?: string;
  teamFormationMode?: string;
  guestDrawMode?: string;
  league?: string | null;
}

type UpdateResult =
  | {
      error: string;
      status: number;
      /** Presentes solo cuando el error es un 402 de cupo de liga — ver `services/leagueCapGate.ts`. */
      reason?: string;
      plan?: string;
      limit?: number;
      current?: number;
      canUpgrade?: boolean;
    }
  | { recalculated: boolean };

/**
 * PUNTO ÚNICO de la lógica de edición de un torneo: campos permitidos,
 * validaciones y guardas de integridad. Lo usan tanto el endpoint público
 * (`PUT /tournaments/:id`, gateado por `canManageTournament` + estado
 * `upcoming`) como el de admin (`PUT /admin/tournaments/:id`, sin esas dos
 * restricciones) — antes tenían dos implementaciones divergentes: el admin
 * validaba todo, el público asignaba los campos crudos sin chequear nada.
 *
 * Recibe el documento YA cargado y YA autorizado por el caller (cada
 * controller sigue haciendo su propio gate de permisos y de estado). NO llama
 * a `save()`: eso queda del lado del controller.
 */
export const applyTournamentUpdate = async (
  tournament: ITournament & mongoose.Document,
  body: TournamentUpdateBody,
  authUser?: UpdateActor
): Promise<UpdateResult> => {
  const { name, description, startDate, type, format, teamFormationMode, guestDrawMode, league } = body;

  if (league !== undefined) {
    const previousLeague = tournament.league ?? null;
    const resolved = await resolveTournamentLeague(league, authUser, previousLeague);
    if ("error" in resolved) {
      return { error: resolved.error, status: resolved.status };
    }

    // Vincular a una liga NUEVA (no desvincular, no "misma liga de siempre")
    // puede sumarle de golpe todos los participantes del torneo — es el
    // vector más grande de altas, porque no pasa por ningún handler de
    // inscripción. Se valida solo en ese caso: desvincular nunca reduce el
    // conteo de nadie, y no tiene sentido bloquearlo.
    const isNewLeague = resolved.league && resolved.league.toString() !== previousLeague?.toString();
    if (isNewLeague) {
      // Todos los participantes actuales del torneo son "nuevos" para la
      // liga destino — `enforceLeagueCap` deduplica contra los que ya
      // jugaban ahí, así que solo cuentan los realmente nuevos.
      const capDenial = await enforceLeagueCap(resolved.league, tournamentParticipants(tournament), authUser?.id ?? "");
      if (capDenial) {
        return {
          error: capDenial.message,
          status: 402,
          reason: capDenial.reason,
          plan: capDenial.plan,
          limit: capDenial.limit,
          current: capDenial.current,
          canUpgrade: capDenial.canUpgrade
        };
      }
    }

    tournament.league = resolved.league;
  }

  if (name !== undefined) {
    if (!name.trim()) {
      return { error: "El nombre no puede estar vacío", status: 400 };
    }
    tournament.name = name.trim();
  }

  if (description !== undefined) tournament.description = description;

  if (startDate !== undefined) {
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Fecha de inicio inválida", status: 400 };
    }
    tournament.startDate = parsed;
  }

  let typeChanged = false;
  if (type !== undefined) {
    if (!(Object.values(TOURNAMENT_TYPES) as string[]).includes(type)) {
      return { error: "Tipo de torneo inválido (grand-slam | master-1000)", status: 400 };
    }
    typeChanged = tournament.type !== type;
    tournament.type = type as ITournament["type"];
  }

  // Se calcula una sola vez: nada de lo de arriba toca `teams` ni `individualSignups`.
  const hasParticipants = tournament.teams.length > 0 || tournament.individualSignups.length > 0;

  if (format !== undefined) {
    if (!(Object.values(TOURNAMENT_FORMATS) as string[]).includes(format)) {
      return { error: "Formato inválido (duos | trios)", status: 400 };
    }
    if (format !== tournament.format && hasParticipants) {
      return {
        error:
          "No se puede cambiar el formato con equipos o inscriptos cargados: cambiaría el tamaño de los equipos",
        status: 400
      };
    }
    tournament.format = format as ITournament["format"];
  }

  if (teamFormationMode !== undefined) {
    if (!(Object.values(TEAM_FORMATION_MODES) as string[]).includes(teamFormationMode)) {
      return { error: "Modo de formación inválido", status: 400 };
    }
    if (teamFormationMode !== tournament.teamFormationMode && hasParticipants) {
      return {
        error: "No se puede cambiar el modo de formación con equipos o inscriptos cargados",
        status: 400
      };
    }
    tournament.teamFormationMode = teamFormationMode as ITournament["teamFormationMode"];
  }

  if (guestDrawMode !== undefined) {
    if (!(Object.values(GUEST_DRAW_MODES) as string[]).includes(guestDrawMode)) {
      return { error: "Modo de agrupación de invitados inválido (grouped | mixed)", status: 400 };
    }
    // Sin guarda de inscriptos: solo afecta cómo se sortean los equipos, y el
    // sorteo todavía no ocurrió mientras el torneo admite ediciones.
    tournament.guestDrawMode = guestDrawMode as GuestDrawMode;
  }

  // Cambiar el tipo cambia la tabla de puntos: si ya se habían repartido, se recalculan.
  let recalculated = false;
  if (typeChanged && tournament.pointsAwarded) {
    await revertTournamentPoints(tournament);
    tournament.playerStats = await computePlayerStats(tournament);
    await awardTournamentPoints(tournament);
    recalculated = true;
  }

  return { recalculated };
};
