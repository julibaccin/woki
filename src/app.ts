import express from "express";
import cors from "cors";
import reservationsRouter from "./controllers/reservations.controller";
import { requestLoggerMiddleware } from "./infrastructure/middlewares/requestLoggerMiddleware";

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
