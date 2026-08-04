/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  // Los tests de integración levantan un replica set en memoria y corren
  // transacciones reales (withTransaction): dejarlos correr en serie evita
  // que compitan por CPU/puertos y hace los fallos reproducibles.
  maxWorkers: 1,
  testTimeout: 30000,
  clearMocks: true,
};
