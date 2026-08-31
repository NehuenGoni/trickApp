import { Request, Response } from "express";
import mongoose, { ClientSession } from "mongoose";
import User, { UserRole } from "../models/User";
import Match, { IMatchTeam } from "../models/Match";
import League from "../models/League";
import { canManageLeague } from "../utils/leaguePermissions";
import TournamentModel, {
  ITournament,
  ITeam,
  IPlayer,
  IPlayerStat,
  IIndividualSignup,
  GuestDrawMode
} from "../models/Tournament";
import TournamentLogoModel from "../models/TournamentLogo";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES,
  GUEST_DRAW_MODES,
  FORMAT_TEAM_SIZE,
  MIN_TOURNAMENT_TEAMS,
  MAX_TOURNAMENT_TEAMS,
  POINTS_TABLE,
  MATCH_STATUS,
  MATCH_TYPES
} from "../config/constants";
import { buildBracket, positionsFromSlot } from "../utils/bracket";
import { pointsForPosition } from "../utils/points";
import { withTransaction } from "../utils/withTransaction";
import { playerKey, validateRosterPayload } from "../utils/roster";
import { canManageTournament } from "../utils/tournamentAccess";
import { applyTournamentUpdate } from "../services/tournamentUpdate";
import { isAdmin } from "../middlewares/roleMiddleware";
import { consumeTournamentSlot, releaseTournamentSlot, ConsumeSlotResult } from "../services/billing";
import { enforceLeagueCap } from "../services/leagueCapGate";
import { IdentifiablePlayer } from "../utils/playerIdentity";
import { PlanId } from "../config/plans";
import {
  notifyTournamentSignup,
  notifyTournamentStarted,
  notifyTournamentClosed,
  resolveUsers,
  TournamentStartedEntry,
  TournamentClosedEntry
} from "../services/notifications";
import { notifyAdminPlanLimitHit } from "../services/adminAlerts";

interface AuthRequest extends Request {
  user?: string;
}

/** Motivo por el que `consumeTournamentSlot` rechazó — ver `services/billing.ts`. */
type BillingGateReason = Extract<ConsumeSlotResult, { ok: false }>["reason"];

const BILLING_GATE_MESSAGES: Record<BillingGateReason, string> = {
  no_free_slot: "Ya usaste tu torneo de prueba gratuito. Elegí un plan para seguir creando torneos.",
  no_subscription: "Necesitás una suscripción activa para crear un torneo.",
  monthly_limit_reached: "Llegaste al límite de torneos de tu plan este mes. Pasate a un plan superior o esperá al próximo período."
};

/** Error tipado que `createTournament` traduce a un 402 con el detalle del plan y el uso. */
class BillingGateError extends Error {
  constructor(
    public reason: BillingGateReason,
    public plan: PlanId,
    public usage: Extract<ConsumeSlotResult, { ok: false }>["usage"]
  ) {
    super(BILLING_GATE_MESSAGES[reason]);
  }
}

const isValidTournamentType = (value: unknown): value is keyof typeof POINTS_TABLE =>
  value === TOURNAMENT_TYPES.GRAND_SLAM || value === TOURNAMENT_TYPES.MASTER_1000;

const isValidFormat = (value: unknown): value is keyof typeof FORMAT_TEAM_SIZE =>
  value === TOURNAMENT_FORMATS.DUOS || value === TOURNAMENT_FORMATS.TRIOS;

const isValidFormationMode = (value: unknown) =>
  (Object.values(TEAM_FORMATION_MODES) as string[]).includes(value as string);

const isValidGuestDrawMode = (value: unknown): value is GuestDrawMode =>
  value === GUEST_DRAW_MODES.GROUPED || value === GUEST_DRAW_MODES.MIXED;

/** Cantidad de equipos del cuadro: entre `MIN_TOURNAMENT_TEAMS` y `MAX_TOURNAMENT_TEAMS`. */
export const isValidNumberOfTeams = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= MIN_TOURNAMENT_TEAMS &&
  value <= MAX_TOURNAMENT_TEAMS;

/**
 * Resuelve y valida el `league` opcional que puede venir en el body al crear
 * o editar un torneo. `null`/`""` desvincula. Devuelve `undefined` si el
 * campo no vino (no tocar), o `{ error }` si algo no es válido.
 *
 * Asignar un torneo a una liga es una mutación de LIGA, así que pasa por el
 * mismo gate que el resto de la administración de ligas (`canManageLeague`)
 * — si no, el chequeo de permisos que vive en league.controller.ts se podría
 * esquivar creando o editando el torneo directamente.
 */
export const resolveTournamentLeague = async (
  rawLeague: unknown,
  authUser?: { id: string; role: UserRole },
  /**
   * Liga a la que el torneo pertenece HOY (si la tiene). Solo hace falta para
   * detectar un desvínculo (`rawLeague` null/"") y exigirle el mismo permiso
   * que a asignarla — si no, cualquiera con `canManageTournament` (el
   * creador del torneo) podría sacarlo de una liga que no administra,
   * alterando sus standings por izquierda.
   */
  currentLeague?: mongoose.Types.ObjectId | null
): Promise<{ league: mongoose.Types.ObjectId | null } | { error: string; status: number }> => {
  if (rawLeague === null || rawLeague === "") {
    if (!currentLeague) {
      return { league: null };
    }
    const current = await League.findById(currentLeague).select("createdBy organizers");
    if (!current) {
      // La liga actual ya no existe (borrada): no hay nada que proteger, se deja desvincular.
      return { league: null };
    }
    if (!canManageLeague(authUser, current)) {
      return { error: "No tenés permisos para quitar el torneo de esta liga", status: 403 };
    }
    return { league: null };
  }
  if (typeof rawLeague !== "string" || !mongoose.isValidObjectId(rawLeague)) {
    return { error: "ID de liga inválido", status: 400 };
  }
  const league = await League.findById(rawLeague).select("createdBy organizers");
  if (!league) {
    return { error: "Liga no encontrada", status: 404 };
  }
  if (!canManageLeague(authUser, league)) {
    return { error: "No tenés permisos para asignar torneos a esta liga", status: 403 };
  }
  return { league: league._id as mongoose.Types.ObjectId };
};

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const isUserAlreadyInTournament = (
  tournament: ITournament,
  userId: string
): boolean => {
  const inSignups = tournament.individualSignups.some(
    (s) => s.userId && s.userId.toString() === userId
  );
  if (inSignups) return true;
  return tournament.teams.some((t) =>
    t.players.some((p) => p.playerId && p.playerId.toString() === userId)
  );
};

/**
 * Cupos ocupados de un torneo. Espeja `slotsFilled` de TournamentDetails.tsx:
 * en los modos con pool (random, creator-formed) los equipos derivados de él
 * (`isDrawn`) no se suman aparte, sus jugadores ya están contados ahí; solo
 * suman los equipos "fijos" cargados enteros a mano (`addGuestTeam`).
 */
export const countFilledSlots = (tournament: ITournament): number => {
  const size = FORMAT_TEAM_SIZE[tournament.format];
  if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
    return tournament.teams.length * size;
  }
  return (
    tournament.individualSignups.length +
    tournament.teams.filter((t) => !t.isDrawn).length * size
  );
};

/**
 * Saca del pool a los inscriptos que cumplan `predicate` y también de
 * cualquier equipo en el que ya estuvieran. Sin esto, quitar del pool a
 * alguien ya sorteado/asignado deja un jugador fantasma: sigue apareciendo en
 * el cuadro pero ya no está inscripto. Los equipos que quedan vacíos se
 * eliminan; los que quedan incompletos se dejan así (el gate de "cupos
 * completos" no deja iniciar el torneo).
 */
export const removeSignupsFromTournament = (
  tournament: ITournament,
  predicate: (s: IIndividualSignup) => boolean
): { removed: number; teamsTouched: number; teamsDropped: number } => {
  const toRemove = tournament.individualSignups.filter(predicate);
  if (toRemove.length === 0) {
    return { removed: 0, teamsTouched: 0, teamsDropped: 0 };
  }
  const removedKeys = new Set(toRemove.map((s) => playerKey(s)));

  tournament.individualSignups = tournament.individualSignups.filter(
    (s) => !removedKeys.has(playerKey(s))
  );

  let teamsTouched = 0;
  let teamsDropped = 0;
  const survivingTeams: ITeam[] = [];
  for (const team of tournament.teams) {
    const before = team.players.length;
    const players = team.players.filter((p) => !removedKeys.has(playerKey(p)));
    if (players.length !== before) teamsTouched++;
    if (players.length === 0 && before > 0) {
      teamsDropped++;
      continue;
    }
    team.players = players;
    survivingTeams.push(team);
  }
  tournament.teams = survivingTeams;

  if (teamsDropped > 0) {
    tournament.draftPairOrder = undefined;
  }

  return { removed: toRemove.length, teamsTouched, teamsDropped };
};

/**
 * Arma los equipos faltantes a partir de los inscriptos individuales. El criterio
 * para los invitados depende de `guestDrawMode`:
 * - `grouped`: se agrupan entre ellos y van al frente de la lista antes de cortar
 *   en bloques secuenciales, así que los primeros equipos salen 100% invitados, a
 *   lo sumo uno queda mixto (el que absorbe el resto de la división) y ningún
 *   equipo posterior lleva invitados.
 * - `mixed`: entran al pool general y se barajan junto con los registrados, así
 *   que pueden quedar dispersos en cualquier equipo.
 */
export const buildDrawnTeams = (
  signups: IIndividualSignup[],
  expectedSize: number,
  teamsNeeded: number,
  existingTeamsCount: number,
  guestDrawMode: GuestDrawMode
): ITeam[] => {
  const ordered =
    guestDrawMode === GUEST_DRAW_MODES.MIXED
      ? shuffle(signups)
      : [
          ...shuffle(signups.filter((s) => s.isGuest)),
          ...shuffle(signups.filter((s) => !s.isGuest))
        ];

  const newTeams: ITeam[] = [];
  let cursor = 0;
  for (let i = 0; i < teamsNeeded; i++) {
    const players = ordered.slice(cursor, cursor + expectedSize);
    cursor += expectedSize;
    const teamNumber = existingTeamsCount + newTeams.length + 1;
    newTeams.push({
      teamId: new mongoose.Types.ObjectId(),
      name: `Equipo ${teamNumber}`,
      players: players.map((s) => ({
        playerId: s.userId,
        name: s.name,
        isGuest: s.isGuest,
        signupId: s.signupId
      })),
      isDrawn: true
    });
  }
  return newTeams;
};

export const createTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    name,
    startDate,
    description,
    type,
    format,
    teamFormationMode,
    guestDrawMode,
    numberOfTeams: rawNumberOfTeams,
    league: rawLeague
  } = req.body;
  const createdBy = req.user;

  if (!isValidTournamentType(type)) {
    return void res.status(400).json({ message: "Tipo de torneo inválido (grand-slam | master-1000)" });
  }
  if (!isValidFormat(format)) {
    return void res.status(400).json({ message: "Formato inválido (duos | trios)" });
  }
  if (!isValidFormationMode(teamFormationMode)) {
    return void res.status(400).json({ message: "Modo de formación de equipos inválido" });
  }
  if (guestDrawMode !== undefined && !isValidGuestDrawMode(guestDrawMode)) {
    return void res.status(400).json({ message: "Modo de agrupación de invitados inválido (grouped | mixed)" });
  }
  // Opcional: si no viene, el schema lo deja en TOURNAMENT_TEAMS_COUNT (8), el
  // tamaño de siempre — así los clientes que todavía no mandan este campo
  // (o los tests existentes) no se ven afectados.
  if (rawNumberOfTeams !== undefined && !isValidNumberOfTeams(rawNumberOfTeams)) {
    return void res.status(400).json({
      message: `Cantidad de equipos inválida (entre ${MIN_TOURNAMENT_TEAMS} y ${MAX_TOURNAMENT_TEAMS})`
    });
  }

  let league: mongoose.Types.ObjectId | null = null;
  if (rawLeague !== undefined) {
    const resolved = await resolveTournamentLeague(rawLeague, req.authUser);
    if ("error" in resolved) {
      return void res.status(resolved.status).json({ message: resolved.error });
    }
    league = resolved.league;
  }

  try {
    // El admin no paga: gestiona el panel, no es un cliente. Para el resto,
    // el cupo se consume ATÓMICAMENTE (ver `consumeTournamentSlot`) dentro de
    // la misma transacción que crea el torneo — si el `save()` fallara por
    // cualquier motivo, el rollback también devuelve el cupo consumido.
    const isPrivileged = isAdmin(req.authUser?.role);
    let billingCharge: { plan: PlanId; periodKey: string; chargedAt: Date } | undefined;

    const tournament = await withTransaction(async (session) => {
      if (!isPrivileged) {
        const slot = await consumeTournamentSlot(createdBy!, session);
        if (!slot.ok) {
          throw new BillingGateError(slot.reason, slot.plan, slot.usage);
        }
        billingCharge = { plan: slot.plan, periodKey: slot.periodKey, chargedAt: new Date() };
      }

      const doc = new TournamentModel({
        name,
        startDate,
        description,
        type,
        format,
        teamFormationMode,
        ...(guestDrawMode !== undefined ? { guestDrawMode } : {}),
        ...(rawNumberOfTeams !== undefined ? { numberOfTeams: rawNumberOfTeams } : {}),
        createdBy,
        status: "upcoming",
        teams: [],
        individualSignups: [],
        matches: [],
        playerStats: [],
        pointsAwarded: false,
        league,
        billing: billingCharge ?? null
      });
      await doc.save({ session });
      return doc;
    });

    res.status(201).json(tournament);
  } catch (error) {
    if (error instanceof BillingGateError) {
      void notifyAdminPlanLimitHit({
        userId: createdBy!,
        reason: error.reason,
        plan: error.plan,
        usage: error.usage
      });
      return void res.status(402).json({
        message: BILLING_GATE_MESSAGES[error.reason],
        reason: error.reason,
        plan: error.plan,
        usage: error.usage
      });
    }
    res.status(400).json({ message: "Error al crear el torneo", error });
  }
};

export const getTournaments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournaments = await TournamentModel.find().sort({ createdAt: -1 }).populate("league", "name");
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los torneos", error });
  }
};

export const getOpenTournaments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournaments = await TournamentModel.find({ status: "upcoming" })
      .sort({ createdAt: -1 })
      .populate("league", "name");
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los torneos abiertos", error });
  }
};

export const getTournamentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id).populate("league", "name");
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    res.status(200).json(tournament);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener el torneo", error });
  }
};

export const updateTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({
        message: "Solo se puede modificar un torneo que aún no comenzó"
      });
    }

    const result = await applyTournamentUpdate(tournament, req.body, req.authUser);
    if ("error" in result) {
      // Campos extra (reason/plan/limit/current/canUpgrade) solo están
      // presentes en el 402 de cupo de liga — ver `services/leagueCapGate.ts`.
      const { error, status, ...extra } = result;
      return void res.status(status).json({ message: error, ...extra });
    }

    await tournament.save();
    res.status(200).json(tournament);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    res.status(400).json({ message: "Error al actualizar el torneo", error: message });
  }
};

export const deleteTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    // Mismo criterio que `deleteMatch`: si no se puede borrar un partido de un
    // torneo en curso, tampoco el torneo entero. El admin sí puede.
    if (tournament.status === "in_progress") {
      return void res.status(400).json({
        message: "No se puede borrar un torneo en curso"
      });
    }

    const { deletedMatches } = await withTransaction((session) =>
      deleteTournamentCascade(tournament, session)
    );

    res.status(200).json({
      message: `Torneo eliminado junto con ${deletedMatches} partido(s).`
    });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar el torneo", error });
  }
};

export const createTeamInTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;
    const { name, members } = req.body;

    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.status !== "upcoming") {
      res
        .status(400)
        .json({ message: "No se pueden agregar equipos a un torneo iniciado o finalizado" });
      return;
    }
    if (tournament.teams.length >= tournament.numberOfTeams) {
      return void res.status(400).json({
        message: `El torneo ya tiene los ${tournament.numberOfTeams} equipos completos`
      });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    if (!Array.isArray(members) || members.length !== expectedSize) {
      return void res.status(400).json({
        message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
      });
    }

    for (const member of members) {
      if (!member.isGuest && member.playerId) {
        const inOther = tournament.teams.some((t) =>
          t.players.some(
            (p) => p.playerId && p.playerId.toString() === member.playerId.toString()
          )
        );
        if (inOther) {
          return void res.status(400).json({
            message: `El jugador ${member.name || member.playerId} ya está en otro equipo de este torneo`
          });
        }
      }
    }

    const newPlayers: IdentifiablePlayer[] = members.map(
      (member: { playerId?: string; name: string; isGuest?: boolean }) => ({
        playerId: member.playerId,
        name: member.name,
        isGuest: !!member.isGuest
      })
    );
    const capDenial = await enforceLeagueCap(tournament.league, newPlayers, req.authUser!.id);
    if (capDenial) return void res.status(402).json(capDenial);

    const newTeam: ITeam = {
      teamId: new mongoose.Types.ObjectId(),
      name,
      registeredBy: req.user ? new mongoose.Types.ObjectId(req.user) : undefined,
      players: members.map(
        (member: { playerId?: string; name: string; isGuest?: boolean }) => ({
          playerId: member.playerId
            ? new mongoose.Types.ObjectId(member.playerId)
            : undefined,
          name: member.name,
          isGuest: !!member.isGuest
        })
      )
    };

    tournament.teams.push(newTeam);
    await tournament.save();

    res.status(201).json({ message: "Equipo creado en el torneo", team: newTeam });
  } catch (error) {
    res.status(500).json({ message: "Error al crear equipo", error });
  }
};

export const removeTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId, teamId } = req.params;
    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado." });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({
        message: "No se pueden quitar equipos de un torneo iniciado"
      });
    }

    const team = tournament.teams.find((t) => t.teamId.toString() === teamId);
    if (!team) {
      return void res.status(404).json({ message: "Equipo no encontrado." });
    }

    const canManage = await canManageTournament(tournament, req.authUser);
    const isCaptain = team.registeredBy?.toString() === req.user;
    if (!canManage && !isCaptain) {
      return void res.status(403).json({
        message: "Solo un organizador del torneo o quien inscribió el equipo puede eliminarlo"
      });
    }

    tournament.teams = tournament.teams.filter(
      (t) => t.teamId.toString() !== teamId
    );
    await tournament.save();

    res.status(200).json({ message: "Equipo eliminado correctamente." });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar el equipo", error });
  }
};

export const registerToTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.status !== "upcoming") {
      res
        .status(400)
        .json({ message: "Las inscripciones están cerradas para este torneo" });
      return;
    }

    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
      const { teamName, members } = req.body as {
        teamName?: string;
        members?: Array<{ playerId?: string; name?: string; isGuest?: boolean }>;
      };

      if (!teamName || typeof teamName !== "string") {
        return void res.status(400).json({ message: "Falta el nombre del equipo" });
      }
      if (!Array.isArray(members) || members.length === 0) {
        return void res.status(400).json({ message: "Falta la lista de miembros" });
      }
      const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
      if (members.length !== expectedSize) {
        return void res.status(400).json({
          message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
        });
      }

      const registeredMembers = members.filter((m) => !m.isGuest);
      const guestMembers = members.filter((m) => m.isGuest);
      if (registeredMembers.some((m) => !m.playerId)) {
        return void res.status(400).json({ message: "Falta el usuario de algún miembro" });
      }
      if (guestMembers.some((m) => !m.name || !m.name.trim())) {
        return void res.status(400).json({ message: "Falta el nombre de algún invitado" });
      }

      const memberUserIds = registeredMembers.map((m) => m.playerId as string);
      if (!memberUserIds.includes(userId)) {
        return void res.status(400).json({
          message: "Quien se inscribe debe ser parte del equipo"
        });
      }
      const uniqueIds = new Set(memberUserIds);
      if (uniqueIds.size !== memberUserIds.length) {
        return void res.status(400).json({ message: "Hay miembros duplicados en el equipo" });
      }
      if (tournament.teams.length >= tournament.numberOfTeams) {
        return void res.status(400).json({ message: "El torneo ya está completo" });
      }

      for (const memberId of memberUserIds) {
        const inOther = tournament.teams.some((t) =>
          t.players.some((p) => p.playerId && p.playerId.toString() === memberId)
        );
        if (inOther) {
          return void res.status(400).json({
            message: "Uno de los miembros ya está inscripto en otro equipo del torneo"
          });
        }
      }

      const users = await User.find({ _id: { $in: memberUserIds } });
      if (users.length !== memberUserIds.length) {
        return void res.status(400).json({ message: "Algún miembro no existe" });
      }

      const newPlayers: IdentifiablePlayer[] = [
        ...users.map((u) => ({ playerId: u._id, isGuest: false })),
        ...guestMembers.map((g) => ({ name: g.name, isGuest: true }))
      ];
      const capDenial = await enforceLeagueCap(tournament.league, newPlayers, req.authUser!.id);
      if (capDenial) return void res.status(402).json(capDenial);

      const newTeam: ITeam = {
        teamId: new mongoose.Types.ObjectId(),
        name: teamName,
        registeredBy: new mongoose.Types.ObjectId(userId),
        players: [
          ...users.map((u) => ({
            playerId: u._id as mongoose.Types.ObjectId,
            name: u.username,
            isGuest: false
          })),
          ...guestMembers.map((g) => ({
            name: g.name!.trim(),
            isGuest: true
          }))
        ]
      };

      const updateResult = await TournamentModel.updateOne(
        {
          _id: tournament._id,
          status: "upcoming",
          $expr: { $lt: [{ $size: "$teams" }, tournament.numberOfTeams] }
        },
        { $push: { teams: newTeam } }
      );

      if (updateResult.modifiedCount === 0) {
        return void res.status(409).json({
          message: "No se pudo inscribir el equipo (cupos llenos o estado cambió)"
        });
      }

      void notifyTournamentSignup(
        users.map((u) => ({
          _id: u._id,
          email: u.email,
          username: u.username,
          notificationPrefs: u.notificationPrefs
        })),
        tournament.name,
        String(tournament._id)
      );

      return void res.status(201).json({ message: "Equipo inscripto", team: newTeam });
    }

    if (isUserAlreadyInTournament(tournament, userId)) {
      return void res.status(400).json({ message: "Ya estás inscripto en este torneo" });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    const targetSignups = tournament.numberOfTeams * expectedSize;
    if (countFilledSlots(tournament) >= targetSignups) {
      return void res.status(400).json({ message: "El torneo ya está completo" });
    }
    // Los equipos fijos (cargados enteros a mano) también ocupan cupo aunque no
    // estén en `individualSignups`, así que el tope efectivo del pool es
    // `targetSignups` menos lo que ya ocupan esos equipos fijos.
    const fixedSlots = tournament.teams.filter((t) => !t.isDrawn).length * expectedSize;
    const signupCap = targetSignups - fixedSlots;

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const capDenial = await enforceLeagueCap(
      tournament.league,
      [{ playerId: userDoc._id, isGuest: false }],
      req.authUser!.id
    );
    if (capDenial) return void res.status(402).json(capDenial);

    const result = await TournamentModel.updateOne(
      {
        _id: tournament._id,
        status: "upcoming",
        $expr: { $lt: [{ $size: "$individualSignups" }, signupCap] },
        "individualSignups.userId": { $ne: new mongoose.Types.ObjectId(userId) }
      },
      {
        $push: {
          individualSignups: {
            signupId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(userId),
            name: userDoc.username,
            isGuest: false
          }
        }
      }
    );
    if (result.modifiedCount === 0) {
      return void res.status(409).json({
        message: "No se pudo inscribir (cupos llenos, ya inscripto o estado cambió)"
      });
    }

    void notifyTournamentSignup(
      [{
        _id: userDoc._id,
        email: userDoc.email,
        username: userDoc.username,
        notificationPrefs: userDoc.notificationPrefs
      }],
      tournament.name,
      String(tournament._id)
    );

    res.status(201).json({ message: "Inscripción registrada" });
  } catch (error) {
    res.status(500).json({ message: "Error al inscribirse al torneo", error });
  }
};

export const unregisterFromTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.status !== "upcoming") {
      res
        .status(400)
        .json({ message: "No se puede desinscribir de un torneo iniciado o finalizado" });
      return;
    }

    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
      const team = tournament.teams.find((t) => t.registeredBy?.toString() === userId);
      if (!team) {
        return void res.status(404).json({
          message: "No tenés un equipo inscripto en este torneo"
        });
      }
      tournament.teams = tournament.teams.filter(
        (t) => t.teamId.toString() !== team.teamId.toString()
      );
      await tournament.save();
      return void res.status(200).json({ message: "Equipo desinscripto" });
    }

    const { removed } = removeSignupsFromTournament(
      tournament,
      (s) => !!s.userId && s.userId.toString() === userId
    );
    if (removed === 0) {
      return void res.status(404).json({ message: "No estás inscripto en este torneo" });
    }
    await tournament.save();
    res.status(200).json({ message: "Desinscripción exitosa" });
  } catch (error) {
    res.status(500).json({ message: "Error al desinscribirse", error });
  }
};

export const addGuestTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, members } = req.body as {
      name?: string;
      members?: Array<{ playerId?: string; name: string; isGuest?: boolean }>;
    };

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      res
        .status(403)
        .json({ message: "No tenés permisos para gestionar este torneo" });
      return;
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició" });
    }
    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.CREATOR_FORMED) {
      return void res.status(400).json({
        message: "En este modo agregá jugadores al torneo y después armá los equipos"
      });
    }
    if (!name || !Array.isArray(members) || members.length === 0) {
      return void res.status(400).json({ message: "Faltan datos del equipo" });
    }
    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    if (members.length !== expectedSize) {
      return void res.status(400).json({
        message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
      });
    }

    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
      if (tournament.teams.length >= tournament.numberOfTeams) {
        return void res.status(400).json({ message: `Ya hay ${tournament.numberOfTeams} equipos` });
      }
    } else {
      const target = tournament.numberOfTeams * expectedSize;
      const taken = countFilledSlots(tournament);
      if (taken + members.length > target) {
        return void res.status(400).json({
          message: "Agregar este equipo excede los cupos del torneo"
        });
      }
    }

    const newPlayers: IdentifiablePlayer[] = members.map((m) => ({
      playerId: m.playerId,
      name: m.name,
      isGuest: !!m.isGuest
    }));
    const capDenial = await enforceLeagueCap(tournament.league, newPlayers, req.authUser!.id);
    if (capDenial) return void res.status(402).json(capDenial);

    const newTeam: ITeam = {
      teamId: new mongoose.Types.ObjectId(),
      name,
      registeredBy: req.user ? new mongoose.Types.ObjectId(req.user) : undefined,
      players: members.map((m) => ({
        playerId: m.playerId ? new mongoose.Types.ObjectId(m.playerId) : undefined,
        name: m.name,
        isGuest: !!m.isGuest
      }))
    };

    tournament.teams.push(newTeam);
    await tournament.save();
    res.status(201).json({ message: "Equipo de invitados agregado", team: newTeam });
  } catch (error) {
    res.status(500).json({ message: "Error al agregar equipo de invitados", error });
  }
};

export const creatorAddSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, userIds, guestNames } = req.body as {
      userId?: string;
      userIds?: string[];
      guestNames?: string[];
    };

    const tournament = await TournamentModel.findById(id);
    if (!tournament) return void res.status(404).json({ message: "Torneo no encontrado" });
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "Las inscripciones están cerradas" });
    }
    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
      return void res.status(400).json({
        message: "Este endpoint no aplica en modo 'user-formed'. Usá POST /:tournamentId/teams"
      });
    }

    // Compatibilidad con el body legado { userId } de un solo usuario.
    const allUserIds = [...(userIds ?? [])];
    if (userId) allUserIds.push(userId);
    const allGuestNames = (guestNames ?? []).map((n) => n.trim()).filter(Boolean);

    if (allUserIds.length === 0 && allGuestNames.length === 0) {
      return void res.status(400).json({ message: "Falta userId, userIds o guestNames" });
    }

    const uniqueUserIds = Array.from(new Set(allUserIds));
    const users = await User.find({ _id: { $in: uniqueUserIds } });
    if (users.length !== uniqueUserIds.length) {
      return void res.status(404).json({ message: "Algún usuario no existe" });
    }

    const alreadyIn = new Set(
      tournament.individualSignups
        .filter((s) => s.userId)
        .map((s) => s.userId!.toString())
    );
    const duplicate = uniqueUserIds.find((uid) => alreadyIn.has(uid));
    if (duplicate) {
      return void res.status(409).json({ message: "Un usuario ya está inscripto" });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    const targetSignups = tournament.numberOfTeams * expectedSize;
    const incoming = uniqueUserIds.length + allGuestNames.length;
    const taken = countFilledSlots(tournament);
    if (taken + incoming > targetSignups) {
      return void res.status(400).json({
        message: `Cupos insuficientes: quedan ${targetSignups - taken} lugares`
      });
    }

    // Alta masiva: el chequeo de cupo de LIGA rechaza el lote entero si no
    // entra completo (no acepta parcialmente — un alta parcial silenciosa es
    // peor que un error claro).
    const newPlayers: IdentifiablePlayer[] = [
      ...users.map((u) => ({ playerId: u._id, isGuest: false })),
      ...allGuestNames.map((name) => ({ name, isGuest: true }))
    ];
    const capDenial = await enforceLeagueCap(tournament.league, newPlayers, req.authUser!.id);
    if (capDenial) return void res.status(402).json(capDenial);

    const newSignups: IIndividualSignup[] = [
      ...users.map((u) => ({
        signupId: new mongoose.Types.ObjectId(),
        userId: u._id as mongoose.Types.ObjectId,
        name: u.username,
        isGuest: false
      })),
      ...allGuestNames.map((name) => ({
        signupId: new mongoose.Types.ObjectId(),
        name,
        isGuest: true
      }))
    ];

    tournament.individualSignups.push(...newSignups);
    await tournament.save();

    // Los `guestNames` no tienen cuenta ni email: solo se avisa a los `users` reales.
    if (users.length > 0) {
      void notifyTournamentSignup(
        users.map((u) => ({
          _id: u._id,
          email: u.email,
          username: u.username,
          notificationPrefs: u.notificationPrefs
        })),
        tournament.name,
        String(tournament._id)
      );
    }

    res.status(201).json({
      message: `${newSignups.length} inscripto(s) agregado(s)`,
      signups: newSignups
    });
  } catch (error) {
    res.status(500).json({ message: "Error al inscribir jugador", error });
  }
};

export const creatorRemoveSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, signupId } = req.params;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) return void res.status(404).json({ message: "Torneo no encontrado" });
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició" });
    }
    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.USER_FORMED) {
      return void res.status(400).json({
        message: "Este endpoint no aplica en modo 'user-formed'. Usá DELETE /:tournamentId/teams/:teamId"
      });
    }

    const { removed, teamsTouched, teamsDropped } = removeSignupsFromTournament(
      tournament,
      (s) => s.signupId.toString() === signupId
    );
    if (removed === 0) {
      return void res.status(404).json({ message: "El inscripto no existe" });
    }
    await tournament.save();
    const incompleteRemaining = teamsTouched - teamsDropped;
    res.status(200).json({
      message:
        incompleteRemaining > 0
          ? `Jugador quitado del torneo. Quedó ${incompleteRemaining} equipo(s) incompleto(s).`
          : "Jugador quitado del torneo"
    });
  } catch (error) {
    res.status(500).json({ message: "Error al quitar jugador", error });
  }
};

/**
 * Reemplaza de una vez la composición de los equipos editables del torneo
 * (el "roster editor" de mover/intercambiar jugadores). No agrega ni quita
 * gente del torneo, solo reparte: la validación central es que el
 * multiconjunto de jugadores del payload coincida con el universo movible
 * (ver `validateRosterPayload`). Preserva los cruces guardados
 * (`draftPairOrder`) salvo que haya cambiado el conjunto de equipos.
 */
export const replaceTournamentRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({
        message: "Solo se pueden reorganizar los equipos de un torneo que aún no comenzó"
      });
    }

    const result = validateRosterPayload({
      payload: req.body,
      teamFormationMode: tournament.teamFormationMode,
      teamSize: FORMAT_TEAM_SIZE[tournament.format],
      numberOfTeams: tournament.numberOfTeams,
      existingTeams: tournament.teams,
      individualSignups: tournament.individualSignups
    });

    if (!result.ok) {
      return void res.status(result.status).json({ message: result.error });
    }

    tournament.teams = result.teams;
    tournament.rosterEditedAt = new Date();
    if (result.draftInvalidated) {
      tournament.draftPairOrder = undefined;
    }
    await tournament.save();

    res.status(200).json({
      message: "Equipos actualizados",
      teams: tournament.teams,
      draftInvalidated: result.draftInvalidated
    });
  } catch (error) {
    res.status(500).json({ message: "Error al reorganizar los equipos", error });
  }
};

const teamToMatchTeam = (team: ITeam) => ({
  teamId: team.teamId,
  score: 0,
  players: team.players.map((p) => ({
    playerId: p.playerId,
    username: p.name,
    isGuest: !!p.isGuest
  }))
});

/**
 * Sortea (o re-sortea) el torneo sin iniciarlo: arma los equipos faltantes en modo
 * aleatorio y guarda un orden de cruces tentativo (`draftPairOrder`) para preview.
 * Descarta cualquier sorteo previo (equipos con `isDrawn`) pero preserva los
 * equipos que el creador haya precargado a mano. `individualSignups` NO se vacía:
 * es la fuente de verdad que permite re-sortear las veces que haga falta.
 */
export const drawTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició o finalizó" });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    const numberOfTeams = tournament.numberOfTeams;

    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.RANDOM) {
      // Solo en random el sorteo rearma los equipos desde cero: descarta el
      // sorteo previo (pero preserva los equipos fijos, que no tienen isDrawn)
      // y vuelve a repartir el pool. En los otros modos los equipos ya están
      // armados (por los jugadores o a mano) y este endpoint solo sortea los
      // cruces, así que NO hay que tocar `tournament.teams` acá.
      tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
      const totalSlots = numberOfTeams * expectedSize;
      const filledFromTeams = tournament.teams.length * expectedSize;
      const filledFromSignups = tournament.individualSignups.length;
      if (filledFromTeams + filledFromSignups !== totalSlots) {
        return void res.status(400).json({
          message: `Faltan jugadores: ${filledFromTeams + filledFromSignups}/${totalSlots}`
        });
      }
      const teamsNeeded = numberOfTeams - tournament.teams.length;
      const drawnTeams = buildDrawnTeams(
        tournament.individualSignups,
        expectedSize,
        teamsNeeded,
        tournament.teams.length,
        tournament.guestDrawMode
      );
      tournament.teams.push(...drawnTeams);
      // Se rearmaron los equipos desde cero: cualquier edición manual previa
      // ya no aplica.
      tournament.rosterEditedAt = undefined;
    } else {
      if (tournament.teams.length !== numberOfTeams) {
        return void res.status(400).json({
          message: `Faltan equipos: ${tournament.teams.length}/${numberOfTeams}`
        });
      }
      if (tournament.teamFormationMode === TEAM_FORMATION_MODES.CREATOR_FORMED) {
        const incomplete = tournament.teams.some((t) => t.players.length !== expectedSize);
        if (incomplete) {
          return void res.status(400).json({
            message: "Todos los equipos deben estar completos antes de sortear los cruces"
          });
        }
      }
    }

    const draftPairOrder = shuffle(tournament.teams).map((t) => t.teamId);
    tournament.draftPairOrder = draftPairOrder;
    await tournament.save();

    // El sorteo reparte los N equipos igual que lo hará `startTournament`: los
    // primeros `2*matches` juegan la primera ronda de a pares consecutivos, el
    // resto (solo si N no es potencia de 2) descansa y entra directo a la
    // ronda siguiente — ver `buildBracket` en utils/bracket.ts.
    const plan = buildBracket(numberOfTeams);
    const matches = plan.firstRoundSlots.length;
    const pairOrderTeams = draftPairOrder.map(
      (tid) => tournament.teams.find((t) => t.teamId.toString() === tid.toString())!
    );
    const pairings = plan.firstRoundSlots.map((slot, i) => ({
      slot,
      teamIds: [pairOrderTeams[i * 2].teamId, pairOrderTeams[i * 2 + 1].teamId]
    }));
    const resting = pairOrderTeams.slice(matches * 2).map((t) => ({ teamId: t.teamId, name: t.name }));

    res.status(200).json({ teams: tournament.teams, pairings, resting });
  } catch (error) {
    res.status(500).json({ message: "Error al sortear el torneo", error });
  }
};

export const startTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { mode, pairings, resting: restingBody } = req.body as {
      mode?: "random" | "manual";
      pairings?: Array<{ slot: string; teamIds: string[] }>;
      /** Solo en modo manual: teamIds de los equipos que descansan la 1ra ronda. */
      resting?: string[];
    };

    if (mode !== "random" && mode !== "manual") {
      return void res.status(400).json({ message: "Modo inválido (random | manual)" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (!(await canManageTournament(tournament, req.authUser))) {
      return void res.status(403).json({ message: "No tenés permisos para gestionar este torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició o finalizó" });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    const numberOfTeams = tournament.numberOfTeams;
    const hasDraft =
      Array.isArray(tournament.draftPairOrder) &&
      tournament.draftPairOrder.length === numberOfTeams;

    // Si ya se sorteó desde /draw, los equipos están armados y no hay que tocar nada acá.
    // Si no (alguien inicia sin pasar por el preview), se arma inline como antes.
    if (!hasDraft) {
      if (tournament.teamFormationMode === TEAM_FORMATION_MODES.RANDOM) {
        tournament.teams = tournament.teams.filter((t) => !t.isDrawn);
        const totalSlots = numberOfTeams * expectedSize;
        const filledFromTeams = tournament.teams.length * expectedSize;
        const filledFromSignups = tournament.individualSignups.length;
        if (filledFromTeams + filledFromSignups !== totalSlots) {
          return void res.status(400).json({
            message: `Faltan jugadores: ${filledFromTeams + filledFromSignups}/${totalSlots}`
          });
        }
        const teamsNeeded = numberOfTeams - tournament.teams.length;
        const drawnTeams = buildDrawnTeams(
          tournament.individualSignups,
          expectedSize,
          teamsNeeded,
          tournament.teams.length,
          tournament.guestDrawMode
        );
        tournament.teams.push(...drawnTeams);
      } else {
        if (tournament.teams.length !== numberOfTeams) {
          return void res.status(400).json({
            message: `Faltan equipos: ${tournament.teams.length}/${numberOfTeams}`
          });
        }
        if (tournament.teamFormationMode === TEAM_FORMATION_MODES.CREATOR_FORMED) {
          const incomplete = tournament.teams.some((t) => t.players.length !== expectedSize);
          if (incomplete) {
            return void res.status(400).json({
              message: "Todos los equipos deben estar completos antes de iniciar"
            });
          }
        }
      }
    }

    // Cuadro del torneo: `matches` cruces de primera ronda + (si N no es
    // potencia de 2) `restCount` equipos que la primera ronda no alcanza a
    // emparejar y entran directo a la ronda siguiente (ver utils/bracket.ts).
    const plan = buildBracket(numberOfTeams);
    const matches = plan.firstRoundSlots.length;
    const restCount = plan.restEntrySlots.length;

    let pairOrder: ITeam[];
    if (mode === "random" && hasDraft) {
      pairOrder = tournament
        .draftPairOrder!.map((tid) =>
          tournament.teams.find((t) => t.teamId.toString() === tid.toString())
        )
        .filter((t): t is ITeam => !!t);
      if (pairOrder.length !== numberOfTeams) {
        return void res.status(400).json({
          message: "El sorteo guardado no coincide con los equipos actuales, volvé a sortear"
        });
      }
    } else if (mode === "random") {
      pairOrder = shuffle(tournament.teams);
    } else {
      if (!Array.isArray(pairings) || pairings.length !== matches) {
        return void res.status(400).json({
          message: `pairings debe tener ${matches} entrada(s), una por cruce de la primera ronda`
        });
      }
      const seen = new Set<string>();
      const pairOrderTmp: ITeam[] = [];
      for (const slot of plan.firstRoundSlots) {
        const entry = pairings.find((p) => p.slot === slot);
        if (!entry) {
          return void res.status(400).json({ message: `Falta el slot ${slot} en pairings` });
        }
        if (!Array.isArray(entry.teamIds) || entry.teamIds.length !== 2) {
          res
            .status(400)
            .json({ message: `El slot ${slot} debe tener exactamente 2 teamIds` });
          return;
        }
        for (const tid of entry.teamIds) {
          if (seen.has(tid)) {
            return void res.status(400).json({ message: `teamId duplicado: ${tid}` });
          }
          seen.add(tid);
          const team = tournament.teams.find((t) => t.teamId.toString() === tid);
          if (!team) {
            res
              .status(400)
              .json({ message: `teamId no pertenece al torneo: ${tid}` });
            return;
          }
          pairOrderTmp.push(team);
        }
      }

      // Solo hace falta indicar quién descansa cuando el cuadro tiene
      // descansos (N no es potencia de 2). Con cuadro parejo, `resting` debe
      // venir vacío: no hay nadie que descanse.
      const restingIds = Array.isArray(restingBody) ? restingBody : [];
      if (restingIds.length !== restCount) {
        return void res.status(400).json({
          message:
            restCount === 0
              ? "Este cuadro no tiene descansos: no se debe enviar 'resting'"
              : `Falta indicar quién descansa: 'resting' debe tener ${restCount} equipo(s)`
        });
      }
      const restingTeamsTmp: ITeam[] = [];
      for (const tid of restingIds) {
        if (seen.has(tid)) {
          return void res.status(400).json({ message: `teamId duplicado: ${tid}` });
        }
        seen.add(tid);
        const team = tournament.teams.find((t) => t.teamId.toString() === tid);
        if (!team) {
          res.status(400).json({ message: `teamId no pertenece al torneo: ${tid}` });
          return;
        }
        restingTeamsTmp.push(team);
      }

      if (seen.size !== numberOfTeams) {
        return void res.status(400).json({
          message: `pairings y resting deben incluir entre los dos los ${numberOfTeams} equipos, sin duplicados`
        });
      }
      pairOrder = [...pairOrderTmp, ...restingTeamsTmp];
    }

    const slotToMatchId = new Map<string, mongoose.Types.ObjectId>();
    for (const node of plan.nodes) {
      const firstRoundIndex = plan.firstRoundSlots.indexOf(node.slot);
      const isFirstRound = firstRoundIndex !== -1;
      const teamsForMatch = isFirstRound
        ? [pairOrder[firstRoundIndex * 2], pairOrder[firstRoundIndex * 2 + 1]].map(teamToMatchTeam)
        : [];

      const m = await Match.create({
        tournament: tournament._id,
        teams: teamsForMatch,
        status: isFirstRound ? MATCH_STATUS.IN_PROGRESS : MATCH_STATUS.PENDING,
        type: MATCH_TYPES.TOURNAMENT,
        phase: node.phase,
        bracketSlot: node.slot
      });
      slotToMatchId.set(node.slot, m._id as mongoose.Types.ObjectId);
    }

    for (const node of plan.nodes) {
      const matchId = slotToMatchId.get(node.slot);
      if (!matchId) continue;
      const update: Record<string, mongoose.Types.ObjectId> = {};
      if (node.winnerTo) update.feedsWinnerTo = slotToMatchId.get(node.winnerTo)!;
      if (node.loserTo) update.feedsLoserTo = slotToMatchId.get(node.loserTo)!;
      if (Object.keys(update).length > 0) {
        await Match.updateOne({ _id: matchId }, { $set: update });
      }
    }

    // Los equipos que descansan la 1ra ronda (solo si N no es potencia de 2)
    // no tienen partido que esperar: se precargan ya mismo en el slot que les
    // toca (`restEntrySlots`), con el mismo mecanismo que usa `propagate()`
    // para cualquier otro avance (empujar equipo, pasar a IN_PROGRESS al
    // llegar a 2). Es la única parte del arranque del torneo que no sale de
    // jugar un partido: el resto de la propagación ya la resuelve el flujo
    // normal de resultados.
    const restingTeams = pairOrder.slice(matches * 2);
    for (let k = 0; k < restingTeams.length; k++) {
      const targetMatchId = slotToMatchId.get(plan.restEntrySlots[k]);
      if (!targetMatchId) continue;
      const target = await Match.findById(targetMatchId);
      if (!target) continue;
      target.teams.push(teamToMatchTeam(restingTeams[k]) as unknown as (typeof target.teams)[number]);
      if (target.teams.length === 2 && target.status === MATCH_STATUS.PENDING) {
        target.status = MATCH_STATUS.IN_PROGRESS;
      }
      await target.save();
    }

    tournament.matches = Array.from(slotToMatchId.values());
    tournament.individualSignups = [];
    tournament.draftPairOrder = undefined;
    tournament.rosterEditedAt = undefined;
    tournament.status = "in_progress";
    await tournament.save();

    // `pairOrder[0]` y `pairOrder[1]` se enfrentan en el primer cruce,
    // `pairOrder[2]`/`pairOrder[3]` en el segundo, etc. — mismo orden que arma
    // el cuadro más arriba. Los que descansan (el resto de `pairOrder`) no
    // tienen rival todavía: se avisan igual, con `opponent: null` (la
    // plantilla de mail ya contempla ese caso — "Todavía no tenés rival
    // asignado.").
    interface StartedPlayerInfo {
      playerId: string;
      teammates: string[];
      opponent: string | null;
    }
    const playerInfos: StartedPlayerInfo[] = [];
    const collectStartedPlayers = (team: ITeam, rival: ITeam | null) => {
      for (const player of team.players) {
        if (!player.playerId) continue; // invitados: sin cuenta, sin email.
        playerInfos.push({
          playerId: player.playerId.toString(),
          teammates: team.players.filter((p) => p !== player).map((p) => p.name),
          opponent: rival?.name ?? null
        });
      }
    };
    for (let i = 0; i < matches; i++) {
      collectStartedPlayers(pairOrder[i * 2], pairOrder[i * 2 + 1]);
      collectStartedPlayers(pairOrder[i * 2 + 1], pairOrder[i * 2]);
    }
    for (const team of restingTeams) {
      collectStartedPlayers(team, null);
    }
    if (playerInfos.length > 0) {
      const recipients = await resolveUsers(playerInfos.map((p) => p.playerId));
      const byId = new Map(recipients.map((u) => [String(u._id), u]));
      const startedEntries: TournamentStartedEntry[] = playerInfos.flatMap((info) => {
        const user = byId.get(info.playerId);
        return user ? [{ user, teammates: info.teammates, opponent: info.opponent }] : [];
      });
      void notifyTournamentStarted(startedEntries, tournament.name, String(tournament._id));
    }

    res.status(200).json({ message: "Torneo iniciado", tournament });
  } catch (error) {
    console.error("Error iniciando torneo:", error);
    res.status(500).json({ message: "Error al iniciar el torneo", error });
  }
};

export const getTournamentLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    const sorted = [...tournament.playerStats].sort((a, b) => a.position - b.position);
    res.status(200).json({ status: tournament.status, playerStats: sorted });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el ranking", error });
  }
};

/**
 * Puntos y posiciones finales del torneo, a partir de sus partidos. Un slot
 * puede decidir un solo lado (el perdedor, cuando la zona era de tamaño
 * impar — ver `positionsFromSlot` en `utils/bracket.ts`) o los dos a la vez
 * (el caso normal, zona de 2): por eso cada lado se evalúa independiente.
 */
export const computePlayerStats = async (
  tournament: ITournament
): Promise<IPlayerStat[]> => {
  const matches = await Match.find({ tournament: tournament._id });
  const stats: IPlayerStat[] = [];
  if (!POINTS_TABLE[tournament.type as keyof typeof POINTS_TABLE]) return stats;

  const pushStats = (team: IMatchTeam | undefined, position: number) => {
    if (!team) return;
    for (const p of team.players) {
      stats.push({
        playerId: p.playerId,
        name: p.username || "Invitado",
        isGuest: !!p.isGuest,
        position,
        points: pointsForPosition(tournament.type, position, tournament.numberOfTeams)
      });
    }
  };

  for (const m of matches) {
    if (!m.bracketSlot) continue;
    if (m.status !== MATCH_STATUS.FINISHED) continue;
    if (!m.winner || !m.losingTeam) continue;
    const outcome = positionsFromSlot(m.bracketSlot);
    if (!outcome) continue;

    const teamWinner = m.teams.find((t) => t.teamId.toString() === m.winner!.toString());
    const teamLoser = m.teams.find((t) => t.teamId.toString() === m.losingTeam!.toString());

    if (outcome.winner !== null) pushStats(teamWinner, outcome.winner);
    if (outcome.loser !== null) pushStats(teamLoser, outcome.loser);
  }
  return stats;
};

/** Suma al ranking global los puntos de `playerStats`. No persiste el torneo. */
export const awardTournamentPoints = async (
  tournament: ITournament,
  session?: ClientSession
): Promise<void> => {
  if (tournament.pointsAwarded) return;
  for (const s of tournament.playerStats) {
    if (s.isGuest || !s.playerId) continue;
    if (s.points <= 0) continue;
    await User.updateOne({ _id: s.playerId }, { $inc: { totalPoints: s.points } }, { session });
  }
  tournament.pointsAwarded = true;
};

/**
 * Descuenta del ranking global los puntos que este torneo había otorgado.
 * Usa un pipeline de update para que `totalPoints` nunca quede negativo.
 * No persiste el torneo.
 */
export const revertTournamentPoints = async (
  tournament: ITournament,
  session?: ClientSession
): Promise<void> => {
  if (!tournament.pointsAwarded) return;
  for (const s of tournament.playerStats) {
    if (s.isGuest || !s.playerId) continue;
    if (s.points <= 0) continue;
    await User.updateOne(
      { _id: s.playerId },
      [
        {
          $set: {
            totalPoints: {
              $max: [0, { $subtract: [{ $ifNull: ["$totalPoints", 0] }, s.points] }]
            }
          }
        }
      ],
      { session }
    );
  }
  tournament.pointsAwarded = false;
};

/**
 * Borra el torneo y todo lo que lo referencia: los puntos que repartió al
 * ranking global y sus partidos. Lo embebido en el documento (equipos,
 * inscriptos, `playerStats`) se va con él.
 *
 * No hace falta tocar ninguna liga: el vínculo torneo↔liga vive en
 * `Tournament.league` (no en un array del lado de la liga), así que muere
 * junto con el documento sin ningún paso extra. La tabla de posiciones de la
 * liga es derivada (`computeLeagueStandings`), así que se corrige sola en la
 * próxima lectura.
 *
 * Si el torneo se cobró contra el cupo MENSUAL (plan pago) y se borra dentro
 * del mismo período en que se creó, ese cupo se devuelve. El cupo del plan
 * `free` (`tournamentsTotal`) NUNCA se devuelve — ver `releaseTournamentSlot`.
 *
 * No abre transacción por su cuenta: quien la llame debería envolverla en
 * `withTransaction` y pasarle la sesión.
 */
export const deleteTournamentCascade = async (
  tournament: ITournament,
  session?: ClientSession
): Promise<{ deletedMatches: number }> => {
  await revertTournamentPoints(tournament, session);

  if (tournament.billing?.plan && tournament.billing.plan !== "free") {
    await releaseTournamentSlot(tournament.createdBy.toString(), tournament.billing.periodKey, session);
  }

  const deleted = await Match.deleteMany({ tournament: tournament._id }, { session });

  // El logo vive en su propia colección, así que no se va con el documento del
  // torneo: sin este borrado quedan binarios huérfanos en Mongo para siempre.
  await TournamentLogoModel.deleteOne({ tournamentId: tournament._id }, { session });

  await tournament.deleteOne({ session });

  return {
    deletedMatches: deleted.deletedCount ?? 0
  };
};

/**
 * Avisa el resultado final a cada jugador registrado de `tournament.playerStats`
 * (los invitados no tienen cuenta ni email — mismo filtro que `awardTournamentPoints`).
 * Se usa tanto desde el cierre automático (`closeTournament`) como desde el
 * cierre forzado por un admin (`forceCloseTournament`), nunca desde
 * `recalculateTournamentPoints`: ese solo corrige puntos, no vuelve a "cerrar" nada.
 */
export const notifyTournamentClosedFromStats = (tournament: ITournament): void => {
  const registered = tournament.playerStats.filter((s) => !s.isGuest && s.playerId);
  if (registered.length === 0) return;

  void (async () => {
    const recipients = await resolveUsers(registered.map((s) => s.playerId!.toString()));
    const byId = new Map(recipients.map((u) => [String(u._id), u]));
    const entries: TournamentClosedEntry[] = registered.flatMap((s) => {
      const user = byId.get(s.playerId!.toString());
      return user ? [{ user, position: s.position, points: s.points }] : [];
    });
    await notifyTournamentClosed(entries, tournament.name, String(tournament._id));
  })();
};

export const closeTournament = async (
  tournamentId: mongoose.Types.ObjectId | string
): Promise<void> => {
  const tournament = await TournamentModel.findById(tournamentId);
  if (!tournament) return;
  if (tournament.pointsAwarded) return;
  if (tournament.status === "completed") return;

  tournament.playerStats = await computePlayerStats(tournament);
  tournament.status = "completed";

  await awardTournamentPoints(tournament);
  await tournament.save();

  notifyTournamentClosedFromStats(tournament);
};
