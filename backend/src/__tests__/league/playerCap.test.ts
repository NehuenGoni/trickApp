import mongoose from "mongoose";
import League from "../../models/League";
import TournamentModel from "../../models/Tournament";
import User from "../../models/User";
import { ROLES } from "../../config/constants";
import { computeLeaguePlayerCounts, checkLeaguePlayerCap } from "../../utils/leaguePlayers";
import { createUserWithToken } from "../helpers/fixtures";

const makeLeague = async (ownerId: string) =>
  League.create({ name: "Liga test", startDate: new Date(), createdBy: ownerId });

const makeTournament = (
  leagueId: mongoose.Types.ObjectId | null,
  overrides: Partial<{
    status: string;
    playerStats: Array<{ playerId?: mongoose.Types.ObjectId; name: string; isGuest: boolean; position: number; points: number }>;
    individualSignups: Array<{ signupId?: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId; name: string; isGuest: boolean }>;
    teams: Array<{ teamId?: mongoose.Types.ObjectId; name: string; players: Array<{ playerId?: mongoose.Types.ObjectId; name: string; isGuest?: boolean }> }>;
  }> = {}
) =>
  TournamentModel.create({
    name: "Torneo de liga",
    createdBy: new mongoose.Types.ObjectId(),
    startDate: new Date(),
    status: overrides.status ?? "upcoming",
    league: leagueId,
    playerStats: overrides.playerStats ?? [],
    individualSignups: overrides.individualSignups ?? [],
    teams: overrides.teams ?? []
  });

/** Deja el plan/estado de billing del usuario en el estado que necesita cada test. */
const setPlan = async (userId: string, plan: "free" | "basico" | "club" | "pro") =>
  User.updateOne({ _id: userId }, { $set: { "billing.plan": plan } });

describe("computeLeaguePlayerCounts", () => {
  it("cuenta participantes de torneos NO finalizados (a diferencia de computeLeagueStandings)", async () => {
    const owner = await createUserWithToken();
    const league = await makeLeague(owner.userId);
    const p1 = await createUserWithToken();

    // Torneo `upcoming`, nadie jugó nada todavía: igual ocupa cupo.
    await makeTournament(league._id as mongoose.Types.ObjectId, {
      status: "upcoming",
      individualSignups: [{ userId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false }]
    });

    const counts = await computeLeaguePlayerCounts([league._id as mongoose.Types.ObjectId]);
    expect(counts.get((league._id as mongoose.Types.ObjectId).toString())?.playerCount).toBe(1);
  });

  it("deduplica a la misma persona entre varias fuentes y varios torneos", async () => {
    const owner = await createUserWithToken();
    const league = await makeLeague(owner.userId);
    const p1 = await createUserWithToken();

    await makeTournament(league._id as mongoose.Types.ObjectId, {
      status: "completed",
      playerStats: [{ playerId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false, position: 1, points: 25 }]
    });
    // Mismo usuario, en un SEGUNDO torneo de la liga: no debe sumar un cupo más.
    await makeTournament(league._id as mongoose.Types.ObjectId, {
      status: "upcoming",
      individualSignups: [{ userId: new mongoose.Types.ObjectId(p1.userId), name: "p1", isGuest: false }]
    });

    const counts = await computeLeaguePlayerCounts([league._id as mongoose.Types.ObjectId]);
    expect(counts.get((league._id as mongoose.Types.ObjectId).toString())?.playerCount).toBe(1);
  });

  it("agrupa invitados por nombre normalizado, igual que leagueStandings", async () => {
    const owner = await createUserWithToken();
    const league = await makeLeague(owner.userId);

    await makeTournament(league._id as mongoose.Types.ObjectId, {
      teams: [{ name: "Equipo A", players: [{ name: "José Pérez", isGuest: true }] }]
    });
    await makeTournament(league._id as mongoose.Types.ObjectId, {
      individualSignups: [{ name: "JOSE PEREZ", isGuest: true }]
    });

    const counts = await computeLeaguePlayerCounts([league._id as mongoose.Types.ObjectId]);
    const c = counts.get((league._id as mongoose.Types.ObjectId).toString());
    expect(c?.playerCount).toBe(1);
    expect(c?.guestCount).toBe(1);
  });
});

describe("checkLeaguePlayerCap", () => {
  it("sin liga: no aplica cupo", async () => {
    const result = await checkLeaguePlayerCap(null, [{ playerId: new mongoose.Types.ObjectId(), isGuest: false }]);
    expect(result).toBeNull();
  });

  it("dueño con plan Pro (maxMembers infinito): no aplica cupo, ni siquiera cuenta", async () => {
    const owner = await createUserWithToken();
    await setPlan(owner.userId, "pro");
    const league = await makeLeague(owner.userId);

    const result = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(), isGuest: false }]
    );
    expect(result).toBeNull();
  });

  it("dueño admin: exento del cupo aunque tenga plan Básico", async () => {
    const owner = await createUserWithToken({ role: ROLES.ADMIN });
    await setPlan(owner.userId, "basico");
    const league = await makeLeague(owner.userId);

    const result = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(), isGuest: false }]
    );
    expect(result).toBeNull();
  });

  it("rechaza un alta que empuja por encima del cupo, y lo acepta si no lo supera", async () => {
    const owner = await createUserWithToken();
    await setPlan(owner.userId, "basico"); // maxMembers: 40
    const league = await makeLeague(owner.userId);

    // Llenar la liga a 40 con torneos `upcoming` (no finalizados).
    const existing = await Promise.all(
      Array.from({ length: 40 }, () => createUserWithToken())
    );
    await makeTournament(league._id as mongoose.Types.ObjectId, {
      individualSignups: existing.map((u) => ({
        userId: new mongoose.Types.ObjectId(u.userId),
        name: "x",
        isGuest: false
      }))
    });

    const newPlayer = await createUserWithToken();
    const denied = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(newPlayer.userId), isGuest: false }],
      owner.userId
    );
    expect(denied?.allowed).toBe(false);
    expect(denied?.current).toBe(40);
    expect(denied?.next).toBe(41);
    expect(denied?.isLeagueOwner).toBe(true);

    // El mismo jugador que YA está en la liga se vuelve a "agregar" (ej. a
    // otro torneo): no debe rechazarse, porque la unión no crece.
    const alreadyIn = existing[0];
    const allowed = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(alreadyIn.userId), isGuest: false }],
      owner.userId
    );
    expect(allowed?.allowed).toBe(true);
    expect(allowed?.next).toBe(40);
  });

  it("grandfathering: una liga que YA excede el cupo no se bloquea a sí misma, solo el crecimiento", async () => {
    const owner = await createUserWithToken();
    await setPlan(owner.userId, "basico"); // maxMembers: 40

    const league = await makeLeague(owner.userId);
    // 45 personas ya en la liga (nunca se validó este cupo antes del gate).
    const existing = await Promise.all(Array.from({ length: 45 }, () => createUserWithToken()));
    await makeTournament(league._id as mongoose.Types.ObjectId, {
      individualSignups: existing.map((u) => ({
        userId: new mongoose.Types.ObjectId(u.userId),
        name: "x",
        isGuest: false
      }))
    });

    // Re-agregar a alguien que ya estaba: permitido (no aumenta el conjunto).
    const already = existing[0];
    const reAdd = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(already.userId), isGuest: false }],
      owner.userId
    );
    expect(reAdd?.allowed).toBe(true);

    // Sumar una persona nueva: rechazado, sigue estando por encima del límite.
    const newPlayer = await createUserWithToken();
    const addNew = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(newPlayer.userId), isGuest: false }],
      owner.userId
    );
    expect(addNew?.allowed).toBe(false);
  });

  it("usa el plan del DUEÑO de la liga, no el de quien se inscribe", async () => {
    const owner = await createUserWithToken();
    await setPlan(owner.userId, "basico"); // maxMembers: 40
    const league = await makeLeague(owner.userId);

    // Quien se inscribe tiene plan Pro (irrelevante: no es su liga).
    const registrant = await createUserWithToken();
    await setPlan(registrant.userId, "pro");

    const result = await checkLeaguePlayerCap(
      league._id as mongoose.Types.ObjectId,
      [{ playerId: new mongoose.Types.ObjectId(registrant.userId), isGuest: false }],
      registrant.userId
    );
    expect(result?.allowed).toBe(true); // 1 de 40, entra igual
    expect(result?.limit).toBe(40); // el límite es el del DUEÑO (Básico), no Pro
    expect(result?.isLeagueOwner).toBe(false); // quien pidió la operación no es el dueño
  });
});
