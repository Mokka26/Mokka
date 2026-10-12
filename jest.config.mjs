// Jest-configuratie via next/jest: SWC-transform (TS/TSX, jest.mock-hoisting,
// next/font- en CSS-mocks) en de `@/`-alias uit tsconfig.json. Een
// jest.config.ts zou ts-node vereisen (niet in de dependencies), vandaar .mjs.
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  // Alle bibliotheek- en route-tests draaien in Node. Een component-test zet
  // bovenaan het bestand: /** @jest-environment jsdom */
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.@(ts|tsx)"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/coverage/"],
  clearMocks: true,
  collectCoverageFrom: ["lib/**/*.ts"],
  coverageReporters: ["text-summary", "lcov"],
  coverageThreshold: {
    // Alleen lib/ heeft een harde ondergrens; app/-routes worden gericht getest.
    "./lib/": { lines: 70 },
  },
};

export default createJestConfig(config);
