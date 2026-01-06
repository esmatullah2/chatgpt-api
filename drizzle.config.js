import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./db/migration",
  schema: "./db/schema.js",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
