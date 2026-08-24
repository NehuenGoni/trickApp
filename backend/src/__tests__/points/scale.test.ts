import { pointsForPosition, sizeMultiplier } from "../../utils/points";
import { POINTS_TABLE } from "../../config/constants";

describe("pointsForPosition — regresión: n=8 reproduce POINTS_TABLE exactamente", () => {
  it.each(["grand-slam", "master-1000"] as const)("%s: todas las posiciones 1..8", (type) => {
    const table = POINTS_TABLE[type];
    for (let pos = 1; pos <= 8; pos++) {
      expect(pointsForPosition(type, pos, 8)).toBe(table[pos as keyof typeof table]);
    }
  });

  it("sizeMultiplier(8) es exactamente 1", () => {
    expect(sizeMultiplier(8)).toBe(1);
  });
});

describe("sizeMultiplier — escala continua acordada", () => {
  it("8 → ×1, 16 → ×1.5, 32 → ×2", () => {
    expect(sizeMultiplier(8)).toBeCloseTo(1, 10);
    expect(sizeMultiplier(16)).toBeCloseTo(1.5, 10);
    expect(sizeMultiplier(32)).toBeCloseTo(2, 10);
  });

  it("14 equipos (el caso real: 42 jugadores en tríos) da ×1.40", () => {
    expect(sizeMultiplier(14)).toBeCloseTo(1.4, 1);
  });

  it("es monótona creciente en n", () => {
    const sizes = [4, 6, 8, 10, 14, 16, 24, 32];
    for (let i = 1; i < sizes.length; i++) {
      expect(sizeMultiplier(sizes[i])).toBeGreaterThan(sizeMultiplier(sizes[i - 1]));
    }
  });
});

describe("pointsForPosition — cima de la tabla en distintos tamaños", () => {
  it("grand-slam, campeón: 25 (n=8) · 35 (n=14) · 38 (n=16) · 50 (n=32)", () => {
    expect(pointsForPosition("grand-slam", 1, 8)).toBe(25);
    expect(pointsForPosition("grand-slam", 1, 14)).toBe(35);
    expect(pointsForPosition("grand-slam", 1, 16)).toBe(38);
    expect(pointsForPosition("grand-slam", 1, 32)).toBe(50);
  });

  it("los puntos son siempre un número entero, para cualquier tamaño y puesto", () => {
    for (const n of [4, 6, 8, 9, 14, 16, 23, 32]) {
      for (let pos = 1; pos <= n; pos++) {
        const points = pointsForPosition("grand-slam", pos, n);
        expect(Number.isInteger(points)).toBe(true);
      }
    }
  });

  it("master-1000, campeón: 12 (n=8) · 18 (n=16) · 24 (n=32)", () => {
    expect(pointsForPosition("master-1000", 1, 8)).toBe(12);
    expect(pointsForPosition("master-1000", 1, 16)).toBe(18);
    expect(pointsForPosition("master-1000", 1, 32)).toBe(24);
  });

  it("último puesto en master-1000 sigue valiendo 0 en cualquier tamaño", () => {
    expect(pointsForPosition("master-1000", 8, 8)).toBe(0);
    expect(pointsForPosition("master-1000", 16, 16)).toBe(0);
    expect(pointsForPosition("master-1000", 32, 32)).toBe(0);
  });

  it("un tipo de torneo inválido no rompe, devuelve 0", () => {
    expect(pointsForPosition("no-existe", 1, 8)).toBe(0);
  });
});
