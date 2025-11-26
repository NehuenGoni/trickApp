const { createDefaultPreset } = require("ts-jest");


const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {require("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    "^react-router-dom$": "<rootDir>/src/__mocks__/react-router-dom.ts",
  },
};
