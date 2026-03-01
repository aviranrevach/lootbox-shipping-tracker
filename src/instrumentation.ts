export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateGmailAccountsSchema, migrateLegacyTokens } = await import(
      "./lib/db/migrate-accounts"
    );
    await migrateGmailAccountsSchema();

    // Migrate legacy tokens in background — makes external API call
    migrateLegacyTokens().catch(console.error);

    const { startCronJobs } = await import("./lib/sync/cron");
    startCronJobs();
  }
}
