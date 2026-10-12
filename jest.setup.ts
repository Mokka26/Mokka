// Draait vóór elk testbestand (setupFilesAfterEnv). jest-dom levert de
// DOM-matchers (toBeInTheDocument, toHaveAttribute, …) voor component-tests
// die met /** @jest-environment jsdom */ draaien; in Node-tests is de import
// onschadelijk.
import "@testing-library/jest-dom";

// Tests mogen nooit de echte database, Mollie of SMTP raken. next/jest laadt
// .env-bestanden; deze sleutels worden hier bewust gewist zodat een vergeten
// jest.mock hard faalt in plaats van stil een verbinding op te zetten.
for (const key of ["DATABASE_URL", "MOLLIE_API_KEY", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
  delete process.env[key];
}
