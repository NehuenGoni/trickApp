import { Request, Response } from "express";
import mongoose from "mongoose";
import League from "../models/League";
import LeagueLogoModel from "../models/LeagueLogo";
import TournamentModel from "../models/Tournament";
import User from "../models/User";
import { canManageLeague, canManageLeagues } from "../utils/leaguePermissions";
import { computeLeagueStandings } from "../utils/leagueStandings";
import {
  collectPlayerIdentities,
  computeLeaguePlayerCounts,
  tournamentParticipants,
  TOURNAMENT_PLAYER_FIELDS
} from "../utils/leaguePlayers";
import { enforceLeagueCap } from "../services/leagueCapGate";
import { withTransaction } from "../utils/withTransaction";
import { isAdmin } from "../middlewares/roleMiddleware";
import { PLANS } from "../config/plans";
import { notifyOrganizerAdded } from "../services/notifications";

// Campos del torneo que necesita el frontend para listarlo dentro de una liga,
// sin `playerStats` (eso ya lo resume `computeLeagueStandings`).
const TOURNAMENT_SUMMARY_FIELDS = "name status type startDate logo";

export const createLeague = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canManageLeagues(req.authUser)) {
      // 402, no 403: la razón puntual es "necesitás pagar", no "no tenés
      // rol" — el frontend usa el código para distinguir y llevar a /planes
      // en vez de mostrar un error genérico.
      res.status(402).json({ message: "Necesitás una suscripción activa para crear una liga" });
      return;
    }

    // El admin no tiene tope (gestiona el panel, no es un cliente pago). Para
    // el resto, el tope depende del plan — ver `config/plans.ts`.
    if (!isAdmin(req.authUser?.role)) {
      const plan = req.authUser!.billing?.plan ?? "free";
      const maxLeagues = PLANS[plan].maxLeagues;
      if (maxLeagues !== Infinity) {
        const ownedCount = await League.countDocuments({ createdBy: req.authUser!.id });
        if (ownedCount >= maxLeagues) {
          res.status(400).json({
            message: `Tu plan permite hasta ${maxLeagues} liga(s). Pasate a un plan superior para crear otra.`
          });
          return;
        }
      }
    }

    const { name, description, startDate, endDate, isActive } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "El nombre es obligatorio" });
      return;
    }
    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.getTime())) {
      res.status(400).json({ message: "Fecha de inicio inválida" });
      return;
    }
    let parsedEnd: Date | undefined;
    if (endDate !== undefined && endDate !== null && endDate !== "") {
      parsedEnd = new Date(endDate);
      if (Number.isNaN(parsedEnd.getTime())) {
        res.status(400).json({ message: "Fecha de fin inválida" });
        return;
      }
    }

    const league = new League({
      name: name.trim(),
      description,
      startDate: parsedStart,
      endDate: parsedEnd,
      isActive: isActive ?? true,
      createdBy: req.authUser!.id
    });

    await league.save();
    res.status(201).json(league);
  } catch (error: any) {
    res.status(400).json({ message: "Error al crear la liga", error: error.message });
  }
};

export const getLeagues = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const filter = includeInactive ? {} : { isActive: true };

    const leagues = await League.find(filter).sort({ startDate: -1 }).lean();
    const leagueIds = leagues.map((l) => l._id);

    // Contadores por liga con una sola query, acotada a las ligas devueltas y
    // agrupada en JS: el volumen de torneos-con-liga no justifica una
    // aggregation pipeline. Trae también los campos de jugadores para no
    // pagar una segunda query — un solo loop calcula torneos, finalizados y
    // participantes únicos a la vez.
    const tournamentsByLeague = await TournamentModel.find({ league: { $in: leagueIds } })
      .select(`status ${TOURNAMENT_PLAYER_FIELDS}`)
      .lean();
    const counts = new Map<string, { tournamentCount: number; completedCount: number }>();
    const identitiesByLeague = new Map<string, Map<string, boolean>>();
    for (const t of tournamentsByLeague) {
      if (!t.league) continue;
      const key = t.league.toString();

      const entry = counts.get(key) ?? { tournamentCount: 0, completedCount: 0 };
      entry.tournamentCount += 1;
      if (t.status === "completed") entry.completedCount += 1;
      counts.set(key, entry);

      let identities = identitiesByLeague.get(key);
      if (!identities) {
        identities = new Map();
        identitiesByLeague.set(key, identities);
      }
      for (const [identityKey, isGuest] of collectPlayerIdentities(t)) identities.set(identityKey, isGuest);
    }

    const result = leagues.map((league) => {
      const leagueKey = league._id.toString();
      const identities = identitiesByLeague.get(leagueKey);
      const guestCount = identities ? [...identities.values()].filter(Boolean).length : 0;
      const playerCount = identities?.size ?? 0;
      return {
        ...league,
        ...(counts.get(leagueKey) ?? { tournamentCount: 0, completedCount: 0 }),
        playerCount,
        registeredCount: playerCount - guestCount,
        guestCount
      };
    });

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener las ligas", error: error.message });
  }
};

export const getLeagueById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id).populate("organizers", "username email");
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }

    const [tournaments, standingsResult, playerCountsByLeague] = await Promise.all([
      TournamentModel.find({ league: id }).select(TOURNAMENT_SUMMARY_FIELDS).sort({ startDate: -1 }),
      computeLeagueStandings(id),
      computeLeaguePlayerCounts([id])
    ]);
    // `guestCount` de standingsResult son invitados EN LA TABLA DE POSICIONES
    // (solo torneos completados); `playerCounts` cuenta participantes de
    // CUALQUIER torneo de la liga. Son cosas distintas, no se pisan.
    const playerCounts = playerCountsByLeague.get(id) ?? { playerCount: 0, registeredCount: 0, guestCount: 0 };

    res.status(200).json({
      league,
      tournaments,
      playerCounts,
      standings: standingsResult.standings,
      tournamentsCounted: standingsResult.tournamentsCounted,
      guestCount: standingsResult.guestCount
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener la liga", error: error.message });
  }
};

export const updateLeague = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const { name, description, startDate, endDate, isActive } = req.body as {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string | null;
      isActive?: boolean;
    };

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ message: "El nombre no puede estar vacío" });
        return;
      }
      league.name = name.trim();
    }
    if (description !== undefined) league.description = description;
    if (startDate !== undefined) {
      const parsed = new Date(startDate);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ message: "Fecha de inicio inválida" });
        return;
      }
      league.startDate = parsed;
    }
    if (endDate !== undefined) {
      if (endDate === null || endDate === "") {
        league.endDate = undefined;
      } else {
        const parsed = new Date(endDate);
        if (Number.isNaN(parsed.getTime())) {
          res.status(400).json({ message: "Fecha de fin inválida" });
          return;
        }
        league.endDate = parsed;
      }
    }
    if (isActive !== undefined) league.isActive = isActive;

    await league.save();
    res.status(200).json(league);
  } catch (error: any) {
    res.status(400).json({ message: "Error al actualizar la liga", error: error.message });
  }
};

export const deleteLeague = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const unlinked = await withTransaction(async (session) => {
      const result = await TournamentModel.updateMany(
        { league: id },
        { $unset: { league: "" } },
        { session }
      );
      // El logo vive en su propia colección (igual que el de torneos), así
      // que no se va solo con el documento de la liga.
      await LeagueLogoModel.deleteOne({ leagueId: id }, { session });
      await league.deleteOne({ session });
      return result.modifiedCount ?? 0;
    });

    res.status(200).json({
      message: `Liga eliminada. ${unlinked} torneo(s) quedaron sin liga (no se borró ningún torneo).`
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar la liga", error: error.message });
  }
};

/**
 * Agrega un organizador a la liga: alguien designado por el dueño (o un
 * admin) para operar sus torneos con los mismos permisos que él —sortear,
 * iniciar, cargar resultados, inscribir/quitar jugadores— sin poder editar ni
 * borrar la liga en sí (eso sigue siendo solo del dueño, ver
 * `canManageLeague`). Es lo que resuelve que hoy, si el creador de un torneo
 * no está presente esa noche, nadie más puede tocarlo.
 */
export const addOrganizer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId?: string };
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }
    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(400).json({ message: "ID de usuario inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }
    if (league.createdBy.toString() === userId) {
      res.status(400).json({ message: "El dueño de la liga ya puede gestionar sus torneos" });
      return;
    }
    if (league.organizers.some((o) => o.toString() === userId)) {
      res.status(409).json({ message: "Ese usuario ya es organizador" });
      return;
    }

    const user = await User.findById(userId).select("_id email username");
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    league.organizers.push(new mongoose.Types.ObjectId(userId));
    await league.save();

    void notifyOrganizerAdded(
      { _id: user._id, email: user.email, username: user.username },
      league.name,
      String(league._id)
    );

    res.status(200).json({ message: "Organizador agregado", organizers: league.organizers });
  } catch (error: any) {
    res.status(400).json({ message: "Error al agregar el organizador", error: error.message });
  }
};

export const removeOrganizer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const before = league.organizers.length;
    league.organizers = league.organizers.filter((o) => o.toString() !== userId);
    if (league.organizers.length === before) {
      res.status(404).json({ message: "Ese usuario no es organizador de esta liga" });
      return;
    }

    await league.save();
    res.status(200).json({ message: "Organizador quitado", organizers: league.organizers });
  } catch (error: any) {
    res.status(400).json({ message: "Error al quitar el organizador", error: error.message });
  }
};

export const attachTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, tournamentId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(tournamentId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const tournament = await TournamentModel.findById(tournamentId);
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return;
    }

    if (tournament.league && tournament.league.toString() !== id) {
      const currentLeague = await League.findById(tournament.league).select("name");
      res.status(409).json({
        message: `El torneo ya pertenece a la liga "${currentLeague?.name ?? "desconocida"}"`
      });
      return;
    }

    if (tournament.league?.toString() === id) {
      res.status(200).json({ message: "El torneo ya está en esta liga", tournament });
      return;
    }

    // Vincular un torneo que ya tiene jugadores puede sumarle de golpe todos
    // sus participantes a la liga — mismo chequeo que hace `applyTournamentUpdate`
    // cuando la liga se cambia desde la edición del torneo (ver `leagueCapGate.ts`).
    const capDenial = await enforceLeagueCap(
      league._id as mongoose.Types.ObjectId,
      tournamentParticipants(tournament),
      req.authUser!.id
    );
    if (capDenial) {
      res.status(402).json(capDenial);
      return;
    }

    tournament.league = league._id as mongoose.Types.ObjectId;
    await tournament.save();

    res.status(200).json({ message: "Torneo agregado a la liga", tournament });
  } catch (error: any) {
    res.status(400).json({ message: "Error al agregar el torneo a la liga", error: error.message });
  }
};

export const detachTournament = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, tournamentId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(tournamentId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const league = await League.findById(id);
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }
    if (!canManageLeague(req.authUser, league)) {
      res.status(403).json({ message: "No tenés permisos para realizar esta acción" });
      return;
    }

    const result = await TournamentModel.updateOne(
      { _id: tournamentId, league: id },
      { $unset: { league: "" } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ message: "El torneo no pertenece a esta liga" });
      return;
    }

    res.status(200).json({ message: "Torneo quitado de la liga" });
  } catch (error: any) {
    res.status(400).json({ message: "Error al quitar el torneo de la liga", error: error.message });
  }
};

export const getLeagueStandings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "ID de liga inválido" });
      return;
    }

    const league = await League.findById(id).select("_id");
    if (!league) {
      res.status(404).json({ message: "Liga no encontrada" });
      return;
    }

    const result = await computeLeagueStandings(id);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener la tabla de posiciones", error: error.message });
  }
};
