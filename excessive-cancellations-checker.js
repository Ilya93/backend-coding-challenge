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
   * Analyze trades from the file
   */
  async #analyzeTrades() {
    const companyTrades = new Map();
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({ input: fileStream });

    // Process csv lines
    for await (const line of rl) {
      const trade = this.#parseTradeData(line);
      if (!trade) continue;

      const { company } = trade;
      this.#allCompanies.add(company);

      const trades = companyTrades.get(company) || [];
      trades.push(trade);
      companyTrades.set(company, trades);
    }

    // Check company trades
    for (const [company, trades] of companyTrades) {
      this.#checkExcessiveCancellations(trades, company);
    }
  }

  /**
   * Parse trade data from the line
   */
  #parseTradeData(line) {
    try {
      const parts = line.split(",");
      if (parts.length !== 4) return null;

      const time = new Date(parts[0].trim()).getTime();
      const company = parts[1].trim();
      const orderType = parts[2].trim();
      const quantity = Number(parts[3].trim());

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
   * Check if cancellations are excessive within the 60 sec period
   */
  #checkExcessiveCancellations(trades, company) {
    const timePeriod = 60000; // 60 seconds in milliseconds

    let start = 0;
    for (let end = 0; end < trades.length; end++) {
      let totalOrders = 0;
      let totalCancels = 0;

      // Move the start index to keep the trades within the time period
      while (trades[end].time - trades[start].time > timePeriod) {
        start++;
      }

      // Move the end index to keep the trades within the time period
      while (
        trades[end + 1] &&
        trades[end + 1].time - trades[start].time <= timePeriod
      ) {
        end++;
      }

      // Process the trades within the time period
      const tradesWindow = trades.slice(start, end + 1);
      for (let i = 0; i < tradesWindow.length; i++) {
        const trade = tradesWindow[i];
        if (trade.orderType === "D") {
          totalOrders += trade.quantity;
        } else if (trade.orderType === "F") {
          totalCancels += trade.quantity;
        }
      }

      // Check for excessive cancellations condition
      if (totalCancels / Math.max(totalOrders, 1) > 1 / 3) {
        this.#excessiveCompanies.add(company);
        return;
      }
    }
  }
}
