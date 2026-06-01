import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Match from "../models/Match";
import TournamentModel, {
  ITournament,
  ITeam,
  IPlayer,
  IPlayerStat
} from "../models/Tournament";
import {
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TEAM_FORMATION_MODES,
  FORMAT_TEAM_SIZE,
  TOURNAMENT_TEAMS_COUNT,
  POINTS_TABLE,
  BRACKET_SLOTS,
  MATCH_PHASES,
  MATCH_STATUS,
  MATCH_TYPES
} from "../config/constants";

interface AuthRequest extends Request {
  user?: string;
}

const isValidTournamentType = (value: unknown): value is keyof typeof POINTS_TABLE =>
  value === TOURNAMENT_TYPES.GRAND_SLAM || value === TOURNAMENT_TYPES.MASTER_1000;

const isValidFormat = (value: unknown): value is keyof typeof FORMAT_TEAM_SIZE =>
  value === TOURNAMENT_FORMATS.DUOS || value === TOURNAMENT_FORMATS.TRIOS;

const isValidFormationMode = (value: unknown) =>
  value === TEAM_FORMATION_MODES.USER_FORMED ||
  value === TEAM_FORMATION_MODES.RANDOM;

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
    (s) => s.userId.toString() === userId
  );
  if (inSignups) return true;
  return tournament.teams.some((t) =>
    t.players.some((p) => p.playerId && p.playerId.toString() === userId)
  );
};

export const createTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    name,
    startDate,
    description,
    type,
    format,
    teamFormationMode
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

  try {
    const tournament = new TournamentModel({
      name,
      startDate,
      description,
      type,
      format,
      teamFormationMode,
      createdBy,
      status: "upcoming",
      teams: [],
      individualSignups: [],
      matches: [],
      playerStats: [],
      pointsAwarded: false
    });
    await tournament.save();
    res.status(201).json(tournament);
  } catch (error) {
    res.status(400).json({ message: "Error al crear el torneo", error });
  }
};

export const getTournaments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournaments = await TournamentModel.find().sort({ createdAt: -1 });
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los torneos", error });
  }
};

export const getOpenTournaments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tournaments = await TournamentModel.find({ status: "upcoming" }).sort({
      createdAt: -1
    });
    res.status(200).json(tournaments);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener los torneos abiertos", error });
  }
};

export const getTournamentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
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
    if (tournament.createdBy.toString() !== req.user) {
      return void res.status(403).json({ message: "Solo el creador puede modificar el torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({
        message: "Solo se puede modificar un torneo que aún no comenzó"
      });
    }

    const allowed: Array<keyof ITournament> = ["name", "description", "startDate"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (tournament as unknown as Record<string, unknown>)[key as string] = req.body[key];
      }
    }
    await tournament.save();
    res.status(200).json(tournament);
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar el torneo", error });
  }
};

export const deleteTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await TournamentModel.findById(req.params.id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.createdBy.toString() !== req.user) {
      return void res.status(403).json({ message: "Solo el creador puede borrar el torneo" });
    }

    await Match.deleteMany({ tournament: tournament._id });
    await tournament.deleteOne();
    res.status(200).json({ message: "Torneo eliminado con éxito" });
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
    if (tournament.teams.length >= TOURNAMENT_TEAMS_COUNT) {
      return void res.status(400).json({ message: "El torneo ya tiene los 8 equipos completos" });
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

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId, teamId } = req.params;
    const { players } = req.body;

    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado." });
    }
    if (tournament.status !== "upcoming") {
      res
        .status(400)
        .json({ message: "No se pueden modificar equipos en un torneo iniciado" });
      return;
    }

    const teamIndex = tournament.teams.findIndex(
      (team) => team.teamId.toString() === teamId
    );
    if (teamIndex === -1) {
      return void res.status(404).json({ message: "Equipo no encontrado." });
    }

    tournament.teams[teamIndex].players = players;
    await tournament.save();

    res.status(200).json({
      message: "Equipo actualizado correctamente.",
      team: tournament.teams[teamIndex]
    });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el equipo", error });
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

    const isCreator = tournament.createdBy.toString() === req.user;
    const isCaptain = team.registeredBy?.toString() === req.user;
    if (!isCreator && !isCaptain) {
      return void res.status(403).json({
        message: "Solo el creador del torneo o quien inscribió el equipo puede eliminarlo"
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
      const { teamName, memberUserIds } = req.body as {
        teamName?: string;
        memberUserIds?: string[];
      };

      if (!teamName || typeof teamName !== "string") {
        return void res.status(400).json({ message: "Falta el nombre del equipo" });
      }
      if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
        return void res.status(400).json({ message: "Falta la lista de miembros" });
      }
      const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
      if (memberUserIds.length !== expectedSize) {
        return void res.status(400).json({
          message: `El equipo debe tener ${expectedSize} jugadores (formato ${tournament.format})`
        });
      }
      if (!memberUserIds.includes(userId)) {
        return void res.status(400).json({
          message: "Quien se inscribe debe ser parte del equipo"
        });
      }
      const uniqueIds = new Set(memberUserIds);
      if (uniqueIds.size !== memberUserIds.length) {
        return void res.status(400).json({ message: "Hay miembros duplicados en el equipo" });
      }
      if (tournament.teams.length >= TOURNAMENT_TEAMS_COUNT) {
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

      const newTeam: ITeam = {
        teamId: new mongoose.Types.ObjectId(),
        name: teamName,
        registeredBy: new mongoose.Types.ObjectId(userId),
        players: users.map((u) => ({
          playerId: u._id as mongoose.Types.ObjectId,
          name: u.username,
          isGuest: false
        }))
      };

      const updateResult = await TournamentModel.updateOne(
        {
          _id: tournament._id,
          status: "upcoming",
          $expr: { $lt: [{ $size: "$teams" }, TOURNAMENT_TEAMS_COUNT] }
        },
        { $push: { teams: newTeam } }
      );

      if (updateResult.modifiedCount === 0) {
        return void res.status(409).json({
          message: "No se pudo inscribir el equipo (cupos llenos o estado cambió)"
        });
      }

      return void res.status(201).json({ message: "Equipo inscripto", team: newTeam });
    }

    if (isUserAlreadyInTournament(tournament, userId)) {
      return void res.status(400).json({ message: "Ya estás inscripto en este torneo" });
    }

    const targetSignups = TOURNAMENT_TEAMS_COUNT * FORMAT_TEAM_SIZE[tournament.format];
    if (tournament.individualSignups.length >= targetSignups) {
      return void res.status(400).json({ message: "El torneo ya está completo" });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return void res.status(404).json({ message: "Usuario no encontrado" });
    }

    const result = await TournamentModel.updateOne(
      {
        _id: tournament._id,
        status: "upcoming",
        $expr: { $lt: [{ $size: "$individualSignups" }, targetSignups] },
        "individualSignups.userId": { $ne: new mongoose.Types.ObjectId(userId) }
      },
      {
        $push: {
          individualSignups: {
            userId: new mongoose.Types.ObjectId(userId),
            name: userDoc.username
          }
        }
      }
    );
    if (result.modifiedCount === 0) {
      return void res.status(409).json({
        message: "No se pudo inscribir (cupos llenos, ya inscripto o estado cambió)"
      });
    }
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

    const before = tournament.individualSignups.length;
    tournament.individualSignups = tournament.individualSignups.filter(
      (s) => s.userId.toString() !== userId
    );
    if (tournament.individualSignups.length === before) {
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
    if (tournament.createdBy.toString() !== req.user) {
      res
        .status(403)
        .json({ message: "Solo el creador puede agregar equipos de invitados" });
      return;
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició" });
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
      if (tournament.teams.length >= TOURNAMENT_TEAMS_COUNT) {
        return void res.status(400).json({ message: "Ya hay 8 equipos" });
      }
    } else {
      const target = TOURNAMENT_TEAMS_COUNT * expectedSize;
      const taken = tournament.individualSignups.length + tournament.teams.length * expectedSize;
      if (taken + members.length > target) {
        return void res.status(400).json({
          message: "Agregar este equipo excede los cupos del torneo"
        });
      }
    }

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
    const { userId } = req.body as { userId?: string };

    const tournament = await TournamentModel.findById(id);
    if (!tournament) return void res.status(404).json({ message: "Torneo no encontrado" });
    if (tournament.createdBy.toString() !== req.user) {
      return void res.status(403).json({ message: "Solo el creador puede inscribir jugadores" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "Las inscripciones están cerradas" });
    }
    if (tournament.teamFormationMode !== TEAM_FORMATION_MODES.RANDOM) {
      return void res.status(400).json({
        message: "Este endpoint solo aplica en modo de equipos aleatorios. Para el modo 'user-formed' usá POST /:tournamentId/teams"
      });
    }
    if (!userId) return void res.status(400).json({ message: "Falta userId" });

    const userDoc = await User.findById(userId);
    if (!userDoc) return void res.status(404).json({ message: "Usuario no encontrado" });

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];
    const targetSignups = TOURNAMENT_TEAMS_COUNT * expectedSize;

    const result = await TournamentModel.updateOne(
      {
        _id: tournament._id,
        status: "upcoming",
        $expr: { $lt: [{ $size: "$individualSignups" }, targetSignups] },
        "individualSignups.userId": { $ne: new mongoose.Types.ObjectId(userId) }
      },
      {
        $push: {
          individualSignups: {
            userId: new mongoose.Types.ObjectId(userId),
            name: userDoc.username
          }
        }
      }
    );
    if (result.modifiedCount === 0) {
      return void res.status(409).json({
        message: "No se pudo inscribir (cupos llenos o usuario ya inscripto)"
      });
    }
    res.status(201).json({ message: `${userDoc.username} inscripto` });
  } catch (error) {
    res.status(500).json({ message: "Error al inscribir jugador", error });
  }
};

export const creatorRemoveSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;

    const tournament = await TournamentModel.findById(id);
    if (!tournament) return void res.status(404).json({ message: "Torneo no encontrado" });
    if (tournament.createdBy.toString() !== req.user) {
      return void res.status(403).json({ message: "Solo el creador puede quitar jugadores" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició" });
    }
    if (tournament.teamFormationMode !== TEAM_FORMATION_MODES.RANDOM) {
      return void res.status(400).json({
        message: "Este endpoint solo aplica en modo aleatorio. Para el modo 'user-formed' usá DELETE /:tournamentId/teams/:teamId"
      });
    }

    const before = tournament.individualSignups.length;
    tournament.individualSignups = tournament.individualSignups.filter(
      (s) => s.userId.toString() !== userId
    );
    if (tournament.individualSignups.length === before) {
      return void res.status(404).json({ message: "El usuario no estaba inscripto" });
    }
    await tournament.save();
    res.status(200).json({ message: "Jugador quitado del torneo" });
  } catch (error) {
    res.status(500).json({ message: "Error al quitar jugador", error });
  }
};

interface BracketTemplate {
  bracketSlot: typeof BRACKET_SLOTS[keyof typeof BRACKET_SLOTS];
  phase: typeof MATCH_PHASES[keyof typeof MATCH_PHASES];
}

const BRACKET_TEMPLATES: BracketTemplate[] = [
  { bracketSlot: BRACKET_SLOTS.QF1, phase: MATCH_PHASES.QUARTER_FINALS },
  { bracketSlot: BRACKET_SLOTS.QF2, phase: MATCH_PHASES.QUARTER_FINALS },
  { bracketSlot: BRACKET_SLOTS.QF3, phase: MATCH_PHASES.QUARTER_FINALS },
  { bracketSlot: BRACKET_SLOTS.QF4, phase: MATCH_PHASES.QUARTER_FINALS },
  { bracketSlot: BRACKET_SLOTS.SFG1, phase: MATCH_PHASES.SEMIFINALS_GOLD },
  { bracketSlot: BRACKET_SLOTS.SFG2, phase: MATCH_PHASES.SEMIFINALS_GOLD },
  { bracketSlot: BRACKET_SLOTS.SFS1, phase: MATCH_PHASES.SEMIFINALS },
  { bracketSlot: BRACKET_SLOTS.SFS2, phase: MATCH_PHASES.SEMIFINALS },
  { bracketSlot: BRACKET_SLOTS.FG, phase: MATCH_PHASES.FINAL_GOLD },
  { bracketSlot: BRACKET_SLOTS.FS, phase: MATCH_PHASES.FINAL },
  { bracketSlot: BRACKET_SLOTS.M34, phase: MATCH_PHASES.THIRD_PLACE },
  { bracketSlot: BRACKET_SLOTS.M78, phase: MATCH_PHASES.SEVENTH_PLACE }
];

const FEED_MAP: Record<string, { winnerTo?: string; loserTo?: string }> = {
  [BRACKET_SLOTS.QF1]: { winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 },
  [BRACKET_SLOTS.QF2]: { winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 },
  [BRACKET_SLOTS.QF3]: { winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 },
  [BRACKET_SLOTS.QF4]: { winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 },
  [BRACKET_SLOTS.SFG1]: { winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 },
  [BRACKET_SLOTS.SFG2]: { winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 },
  [BRACKET_SLOTS.SFS1]: { winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 },
  [BRACKET_SLOTS.SFS2]: { winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 }
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

export const startTournament = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { mode, pairings } = req.body as {
      mode?: "random" | "manual";
      pairings?: Array<{ slot: string; teamIds: string[] }>;
    };

    if (mode !== "random" && mode !== "manual") {
      return void res.status(400).json({ message: "Modo inválido (random | manual)" });
    }

    const tournament = await TournamentModel.findById(id);
    if (!tournament) {
      return void res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (tournament.createdBy.toString() !== req.user) {
      return void res.status(403).json({ message: "Solo el creador puede iniciar el torneo" });
    }
    if (tournament.status !== "upcoming") {
      return void res.status(400).json({ message: "El torneo ya inició o finalizó" });
    }

    const expectedSize = FORMAT_TEAM_SIZE[tournament.format];

    if (tournament.teamFormationMode === TEAM_FORMATION_MODES.RANDOM) {
      const totalSlots = TOURNAMENT_TEAMS_COUNT * expectedSize;
      const filledFromTeams = tournament.teams.length * expectedSize;
      const filledFromSignups = tournament.individualSignups.length;
      if (filledFromTeams + filledFromSignups !== totalSlots) {
        return void res.status(400).json({
          message: `Faltan jugadores: ${filledFromTeams + filledFromSignups}/${totalSlots}`
        });
      }
      const shuffledSignups = shuffle(tournament.individualSignups);
      const remainingTeamsNeeded = TOURNAMENT_TEAMS_COUNT - tournament.teams.length;
      let cursor = 0;
      for (let i = 0; i < remainingTeamsNeeded; i++) {
        const players = shuffledSignups.slice(cursor, cursor + expectedSize);
        cursor += expectedSize;
        const teamNumber = tournament.teams.length + 1;
        tournament.teams.push({
          teamId: new mongoose.Types.ObjectId(),
          name: `Equipo ${teamNumber}`,
          players: players.map((s) => ({
            playerId: s.userId,
            name: s.name,
            isGuest: false
          }))
        });
      }
      tournament.individualSignups = [];
    } else {
      if (tournament.teams.length !== TOURNAMENT_TEAMS_COUNT) {
        return void res.status(400).json({
          message: `Faltan equipos: ${tournament.teams.length}/${TOURNAMENT_TEAMS_COUNT}`
        });
      }
    }

    let pairOrder: ITeam[];
    if (mode === "random") {
      pairOrder = shuffle(tournament.teams);
    } else {
      if (!Array.isArray(pairings) || pairings.length !== 4) {
        return void res.status(400).json({
          message: "pairings debe tener 4 entradas (QF1..QF4)"
        });
      }
      const expectedSlots = [
        BRACKET_SLOTS.QF1,
        BRACKET_SLOTS.QF2,
        BRACKET_SLOTS.QF3,
        BRACKET_SLOTS.QF4
      ];
      const seen = new Set<string>();
      const pairOrderTmp: ITeam[] = [];
      for (const slot of expectedSlots) {
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
      if (seen.size !== TOURNAMENT_TEAMS_COUNT) {
        return void res.status(400).json({
          message: "pairings debe incluir los 8 equipos sin duplicados"
        });
      }
      pairOrder = pairOrderTmp;
    }

    const slotToMatchId = new Map<string, mongoose.Types.ObjectId>();
    for (const tpl of BRACKET_TEMPLATES) {
      const isQF = tpl.phase === MATCH_PHASES.QUARTER_FINALS;
      const slotIndex =
        tpl.bracketSlot === BRACKET_SLOTS.QF1
          ? 0
          : tpl.bracketSlot === BRACKET_SLOTS.QF2
          ? 1
          : tpl.bracketSlot === BRACKET_SLOTS.QF3
          ? 2
          : 3;
      const teamsForMatch = isQF
        ? [pairOrder[slotIndex * 2], pairOrder[slotIndex * 2 + 1]].map(teamToMatchTeam)
        : [];

      const m = await Match.create({
        tournament: tournament._id,
        teams: teamsForMatch,
        status: isQF ? MATCH_STATUS.IN_PROGRESS : MATCH_STATUS.PENDING,
        type: MATCH_TYPES.TOURNAMENT,
        phase: tpl.phase,
        bracketSlot: tpl.bracketSlot
      });
      slotToMatchId.set(tpl.bracketSlot, m._id as mongoose.Types.ObjectId);
    }

    for (const [slot, feeds] of Object.entries(FEED_MAP)) {
      const matchId = slotToMatchId.get(slot);
      if (!matchId) continue;
      const update: Record<string, mongoose.Types.ObjectId> = {};
      if (feeds.winnerTo) update.feedsWinnerTo = slotToMatchId.get(feeds.winnerTo)!;
      if (feeds.loserTo) update.feedsLoserTo = slotToMatchId.get(feeds.loserTo)!;
      if (Object.keys(update).length > 0) {
        await Match.updateOne({ _id: matchId }, { $set: update });
      }
    }

    tournament.matches = Array.from(slotToMatchId.values());
    tournament.status = "in_progress";
    await tournament.save();

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

const positionFromMatch = (
  bracketSlot: string,
  isWinner: boolean
): number | null => {
  if (bracketSlot === BRACKET_SLOTS.FG) return isWinner ? 1 : 2;
  if (bracketSlot === BRACKET_SLOTS.M34) return isWinner ? 3 : 4;
  if (bracketSlot === BRACKET_SLOTS.FS) return isWinner ? 5 : 6;
  if (bracketSlot === BRACKET_SLOTS.M78) return isWinner ? 7 : 8;
  return null;
};

export const computePlayerStats = async (
  tournament: ITournament
): Promise<IPlayerStat[]> => {
  const matches = await Match.find({ tournament: tournament._id });
  const stats: IPlayerStat[] = [];
  const points = POINTS_TABLE[tournament.type as keyof typeof POINTS_TABLE];
  if (!points) return stats;

  for (const m of matches) {
    if (!m.bracketSlot) continue;
    if (m.status !== MATCH_STATUS.FINISHED) continue;
    if (!m.winner || !m.losingTeam) continue;
    const winnerPos = positionFromMatch(m.bracketSlot, true);
    const loserPos = positionFromMatch(m.bracketSlot, false);
    if (winnerPos === null || loserPos === null) continue;

    const teamWinner = m.teams.find(
      (t) => t.teamId.toString() === m.winner!.toString()
    );
    const teamLoser = m.teams.find(
      (t) => t.teamId.toString() === m.losingTeam!.toString()
    );
    if (teamWinner) {
      for (const p of teamWinner.players) {
        stats.push({
          playerId: p.playerId,
          name: p.username || "Invitado",
          isGuest: !!p.isGuest,
          position: winnerPos,
          points: points[winnerPos as keyof typeof points] ?? 0
        });
      }
    }
    if (teamLoser) {
      for (const p of teamLoser.players) {
        stats.push({
          playerId: p.playerId,
          name: p.username || "Invitado",
          isGuest: !!p.isGuest,
          position: loserPos,
          points: points[loserPos as keyof typeof points] ?? 0
        });
      }
    }
  }
  return stats;
};

export const closeTournament = async (
  tournamentId: mongoose.Types.ObjectId | string
): Promise<void> => {
  const tournament = await TournamentModel.findById(tournamentId);
  if (!tournament) return;
  if (tournament.pointsAwarded) return;
  if (tournament.status === "completed") return;

  const stats = await computePlayerStats(tournament);
  tournament.playerStats = stats;
  tournament.status = "completed";

  for (const s of stats) {
    if (s.isGuest || !s.playerId) continue;
    if (s.points <= 0) continue;
    await User.updateOne({ _id: s.playerId }, { $inc: { totalPoints: s.points } });
  }
  tournament.pointsAwarded = true;
  await tournament.save();
};
