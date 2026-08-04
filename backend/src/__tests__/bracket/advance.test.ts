import request from "supertest";
import app from "../../app";
import { buildStartedTournament, finishMatchAsFirstTeam } from "../helpers/fixtures";

const getMatch = async (matchId: string) => (await request(app).get(`/matches/${matchId}`)).body;

describe("Avance del bracket (oro y plata)", () => {
  it("propaga ganadores al cuadro de oro y perdedores al cuadro de plata", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    // Antes de jugar nada, las semis todavía no tienen equipos.
    expect((await getMatch(m.SFG1)).teams).toHaveLength(0);
    expect((await getMatch(m.SFS1)).teams).toHaveLength(0);

    const qf1Before = await getMatch(m.QF1);
    const qf1WinnerId = qf1Before.teams[0].teamId;
    const qf1LoserId = qf1Before.teams[1].teamId;
    await finishMatchAsFirstTeam(m.QF1, fixture.creatorToken);

    const qf2Before = await getMatch(m.QF2);
    const qf2WinnerId = qf2Before.teams[0].teamId;
    const qf2LoserId = qf2Before.teams[1].teamId;
    await finishMatchAsFirstTeam(m.QF2, fixture.creatorToken);

    // El ganador de QF1 y el de QF2 quedan en SFG1 (cuadro de oro).
    const sfg1 = await getMatch(m.SFG1);
    const sfg1TeamIds = sfg1.teams.map((t: { teamId: string }) => t.teamId).sort();
    expect(sfg1TeamIds).toEqual([qf1WinnerId, qf2WinnerId].sort());
    expect(sfg1.status).toBe("in_progress"); // se completó con los 2 equipos

    // El perdedor de QF1 y el de QF2 quedan en SFS1 (cuadro de plata).
    const sfs1 = await getMatch(m.SFS1);
    const sfs1TeamIds = sfs1.teams.map((t: { teamId: string }) => t.teamId).sort();
    expect(sfs1TeamIds).toEqual([qf1LoserId, qf2LoserId].sort());
    expect(sfs1.status).toBe("in_progress");

    // QF3/QF4 no se jugaron: SFG2/SFS2 siguen vacíos.
    expect((await getMatch(m.SFG2)).teams).toHaveLength(0);
    expect((await getMatch(m.SFS2)).teams).toHaveLength(0);
  });

  it("propaga ganador de semifinal de oro a la final, y perdedor al tercer puesto", async () => {
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    await finishMatchAsFirstTeam(m.QF1, fixture.creatorToken);
    await finishMatchAsFirstTeam(m.QF2, fixture.creatorToken);
    await finishMatchAsFirstTeam(m.QF3, fixture.creatorToken);
    await finishMatchAsFirstTeam(m.QF4, fixture.creatorToken);

    const sfg1Before = await getMatch(m.SFG1);
    const sfg1WinnerId = sfg1Before.teams[0].teamId;
    const sfg1LoserId = sfg1Before.teams[1].teamId;
    await finishMatchAsFirstTeam(m.SFG1, fixture.creatorToken);

    const sfg2Before = await getMatch(m.SFG2);
    const sfg2WinnerId = sfg2Before.teams[0].teamId;
    const sfg2LoserId = sfg2Before.teams[1].teamId;
    await finishMatchAsFirstTeam(m.SFG2, fixture.creatorToken);

    const fg = await getMatch(m.FG);
    const fgTeamIds = fg.teams.map((t: { teamId: string }) => t.teamId).sort();
    expect(fgTeamIds).toEqual([sfg1WinnerId, sfg2WinnerId].sort());

    const m34 = await getMatch(m.M34);
    const m34TeamIds = m34.teams.map((t: { teamId: string }) => t.teamId).sort();
    expect(m34TeamIds).toEqual([sfg1LoserId, sfg2LoserId].sort());
  });

  it("un equipo no se agrega dos veces al destino si el partido se vuelve a tocar", async () => {
    // `advanceWinnerLoser` chequea `already` antes de pushear: si por algún
    // motivo `updateMatch` se llamara de nuevo sobre un match ya propagado,
    // no debería duplicar el equipo en el destino.
    const fixture = await buildStartedTournament("grand-slam");
    const { matchIdBySlot: m } = fixture;

    await finishMatchAsFirstTeam(m.QF1, fixture.creatorToken);
    const sfg1First = await getMatch(m.SFG1);
    expect(sfg1First.teams).toHaveLength(1);

    // Reintentar sobre un match ya finalizado da 409 (ver bracket.test.ts) y
    // no reejecuta advanceWinnerLoser, así que el destino no cambia.
    const retry = await request(app)
      .put(`/matches/${m.QF1}`)
      .set("Authorization", `Bearer ${fixture.creatorToken}`)
      .send({ status: "finished", winner: sfg1First.teams[0].teamId });
    expect(retry.status).toBe(409);

    const sfg1Second = await getMatch(m.SFG1);
    expect(sfg1Second.teams).toHaveLength(1);
  });
});
