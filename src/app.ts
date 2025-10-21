import express from "express";
import cors from "cors";
import reservationsRouter from "./controllers/reservations.controller";
import { logger } from "./infrastructure/logger/pinoLogger";
import { AsyncLocalStorage } from "node:async_hooks";
import { requestLoggerMiddleware } from "./infrastructure/middlewares/requestLoggerMiddleware";

// Creamos el storage para guardar datos por request
const asyncLocal = new AsyncLocalStorage<{ requestId: string }>();

// Helper para obtener un logger con contexto
export function getLogger() {
  const store = asyncLocal.getStore();
  return store ? logger.child({ requestId: store.requestId }) : logger;
}

export function createApp() {
  const app = express();

  app.use(cors());
  
  app.use(requestLoggerMiddleware);

  app.use(express.json());

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      req.logger.info({
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });
    next();
  });

  app.use("/api", reservationsRouter);

  return app;
}
