import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../../app";
import User from "../../models/User";
import TournamentModel from "../../models/Tournament";
import { buildStartedTournament, playFullBracket } from "../helpers/fixtures";

const getMatch = async (matchId: string) => (await request(app).get(`/matches/${matchId}`)).body;

const setResult = (matchId: string, token: string, scores: { teamId: string; score: number }[], confirmReopen?: boolean) =>
  request(app)
    .put(`/matches/${matchId}/result`)
    .set("Authorization", `Bearer ${token}`)
    .send(confirmReopen === undefined ? { scores } : { scores, confirmReopen });

const clearResult = (matchId: string, token: string, confirmReopen?: boolean) =>
  request(app)
    .delete(`/matches/${matchId}/result${confirmReopen ? "?confirmReopen=true" : ""}`)
    .set("Authorization", `Bearer ${token}`);

/** Firma un JWT para un userId conocido, igual que `createUserWithToken` pero sin crear el usuario. */
const tokenFor = (userId: string) => jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "60d" });

describe("Carga manual de resultados por el organizador", () => {
  it("anota un resultado final directo y propaga ganador/perdedor igual que el marcador en vivo", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    const qf1 = await getMatch(m.QF1);
    const winnerId = qf1.teams[0].teamId;
    const loserId = qf1.teams[1].teamId;

    const res = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: winnerId, score: 30 },
      { teamId: loserId, score: 22 }
    ]);
    expect(res.status).toBe(200);
    expect(res.body.match.status).toBe("finished");
    expect(res.body.match.winner).toBe(winnerId);

    const sfg1 = await getMatch(m.SFG1);
    expect(sfg1.teams.map((t: { teamId: string }) => t.teamId)).toContain(winnerId);
    const sfs1 = await getMatch(m.SFS1);
    expect(sfs1.teams.map((t: { teamId: string }) => t.teamId)).toContain(loserId);
  });

  it("rechaza marcadores que no cierran como una mano de truco (30-30, sin nadie en 30, fuera de rango)", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;
    const qf1 = await getMatch(m.QF1);
    const [a, b] = qf1.teams.map((t: { teamId: string }) => t.teamId);

    const bothAtMax = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: a, score: 30 },
      { teamId: b, score: 30 }
    ]);
    expect(bothAtMax.status).toBe(400);

    const nobodyAtMax = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: a, score: 28 },
      { teamId: b, score: 22 }
    ]);
    expect(nobodyAtMax.status).toBe(400);

    const outOfRange = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: a, score: 31 },
      { teamId: b, score: 0 }
    ]);
    expect(outOfRange.status).toBe(400);

    const negative = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: a, score: 30 },
      { teamId: b, score: -1 }
    ]);
    expect(negative.status).toBe(400);

    // Ninguno de los intentos inválidos tocó el partido.
    expect((await getMatch(m.QF1)).status).toBe("in_progress");
  });

  it("un jugador del partido que no gestiona el torneo no puede anotar a mano (403)", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;
    const qf1 = await getMatch(m.QF1);
    const playerId = qf1.teams[0].players[0].playerId as string;
    const playerToken = tokenFor(playerId);

    const res = await setResult(m.QF1, playerToken, [
      { teamId: qf1.teams[0].teamId, score: 30 },
      { teamId: qf1.teams[1].teamId, score: 20 }
    ]);
    expect(res.status).toBe(403);
  });

  it("corrige un resultado cuando el partido siguiente todavía no terminó: reemplaza el equipo, scores en 0", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    const qf1 = await getMatch(m.QF1);
    const [teamA, teamB] = qf1.teams.map((t: { teamId: string }) => t.teamId);
    await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 30 },
      { teamId: teamB, score: 22 }
    ]);

    const qf2 = await getMatch(m.QF2);
    const [teamC, teamD] = qf2.teams.map((t: { teamId: string }) => t.teamId);
    await setResult(m.QF2, fixture.creatorToken, [
      { teamId: teamC, score: 30 },
      { teamId: teamD, score: 18 }
    ]);

    // SFG1 ya tiene sus 2 equipos (ganadores de QF1 y QF2) pero no se jugó.
    const sfg1Before = await getMatch(m.SFG1);
    expect(sfg1Before.status).toBe("in_progress");
    expect(sfg1Before.teams.map((t: { teamId: string }) => t.teamId).sort()).toEqual([teamA, teamC].sort());

    // Corrijo QF1: ahora gana teamB.
    const correction = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 24 },
      { teamId: teamB, score: 30 }
    ]);
    expect(correction.status).toBe(200);
    expect(correction.body.match.winner).toBe(teamB);

    const sfg1After = await getMatch(m.SFG1);
    expect(sfg1After.teams.map((t: { teamId: string }) => t.teamId).sort()).toEqual([teamB, teamC].sort());
    expect(sfg1After.teams.every((t: { score: number }) => t.score === 0)).toBe(true);

    const sfs1After = await getMatch(m.SFS1);
    expect(sfs1After.teams.map((t: { teamId: string }) => t.teamId)).toContain(teamA);
  });

  it("bloquea la corrección si el partido siguiente ya tiene resultado cargado (409 con blockers)", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    const qf1 = await getMatch(m.QF1);
    const [teamA, teamB] = qf1.teams.map((t: { teamId: string }) => t.teamId);
    await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 30 },
      { teamId: teamB, score: 20 }
    ]);
    const qf2 = await getMatch(m.QF2);
    const [teamC, teamD] = qf2.teams.map((t: { teamId: string }) => t.teamId);
    await setResult(m.QF2, fixture.creatorToken, [
      { teamId: teamC, score: 30 },
      { teamId: teamD, score: 20 }
    ]);

    const sfg1 = await getMatch(m.SFG1);
    await setResult(m.SFG1, fixture.creatorToken, [
      { teamId: sfg1.teams[0].teamId, score: 30 },
      { teamId: sfg1.teams[1].teamId, score: 25 }
    ]);

    const blocked = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 24 },
      { teamId: teamB, score: 30 }
    ]);
    expect(blocked.status).toBe(409);
    expect(blocked.body.blockers).toHaveLength(1);
    expect(blocked.body.blockers[0].bracketSlot).toBe("SFG1");

    // "Deshacer resultado" en SFG1 lo devuelve a en curso y desbloquea QF1.
    const undone = await clearResult(m.SFG1, fixture.creatorToken);
    expect(undone.status).toBe(200);
    expect(undone.body.match.status).toBe("in_progress");
    expect(undone.body.match.winner).toBeFalsy();

    const nowAllowed = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 24 },
      { teamId: teamB, score: 30 }
    ]);
    expect(nowAllowed.status).toBe(200);
    expect(nowAllowed.body.match.winner).toBe(teamB);
  });

  it("editar solo el marcador de un partido finalizado (mismo ganador) no pasa por el bloqueo de la cascada", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    const qf1 = await getMatch(m.QF1);
    const [teamA, teamB] = qf1.teams.map((t: { teamId: string }) => t.teamId);
    await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 30 },
      { teamId: teamB, score: 22 }
    ]);
    const qf2 = await getMatch(m.QF2);
    await setResult(m.QF2, fixture.creatorToken, [
      { teamId: qf2.teams[0].teamId, score: 30 },
      { teamId: qf2.teams[1].teamId, score: 20 }
    ]);
    const sfg1 = await getMatch(m.SFG1);
    await setResult(m.SFG1, fixture.creatorToken, [
      { teamId: sfg1.teams[0].teamId, score: 30 },
      { teamId: sfg1.teams[1].teamId, score: 25 }
    ]);

    // QF1 tiene un bloqueador (SFG1 finalizado), pero mantener a teamA como
    // ganador y solo cambiar el marcador no debería chocar con eso.
    const scoreEdit = await setResult(m.QF1, fixture.creatorToken, [
      { teamId: teamA, score: 30 },
      { teamId: teamB, score: 15 }
    ]);
    expect(scoreEdit.status).toBe(200);
    expect(scoreEdit.body.match.winner).toBe(teamA);
    expect(scoreEdit.body.match.teams.find((t: { teamId: string }) => t.teamId === teamB).score).toBe(15);

    // El cuadro aguas abajo queda intacto.
    const sfg1After = await getMatch(m.SFG1);
    expect(sfg1After.status).toBe("finished");
  });

  it("corregir un torneo ya cerrado exige confirmReopen y recalcula puntos/posiciones", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    await playFullBracket(fixture);

    const tournamentClosed = await TournamentModel.findById(fixture.tournamentId);
    expect(tournamentClosed?.status).toBe("completed");

    const matchesRes = await request(app).get(`/matches/tournament/${fixture.tournamentId}`);
    const fg = (matchesRes.body as Array<{ _id: string; bracketSlot: string }>).find(
      (mm) => mm.bracketSlot === "FG"
    )!;
    const fgMatch = await getMatch(fg._id);
    const oldWinnerId = fgMatch.winner as string;
    const oldLoserTeam = fgMatch.teams.find((t: { teamId: string }) => t.teamId !== oldWinnerId);
    const oldWinnerTeam = fgMatch.teams.find((t: { teamId: string }) => t.teamId === oldWinnerId);

    const oldWinnerPlayerId = oldWinnerTeam.players[0].playerId as string;
    const oldLoserPlayerId = oldLoserTeam.players[0].playerId as string;

    const winnerBefore = await User.findById(oldWinnerPlayerId);
    const loserBefore = await User.findById(oldLoserPlayerId);
    expect(winnerBefore?.totalPoints).toBe(25); // grand-slam, puesto 1
    expect(loserBefore?.totalPoints).toBe(18); // grand-slam, puesto 2

    const withoutConfirm = await setResult(fg._id, fixture.creatorToken, [
      { teamId: oldWinnerTeam.teamId, score: 20 },
      { teamId: oldLoserTeam.teamId, score: 30 }
    ]);
    expect(withoutConfirm.status).toBe(409);
    expect(withoutConfirm.body.requiresConfirmation).toBe(true);

    // Sin confirmar, no se tocó nada.
    expect((await TournamentModel.findById(fixture.tournamentId))?.status).toBe("completed");

    const confirmed = await setResult(
      fg._id,
      fixture.creatorToken,
      [
        { teamId: oldWinnerTeam.teamId, score: 20 },
        { teamId: oldLoserTeam.teamId, score: 30 }
      ],
      true
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.match.winner).toBe(oldLoserTeam.teamId);

    const tournamentAfter = await TournamentModel.findById(fixture.tournamentId);
    expect(tournamentAfter?.status).toBe("completed");

    const winnerAfter = await User.findById(oldWinnerPlayerId);
    const loserAfter = await User.findById(oldLoserPlayerId);
    expect(winnerAfter?.totalPoints).toBe(18); // ahora sale 2°
    expect(loserAfter?.totalPoints).toBe(25); // ahora sale 1°
  });
});
