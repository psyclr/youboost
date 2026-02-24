export default async function globalTeardown(): Promise<void> {
  // Leave the test DB for faster re-runs.
  // To drop it manually: DROP DATABASE youboost_test;
}
