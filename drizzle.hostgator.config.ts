import { defineConfig } from "drizzle-kit";
import { assertDistinctMysqlEndpoints } from "./scripts/mysql-endpoint";

const connectionString = process.env.APP_DATABASE_URL;
if (!connectionString) {
  throw new Error("APP_DATABASE_URL is required for HostGator database migrations");
}
const sourceConnectionString = process.env.DATABASE_URL;
if (!sourceConnectionString) {
  throw new Error(
    "DATABASE_URL is required to verify the HostGator target is distinct from the source"
  );
}
assertDistinctMysqlEndpoints(sourceConnectionString, connectionString);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
