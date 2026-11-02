import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStorageProxy } from "./storageProxy";

export function createExpressApp() {
  const app = express();
  
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  
  registerOAuthRoutes(app);
  registerStorageProxy(app);
  
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "POST" && req.get("sec-fetch-site") === "cross-site") {
      return res.status(403).json({ error: "Cross-site mutations are not allowed." });
    }
    if (req.method === "POST" && !req.is("application/json")) {
      return res.status(415).json({ error: "tRPC mutations require application/json." });
    }
    next();
  });
  
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  return app;
}

async function startServer() {
  const app = createExpressApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

// Only start the server automatically if we are not running inside Vercel Serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().catch(error => { console.error(error); process.exit(1); });
}
