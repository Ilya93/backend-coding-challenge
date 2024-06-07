import fs from "fs";
import readline from "readline";

export class ExcessiveCancellationsChecker {
  #allCompanies = new Set();
  #excessiveCompanies = new Set();

  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * Returns the list of companies that are involved in excessive cancelling.
   */
  async companiesInvolvedInExcessiveCancellations() {
    await this.#analyzeTrades();
    return Array.from(this.#excessiveCompanies);
  }

  /**
   * Returns the total number of companies that are not involved in any excessive cancelling.
   */
  async totalNumberOfWellBehavedCompanies() {
    await this.#analyzeTrades();
    return this.#allCompanies.size - this.#excessiveCompanies.size;
  }

  /**
   * Reads and analyzes trade data from the provided file.
   *
   * This method populates the `#allCompanies` and `#excessiveCompanies` sets based on the analysis.
   */
  async #analyzeTrades() {
    const companyTrades = new Map();
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({ input: fileStream });

    // Iterate over each line in the CSV file
    for await (const line of rl) {
      const trade = this.#parseTradeData(line);
      if (!trade) continue;

      const { company } = trade;
      this.#allCompanies.add(company);

      const trades = companyTrades.get(company) || [];
      trades.push(trade);
      companyTrades.set(company, trades);
    }

    // Analyze trades for each company
    for (const [company, trades] of companyTrades) {
      this.#checkExcessiveCancellations(trades, company);
    }
  }

  /**
   * Parses a single line of trade data from the CSV file.
   *
   * @param {string} line - A single line from the CSV file.
   * @returns {object|null} An object containing parsed trade data, or null if parsing fails.
   */
  #parseTradeData(line) {
    try {
      const parts = line.split(",");
      if (parts.length !== 4) return null;

      const time = new Date(parts[0].trim()).getTime();
      const company = parts[1].trim();
      const orderType = parts[2].trim();
      const quantity = Number(parts[3].trim());

      // Validate parsed data
      if (
        isNaN(time) ||
        !company ||
        !["D", "F"].includes(orderType) ||
        isNaN(quantity)
      ) {
        return null;
      }

      return { time, company, orderType, quantity };
    } catch {
      return null;
    }
  }

  /**
   * Checks for excessive order cancellations within a sliding window of 60 seconds.
   *
   * @param {object[]} trades - An array of trade objects for a specific company.
   * @param {string} company - The name of the company being analyzed.
   */
  #checkExcessiveCancellations(trades, company) {
    const timePeriod = 60000; // 60 seconds in milliseconds

    let start = 0;
    for (let end = 0; end < trades.length; end++) {
      let totalOrders = 0;
      let totalCancels = 0;

      // Move the start index to keep the window within the 60-second time period
      while (trades[end].time - trades[start].time > timePeriod) {
        start++;
      }

      // Expand the window to include all trades within the 60-second period
      while (
        trades[end + 1] &&
        trades[end + 1].time - trades[start].time <= timePeriod
      ) {
        end++;
      }

      // Analyze trades within the current window
      const tradesWindow = trades.slice(start, end + 1);
      for (let i = 0; i < tradesWindow.length; i++) {
        const trade = tradesWindow[i];
        if (trade.orderType === "D") {
          totalOrders += trade.quantity;
        } else if (trade.orderType === "F") {
          totalCancels += trade.quantity;
        }
      }

      // Check for excessive cancellation condition
      if (totalCancels / Math.max(totalOrders, 1) > 1 / 3) {
        this.#excessiveCompanies.add(company);
        return;
      }
    }
  }
}
