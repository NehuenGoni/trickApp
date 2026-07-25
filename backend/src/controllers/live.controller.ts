import { Request, Response } from "express";
import TournamentModel from "../models/Tournament";
import Match from "../models/Match";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// lean() devuelve objetos planos que no llevan los campos de timestamps en su
// tipo declarado (ITournament / IMatch no los tipan), aunque sí existan en
// runtime gracias a `{ timestamps: true }` en el schema.
interface HasUpdatedAt {
  updatedAt?: Date | string;
}

const updatedAtMs = (doc: HasUpdatedAt): number =>
  doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;

/**
 * Vista pública y de solo lectura de un torneo, pensada para una pantalla de
 * transmisión (proyector/TV) sin login. Devuelve nombres y marcadores, nunca
 * ids de usuario, emails ni datos de quién creó/inscribió qué.
 *
 * Soporta `?since=<version>` para long-polling liviano: si nada cambió desde
 * esa versión, responde `{ version, changed: false }` sin armar el payload
 * completo.
 */
export const getTournamentLive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_RE.test(id)) {
      res.status(400).json({ message: "ID de torneo inválido" });
      return;
    }

    const tournament = await TournamentModel.findById(id).lean();
    if (!tournament) {
      res.status(404).json({ message: "Torneo no encontrado" });
      return;
    }

    const matches = await Match.find({ tournament: id }).lean();

    const maxMatchUpdatedAt = matches.reduce(
      (max, m) => Math.max(max, updatedAtMs(m as unknown as HasUpdatedAt)),
      0
    );
    const version = `${Math.max(
      updatedAtMs(tournament as unknown as HasUpdatedAt),
      maxMatchUpdatedAt
    )}-${matches.length}`;

    res.set("Cache-Control", "no-store");

    if (req.query.since === version) {
      res.status(200).json({ version, changed: false });
      return;
    }

    const teamNameById = new Map<string, string>();
    for (const t of tournament.teams) {
      teamNameById.set(t.teamId.toString(), t.name);
    }

    const teams = tournament.teams.map((t) => ({
      teamId: t.teamId,
      name: t.name,
      players: t.players.map((p) => ({ name: p.name, isGuest: !!p.isGuest }))
    }));

    const formattedMatches = matches.map((m) => ({
      _id: m._id,
      phase: m.phase,
      bracketSlot: m.bracketSlot,
      status: m.status,
      winner: m.winner,
      teams: m.teams.map((t) => ({
        teamId: t.teamId,
        name: (t.teamId && teamNameById.get(t.teamId.toString())) || "Equipo",
        score: t.score,
        players: t.players.map((p) => p.username).filter(Boolean)
      }))
    }));

    const standings = [...tournament.playerStats]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ name: s.name, position: s.position, points: s.points }));

    res.status(200).json({
      version,
      changed: true,
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        type: tournament.type,
        format: tournament.format,
        status: tournament.status,
        startDate: tournament.startDate,
        description: tournament.description
      },
      teams,
      matches: formattedMatches,
      standings
    });
  } catch (error) {
    const err = error as { message?: string };
    res.status(500).json({
      message: "Error al obtener el estado en vivo del torneo",
      error: { message: err.message }
    });
  }
};
