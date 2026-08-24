import assert from "assert";
import mongoose from "mongoose";
import { validateRosterPayload, playerKey, RosterPayload } from "../utils/roster";
import { IIndividualSignup, ITeam } from "../models/Tournament";
import { TEAM_FORMATION_MODES } from "../config/constants";

/**
 * Verifica `validateRosterPayload` sin tocar Mongo: es lógica pura, así que
 * alcanza con un script de asserts corrido con `npx ts-node` en vez de armar
 * infraestructura de tests para el backend (que hoy no existe).
 */

const oid = () => new mongoose.Types.ObjectId();

const signup = (over: Partial<IIndividualSignup> = {}): IIndividualSignup => ({
  signupId: oid(),
  userId: oid(),
  name: "Jugador",
  isGuest: false,
  ...over
});

const team = (players: ITeam["players"], over: Partial<ITeam> = {}): ITeam => ({
  teamId: oid(),
  name: "Equipo",
  players,
  ...over
});

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`ok - ${label}`);
};

// --- creator-formed / random: multiset OK (subconjunto del pool) ---------
check("pool-based: payload válido arma los equipos", () => {
  const s1 = signup({ name: "Ana" });
  const s2 = signup({ name: "Beto" });
  const s3 = signup({ name: "Cami" });
  const payload: RosterPayload = {
    teams: [{ players: [{ signupId: s1.signupId!.toString(), name: s1.name }] }]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.CREATOR_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [s1, s2, s3]
  });
  assert(result.ok, "debería validar OK");
  if (result.ok) {
    assert.strictEqual(result.teams.length, 1);
    assert.strictEqual(result.teams[0].players.length, 1);
    assert.strictEqual(result.teams[0].players[0].name, "Ana");
  }
});

// --- pool-based: jugador que ya no está en el pool → 409 (stale) ---------
check("pool-based: jugador fuera del pool devuelve 409", () => {
  const s1 = signup({ name: "Ana" });
  const payload: RosterPayload = {
    teams: [{ players: [{ signupId: oid().toString(), name: "Fantasma" }] }]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.RANDOM,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [s1]
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) {
    assert.strictEqual(result.status, 409);
  }
});

// --- user-formed: falta un jugador (igualdad exacta) → 409 ---------------
check("user-formed: falta un jugador devuelve 409", () => {
  const p1 = { playerId: oid(), name: "Ana", isGuest: false };
  const p2 = { playerId: oid(), name: "Beto", isGuest: false };
  const t1 = team([p1, p2]);
  const payload: RosterPayload = {
    teams: [
      {
        teamId: t1.teamId.toString(),
        players: [{ playerId: p1.playerId!.toString(), name: p1.name }]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.USER_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [t1],
    individualSignups: []
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 409);
});

// --- user-formed: equipo incompleto (multiset completo, mal repartido) ---
// Caso defensivo: en el flujo normal los equipos de user-formed siempre están
// completos, pero la validación tiene que rechazar igual un estado corrupto
// (por ejemplo, datos legacy) en vez de guardarlo tal cual.
check("user-formed: equipo incompleto devuelve 400", () => {
  const p1 = { playerId: oid(), name: "Ana", isGuest: false };
  const p2 = { playerId: oid(), name: "Beto", isGuest: false };
  const p3 = { playerId: oid(), name: "Cami", isGuest: false };
  const t1 = team([p1, p2]);
  const t2 = team([p3]); // equipo ya incompleto de entrada
  const payload: RosterPayload = {
    teams: [
      {
        teamId: t1.teamId.toString(),
        players: [
          { playerId: p1.playerId!.toString(), name: p1.name },
          { playerId: p2.playerId!.toString(), name: p2.name }
        ]
      },
      {
        teamId: t2.teamId.toString(),
        players: [{ playerId: p3.playerId!.toString(), name: p3.name }]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.USER_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [t1, t2],
    individualSignups: []
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 400);
});

// --- jugador duplicado entre equipos → 400 --------------------------------
check("jugador duplicado entre equipos devuelve 400", () => {
  const s1 = signup({ name: "Ana" });
  const payload: RosterPayload = {
    teams: [
      { players: [{ signupId: s1.signupId!.toString(), name: s1.name }] },
      { players: [{ signupId: s1.signupId!.toString(), name: s1.name }] }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.CREATOR_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [s1]
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 400);
});

// --- equipo con más jugadores que teamSize → 400 --------------------------
check("equipo con teamSize+1 devuelve 400", () => {
  const s1 = signup({ name: "Ana" });
  const s2 = signup({ name: "Beto" });
  const s3 = signup({ name: "Cami" });
  const payload: RosterPayload = {
    teams: [
      {
        players: [
          { signupId: s1.signupId!.toString(), name: s1.name },
          { signupId: s2.signupId!.toString(), name: s2.name },
          { signupId: s3.signupId!.toString(), name: s3.name }
        ]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.CREATOR_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [s1, s2, s3]
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 400);
});

// --- teamId desconocido → 400 ---------------------------------------------
check("teamId desconocido devuelve 400", () => {
  const s1 = signup({ name: "Ana" });
  const payload: RosterPayload = {
    teams: [
      {
        teamId: oid().toString(),
        players: [{ signupId: s1.signupId!.toString(), name: s1.name }]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.RANDOM,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [s1]
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 400);
});

// --- equipos fijos (isDrawn:false) son inmutables -------------------------
check("equipo fijo en el payload devuelve 400", () => {
  const p1 = { playerId: oid(), name: "Ana", isGuest: false };
  const fixed = team([p1], { isDrawn: false });
  const s1 = signup({ name: "Beto" });
  const payload: RosterPayload = {
    teams: [
      {
        teamId: fixed.teamId.toString(),
        players: [{ signupId: s1.signupId!.toString(), name: s1.name }]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.RANDOM,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [fixed],
    individualSignups: [s1]
  });
  assert(!result.ok, "debería fallar");
  if (!result.ok) assert.strictEqual(result.status, 400);
});

// --- dos invitados homónimos: signupId los distingue ----------------------
check("dos invitados homónimos se distinguen por signupId", () => {
  const g1 = signup({ userId: undefined, name: "Invitado", isGuest: true });
  const g2 = signup({ userId: undefined, name: "Invitado", isGuest: true });
  const payload: RosterPayload = {
    teams: [
      { players: [{ signupId: g1.signupId!.toString(), name: "Invitado", isGuest: true }] },
      { players: [{ signupId: g2.signupId!.toString(), name: "Invitado", isGuest: true }] }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.CREATOR_FORMED,
    teamSize: 2,
    numberOfTeams: 8,
    existingTeams: [],
    individualSignups: [g1, g2]
  });
  assert(result.ok, "debería validar OK: son dos invitados distintos");
  if (result.ok) {
    assert.strictEqual(result.teams.length, 2);
  }
});

// --- jugadores legacy sin signupId: fallback a playerId -------------------
check("jugadores legacy sin signupId matchean por playerId", () => {
  const legacyPlayerId = oid();
  const t1 = team([{ playerId: legacyPlayerId, name: "Legacy", isGuest: false }]);
  const t2 = team([]);
  const payload: RosterPayload = {
    teams: [
      { teamId: t1.teamId.toString(), players: [] },
      {
        teamId: t2.teamId.toString(),
        players: [{ playerId: legacyPlayerId.toString(), name: "Legacy" }]
      }
    ]
  };
  const result = validateRosterPayload({
    payload,
    teamFormationMode: TEAM_FORMATION_MODES.USER_FORMED,
    teamSize: 1,
    numberOfTeams: 8,
    existingTeams: [t1, t2],
    individualSignups: []
  });
  assert(result.ok, "debería validar OK vía el fallback de playerKey");
  if (result.ok) {
    const withPlayer = result.teams.find((t) => t.players.length === 1)!;
    assert.strictEqual(withPlayer.players[0].name, "Legacy");
  }
});

// --- playerKey: prioridad signupId > playerId > nombre --------------------
check("playerKey prioriza signupId sobre playerId y nombre", () => {
  const sid = oid();
  const pid = oid();
  assert.strictEqual(playerKey({ signupId: sid, playerId: pid, name: "X" }), `s:${sid}`);
  assert.strictEqual(playerKey({ playerId: pid, name: "X" }), `u:${pid}`);
  assert.strictEqual(playerKey({ name: "  Ana  " }), "g:ana");
});

console.log(`\n${passed} check(s) OK`);
