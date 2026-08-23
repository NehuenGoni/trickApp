import mongoose from "mongoose";
import TournamentModel from "../../models/Tournament";
import User from "../../models/User";
import { computeUserStats } from "../../utils/userStats";
import { createUserWithToken, createFinishedMatch } from "../helpers/fixtures";

describe("computeUserStats", () => {
  it("usuario sin partidos: todo en 0, no tira", async () => {
    const { userId } = await createUserWithToken();
    const stats = await computeUserStats(userId);

    expect(stats.overview.played).toBe(0);
    expect(stats.overview.winRate).toBe(0);
    expect(stats.overview.currentStreak).toEqual({ type: "none", count: 0 });
    expect(stats.partners).toEqual([]);
    expect(stats.rivals).toEqual([]);
    expect(stats.bestPartner).toBeNull();
    expect(stats.nemesis).toBeNull();
    expect(stats.tournaments.bestPosition).toBeNull();
    expect(stats.activity).toHaveLength(12);
    expect(stats.activity.every((m) => m.played === 0)).toBe(true);
  });

  it("solo cuenta finished con winner válido; el resto suma unfinished/discarded", async () => {
    const { userId } = await createUserWithToken();
    const rival = await createUserWithToken();

    // Cuenta.
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      winner: "A"
    });
    // No cuenta: in_progress.
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      status: "in_progress"
    });
    // No cuenta: pending.
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      status: "pending"
    });
    // No cuenta: finished sin winner (dato corrupto).
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }]
    });

    const stats = await computeUserStats(userId);

    expect(stats.overview.played).toBe(1);
    expect(stats.overview.unfinishedMatches).toBe(2);
    expect(stats.overview.discardedMatches).toBe(1);
  });

  it("la victoria la define winner, no el score", async () => {
    const { userId } = await createUserWithToken();
    const rival = await createUserWithToken();

    // El equipo del usuario pierde en el marcador pero winner dice que ganó
    // (ej: walkover). Debe contarse victoria.
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      scoreA: 0,
      scoreB: 30,
      winner: "A"
    });

    const stats = await computeUserStats(userId);

    expect(stats.overview.wins).toBe(1);
    expect(stats.overview.losses).toBe(0);
    expect(stats.overview.pointsFor).toBe(0);
    expect(stats.overview.pointsAgainst).toBe(30);
  });

  it("puntos, promedios y split amistoso vs torneo", async () => {
    const { userId } = await createUserWithToken();
    const rival = await createUserWithToken();

    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      scoreA: 30,
      scoreB: 20,
      winner: "A",
      type: "friendly"
    });
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      scoreA: 10,
      scoreB: 30,
      winner: "B",
      type: "tournament"
    });

    const stats = await computeUserStats(userId);

    expect(stats.overview.pointsFor).toBe(40);
    expect(stats.overview.pointsAgainst).toBe(50);
    expect(stats.overview.pointsDiff).toBe(-10);
    expect(stats.overview.avgPointsFor).toBe(20);
    expect(stats.overview.avgPointsAgainst).toBe(25);
    expect(stats.overview.byType.friendly).toMatchObject({ played: 1, wins: 1, losses: 0 });
    expect(stats.overview.byType.tournament).toMatchObject({ played: 1, wins: 0, losses: 1 });
  });

  it("rachas: current, best win streak y worst loss streak, con desempate por _id en createdAt idénticos", async () => {
    const { userId } = await createUserWithToken();
    const rival = await createUserWithToken();
    const base = new Date("2026-01-01T12:00:00.000Z");

    // W, W, W, L, L, W (cronológico). currentStreak = 1 win, bestWinStreak = 3, worstLossStreak = 2.
    const results: Array<"A" | "B"> = ["A", "A", "A", "B", "B", "A"];
    for (let i = 0; i < results.length; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }],
        teamBPlayers: [{ playerId: rival.userId }],
        winner: results[i],
        // Mismo timestamp para los primeros dos, a propósito, para ejercitar
        // el desempate por _id (los ObjectId son monotónicos por inserción).
        createdAt: i < 2 ? base : new Date(base.getTime() + i * 60000)
      });
    }

    const stats = await computeUserStats(userId);

    expect(stats.overview.currentStreak).toEqual({ type: "win", count: 1 });
    expect(stats.overview.bestWinStreak).toBe(3);
    expect(stats.overview.worstLossStreak).toBe(2);
  });

  it("invitados: nombres con distinta capitalización/espacios colapsan en una fila", async () => {
    const { userId } = await createUserWithToken();

    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ username: "José", isGuest: true }],
      winner: "A"
    });
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ username: "jose ", isGuest: true }],
      winner: "B"
    });
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ username: "JOSÉ", isGuest: true }],
      winner: "A"
    });
    // Invitado sin nombre: se debe saltear, no crear fila fantasma.
    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ username: "", isGuest: true }],
      winner: "A"
    });

    const stats = await computeUserStats(userId, { minPlayedTogether: 1 });

    expect(stats.rivals).toHaveLength(1);
    expect(stats.rivals[0].played).toBe(3);
    expect(stats.rivals[0].isGuest).toBe(true);
  });

  it("el usuario nunca aparece en su propia lista de compañeros", async () => {
    const { userId } = await createUserWithToken();
    const partner = await createUserWithToken();
    const rival = await createUserWithToken();

    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }, { playerId: partner.userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      winner: "A"
    });

    const stats = await computeUserStats(userId, { minPlayedTogether: 1 });

    expect(stats.partners.map((p) => p.userId)).toEqual([partner.userId]);
    expect(stats.partners.some((p) => p.userId === userId)).toBe(false);
  });

  it("tríos: 2 compañeros y 3 rivales por partido", async () => {
    const { userId } = await createUserWithToken();
    const p1 = await createUserWithToken();
    const p2 = await createUserWithToken();
    const r1 = await createUserWithToken();
    const r2 = await createUserWithToken();
    const r3 = await createUserWithToken();

    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }, { playerId: p1.userId }, { playerId: p2.userId }],
      teamBPlayers: [{ playerId: r1.userId }, { playerId: r2.userId }, { playerId: r3.userId }],
      winner: "A"
    });

    const stats = await computeUserStats(userId, { minPlayedTogether: 1 });

    expect(stats.partners).toHaveLength(2);
    expect(stats.rivals).toHaveLength(3);
  });

  it("umbral mínimo: filtra compañeros con menos partidos que el umbral y los cuenta en meta", async () => {
    const { userId } = await createUserWithToken();
    const rare = await createUserWithToken();
    const frequent = await createUserWithToken();
    const rival = await createUserWithToken();

    // 2 partidos con `rare` (por debajo del default de 3).
    for (let i = 0; i < 2; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }, { playerId: rare.userId }],
        teamBPlayers: [{ playerId: rival.userId }, { playerId: new mongoose.Types.ObjectId().toString() }],
        winner: "A"
      });
    }
    // 3 partidos con `frequent` (alcanza el default de 3).
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }, { playerId: frequent.userId }],
        teamBPlayers: [{ playerId: rival.userId }, { playerId: new mongoose.Types.ObjectId().toString() }],
        winner: "A"
      });
    }

    const statsDefault = await computeUserStats(userId);
    expect(statsDefault.partners.map((p) => p.userId)).toEqual([frequent.userId]);
    expect(statsDefault.meta.partnersBelowThreshold).toBe(1);

    const statsAll = await computeUserStats(userId, { minPlayedTogether: 1 });
    expect(statsAll.partners.map((p) => p.userId).sort()).toEqual([frequent.userId, rare.userId].sort());
  });

  it("bestPartner, nemesis y favouriteVictim", async () => {
    const { userId } = await createUserWithToken();
    const goodPartner = await createUserWithToken();
    const badPartner = await createUserWithToken();
    const easyRival = await createUserWithToken();
    const toughRival = await createUserWithToken();

    // Con goodPartner: 3 victorias de 3.
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }, { playerId: goodPartner.userId }],
        teamBPlayers: [{ playerId: new mongoose.Types.ObjectId().toString() }],
        winner: "A"
      });
    }
    // Con badPartner: 0 victorias de 3.
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }, { playerId: badPartner.userId }],
        teamBPlayers: [{ playerId: new mongoose.Types.ObjectId().toString() }],
        winner: "B"
      });
    }
    // Contra easyRival: gana 3 de 3.
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }],
        teamBPlayers: [{ playerId: easyRival.userId }],
        winner: "A"
      });
    }
    // Contra toughRival: pierde 3 de 3.
    for (let i = 0; i < 3; i++) {
      await createFinishedMatch({
        teamAPlayers: [{ playerId: userId }],
        teamBPlayers: [{ playerId: toughRival.userId }],
        winner: "B"
      });
    }

    const stats = await computeUserStats(userId);

    expect(stats.bestPartner?.userId).toBe(goodPartner.userId);
    expect(stats.favouriteVictim?.userId).toBe(easyRival.userId);
    expect(stats.nemesis?.userId).toBe(toughRival.userId);
  });

  it("torneos: solo completed, wins/podiums/bestPosition, globalRank con empate", async () => {
    const { userId } = await createUserWithToken();
    const other = await createUserWithToken();
    // Mismo totalPoints que `other` → deben compartir rank (standard competition ranking).
    await User.updateOne({ _id: userId }, { $set: { totalPoints: 25 } });
    await User.updateOne({ _id: other.userId }, { $set: { totalPoints: 25 } });
    const higher = await createUserWithToken();
    await User.updateOne({ _id: higher.userId }, { $set: { totalPoints: 100 } });

    await TournamentModel.create({
      name: "Completado 1",
      createdBy: userId,
      startDate: new Date(),
      status: "completed",
      playerStats: [{ playerId: new mongoose.Types.ObjectId(userId), name: "u", isGuest: false, position: 1, points: 25 }]
    });
    await TournamentModel.create({
      name: "No completado",
      createdBy: userId,
      startDate: new Date(),
      status: "upcoming",
      playerStats: [{ playerId: new mongoose.Types.ObjectId(userId), name: "u", isGuest: false, position: 1, points: 999 }]
    });

    const stats = await computeUserStats(userId);

    expect(stats.tournaments.tournamentsPlayed).toBe(1);
    expect(stats.tournaments.wins).toBe(1);
    expect(stats.tournaments.podiums).toBe(1);
    expect(stats.tournaments.bestPosition).toBe(1);
    expect(stats.tournaments.totalPoints).toBe(25);
    // higher (100 pts) está por delante; other empata en puntos → comparten rank 2.
    expect(stats.tournaments.globalRank).toBe(2);
  });

  it("actividad: 12 buckets con ceros; un partido de hace 14 meses no entra en activity pero sí en overview", async () => {
    const { userId } = await createUserWithToken();
    const rival = await createUserWithToken();
    const old = new Date();
    old.setUTCMonth(old.getUTCMonth() - 14);

    await createFinishedMatch({
      teamAPlayers: [{ playerId: userId }],
      teamBPlayers: [{ playerId: rival.userId }],
      winner: "A",
      createdAt: old
    });

    const stats = await computeUserStats(userId);

    expect(stats.overview.played).toBe(1);
    expect(stats.activity).toHaveLength(12);
    expect(stats.activity.reduce((sum, m) => sum + m.played, 0)).toBe(0);
  });
});
