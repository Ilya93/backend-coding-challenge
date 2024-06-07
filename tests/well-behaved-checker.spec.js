import { ExcessiveCancellationsChecker } from "../excessive-cancellations-checker.js";

const checker = new ExcessiveCancellationsChecker("./data/trades.csv");

describe("Well Behaved Test", () => {
  describe("calculate", () => {
    it("gets the number of well behaved companies", async () => {
      const companiesNumber = await checker.totalNumberOfWellBehavedCompanies();
      expect(companiesNumber).toEqual(12);
    });
  });
});
