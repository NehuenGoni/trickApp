import { buildBracket, matchCountFor, positionsFromSlot, splitPoint } from "../../utils/bracket";
import { BRACKET_SLOTS, MATCH_PHASES } from "../../config/constants";

describe("buildBracket(8) — regresión contra el cuadro fijo que existía antes", () => {
  const plan = buildBracket(8);

  it("produce exactamente los 12 slots legacy, sin ninguno de más ni de menos", () => {
    const slots = plan.nodes.map((n) => n.slot).sort();
    expect(slots).toEqual(Object.values(BRACKET_SLOTS).slice().sort());
  });

  it("asigna la phase legacy correcta a cada slot", () => {
    const phaseBySlot: Record<string, string> = {};
    for (const n of plan.nodes) phaseBySlot[n.slot] = n.phase;

    expect(phaseBySlot[BRACKET_SLOTS.QF1]).toBe(MATCH_PHASES.QUARTER_FINALS);
    expect(phaseBySlot[BRACKET_SLOTS.QF2]).toBe(MATCH_PHASES.QUARTER_FINALS);
    expect(phaseBySlot[BRACKET_SLOTS.QF3]).toBe(MATCH_PHASES.QUARTER_FINALS);
    expect(phaseBySlot[BRACKET_SLOTS.QF4]).toBe(MATCH_PHASES.QUARTER_FINALS);
    expect(phaseBySlot[BRACKET_SLOTS.SFG1]).toBe(MATCH_PHASES.SEMIFINALS_GOLD);
    expect(phaseBySlot[BRACKET_SLOTS.SFG2]).toBe(MATCH_PHASES.SEMIFINALS_GOLD);
    expect(phaseBySlot[BRACKET_SLOTS.SFS1]).toBe(MATCH_PHASES.SEMIFINALS);
    expect(phaseBySlot[BRACKET_SLOTS.SFS2]).toBe(MATCH_PHASES.SEMIFINALS);
    expect(phaseBySlot[BRACKET_SLOTS.FG]).toBe(MATCH_PHASES.FINAL_GOLD);
    expect(phaseBySlot[BRACKET_SLOTS.FS]).toBe(MATCH_PHASES.FINAL);
    expect(phaseBySlot[BRACKET_SLOTS.M34]).toBe(MATCH_PHASES.THIRD_PLACE);
    expect(phaseBySlot[BRACKET_SLOTS.M78]).toBe(MATCH_PHASES.SEVENTH_PLACE);
  });

  it("cablea el avance ganador/perdedor exactamente como el FEED_MAP original", () => {
    const feedsBySlot: Record<string, { winnerTo?: string; loserTo?: string }> = {};
    for (const n of plan.nodes) feedsBySlot[n.slot] = { winnerTo: n.winnerTo, loserTo: n.loserTo };

    expect(feedsBySlot[BRACKET_SLOTS.QF1]).toEqual({ winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 });
    expect(feedsBySlot[BRACKET_SLOTS.QF2]).toEqual({ winnerTo: BRACKET_SLOTS.SFG1, loserTo: BRACKET_SLOTS.SFS1 });
    expect(feedsBySlot[BRACKET_SLOTS.QF3]).toEqual({ winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 });
    expect(feedsBySlot[BRACKET_SLOTS.QF4]).toEqual({ winnerTo: BRACKET_SLOTS.SFG2, loserTo: BRACKET_SLOTS.SFS2 });
    expect(feedsBySlot[BRACKET_SLOTS.SFG1]).toEqual({ winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 });
    expect(feedsBySlot[BRACKET_SLOTS.SFG2]).toEqual({ winnerTo: BRACKET_SLOTS.FG, loserTo: BRACKET_SLOTS.M34 });
    expect(feedsBySlot[BRACKET_SLOTS.SFS1]).toEqual({ winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 });
    expect(feedsBySlot[BRACKET_SLOTS.SFS2]).toEqual({ winnerTo: BRACKET_SLOTS.FS, loserTo: BRACKET_SLOTS.M78 });
    // Los 4 terminales no alimentan a nadie más.
    expect(feedsBySlot[BRACKET_SLOTS.FG]).toEqual({ winnerTo: undefined, loserTo: undefined });
    expect(feedsBySlot[BRACKET_SLOTS.FS]).toEqual({ winnerTo: undefined, loserTo: undefined });
    expect(feedsBySlot[BRACKET_SLOTS.M34]).toEqual({ winnerTo: undefined, loserTo: undefined });
    expect(feedsBySlot[BRACKET_SLOTS.M78]).toEqual({ winnerTo: undefined, loserTo: undefined });
  });

  it("los 4 cruces de primera ronda son exactamente QF1..QF4, sin descansos", () => {
    expect(plan.firstRoundSlots).toEqual([
      BRACKET_SLOTS.QF1,
      BRACKET_SLOTS.QF2,
      BRACKET_SLOTS.QF3,
      BRACKET_SLOTS.QF4
    ]);
    expect(plan.restEntrySlots).toEqual([]);
  });

  it("positionsFromSlot reproduce el positionFromMatch original", () => {
    expect(positionsFromSlot(BRACKET_SLOTS.FG)).toEqual({ winner: 1, loser: 2 });
    expect(positionsFromSlot(BRACKET_SLOTS.M34)).toEqual({ winner: 3, loser: 4 });
    expect(positionsFromSlot(BRACKET_SLOTS.FS)).toEqual({ winner: 5, loser: 6 });
    expect(positionsFromSlot(BRACKET_SLOTS.M78)).toEqual({ winner: 7, loser: 8 });
    // Los partidos no terminales no otorgan posición.
    expect(positionsFromSlot(BRACKET_SLOTS.QF1)).toBeNull();
    expect(positionsFromSlot(BRACKET_SLOTS.SFG1)).toBeNull();
  });

  it("matchCountFor(8) da 12, igual que la cantidad de BRACKET_TEMPLATES original", () => {
    expect(matchCountFor(8)).toBe(12);
  });
});

describe("splitPoint — la zona alta siempre queda en potencia de 2", () => {
  it.each([[2, 1], [3, 2], [4, 2], [5, 4], [6, 4], [7, 4], [8, 4], [14, 8], [16, 8], [32, 16]])(
    "splitPoint(%i) = %i",
    (m, expected) => {
      expect(splitPoint(m)).toBe(expected);
    }
  );
});

describe("positionsFromSlot — zonas impares: el perdedor puede quedar decidido sin rival", () => {
  it("n=9: un solo partido de primera ronda, el perdedor va directo al puesto 9", () => {
    // 9 equipos: zona alta de 8 (potencia de 2, sin descansos) + 1 solo
    // partido para decidir quién entra al 8vo lugar de esa zona. El que
    // pierde ese único cruce no tiene con quién seguir jugando: quinto puesto
    // ya no existe, cae directo al último (9no) sin jugar de nuevo.
    const plan = buildBracket(9);
    expect(plan.firstRoundSlots).toHaveLength(1);
    expect(plan.restEntrySlots).toHaveLength(7);

    const outcome = positionsFromSlot(plan.firstRoundSlots[0]);
    expect(outcome).toEqual({ winner: null, loser: 9 });

    // Y esa posición 9 no la otorga ningún otro partido del cuadro.
    const otherDecided = plan.nodes
      .filter((x) => x.slot !== plan.firstRoundSlots[0])
      .flatMap((x) => {
        const o = positionsFromSlot(x.slot);
        return o ? [o.winner, o.loser] : [];
      });
    expect(otherDecided).not.toContain(9);
  });

  it("n=14 (el caso real: 42 jugadores en tríos): 2 equipos descansan y nadie descansa dos veces", () => {
    const plan = buildBracket(14);
    expect(plan.firstRoundSlots).toHaveLength(6);
    expect(plan.restEntrySlots).toHaveLength(2);
    expect(matchCountFor(14)).toBe(25);
    expect(plan.nodes).toHaveLength(25);
  });
});

describe("buildBracket(n) — invariantes para todo n de 4 a 32", () => {
  for (let n = 4; n <= 32; n++) {
    it(`n=${n}: partidos, puestos y descansos son consistentes`, () => {
      const plan = buildBracket(n);

      // Cantidad de partidos según T(m) = (m-P) + T(P) + T(m-P).
      expect(plan.nodes).toHaveLength(matchCountFor(n));

      // La primera ronda + los que descansan suman exactamente los n equipos.
      expect(plan.firstRoundSlots.length * 2 + plan.restEntrySlots.length).toBe(n);

      // Todo slot referenciado por un winnerTo/loserTo existe como nodo (o es
      // undefined, que marca un partido terminal), y ningún slot se repite.
      const slotSet = new Set(plan.nodes.map((x) => x.slot));
      expect(slotSet.size).toBe(plan.nodes.length);
      for (const node of plan.nodes) {
        if (node.winnerTo !== undefined) expect(slotSet.has(node.winnerTo)).toBe(true);
        if (node.loserTo !== undefined) expect(slotSet.has(node.loserTo)).toBe(true);
      }

      // Todo entero de 1..n queda decidido por EXACTAMENTE un lado de
      // EXACTAMENTE un partido: son los puestos finales 1..N, sin huecos ni
      // repetidos. En un cuadro parejo cada partido terminal decide los dos
      // lados juntos (zona de 2); en una zona irregular (3, 5, 9, 17...) el
      // perdedor puede quedar decidido solo, sin rival, mientras el ganador
      // sigue jugando — `positionsFromSlot` expone esa asimetría por lado.
      const decidedPositions = plan.nodes.flatMap((x) => {
        const outcome = positionsFromSlot(x.slot);
        if (!outcome) return [];
        return [outcome.winner, outcome.loser].filter((p): p is number => p !== null);
      });
      expect(decidedPositions.slice().sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1)
      );

      // Toda zona con más de un partido reparte su zona alta en potencia de 2:
      // el bye nunca cae en la rama que pelea el título.
      const zoneSizes = new Set(plan.nodes.map((x) => x.posHigh - x.posLow + 1));
      for (const size of zoneSizes) {
        const p = splitPoint(size);
        expect(Number.isInteger(Math.log2(p))).toBe(true);
      }
    });
  }
});
