import cron from "node-cron";
import { syncEmails } from "./engine";
import { isGmailConnected } from "@/lib/gmail/auth";

let isRunning = false;

export function startCronJobs() {
  // Sync every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const connected = await isGmailConnected();
      if (!connected) {
        return;
      }

      console.log("[Cron] Starting email sync...");
      const result = await syncEmails();
      console.log(
        `[Cron] Sync complete: ${result.emailsScanned} scanned, ${result.shipmentsCreated} created, ${result.shipmentsUpdated} updated, ${result.errors} errors`
      );
    } catch (error) {
      console.error("[Cron] Sync failed:", error);
    } finally {
      isRunning = false;
    }
  });

  console.log("[Cron] Email sync scheduled every 30 minutes");
}
