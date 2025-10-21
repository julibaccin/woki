import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../logger/pinoLogger";
import { RequestHandler } from "express";

const asyncLocal = new AsyncLocalStorage<{ requestId: string }>();

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const requestId = Math.random().toString(36).slice(2, 9);
  res.setHeader("X-Request-Id", requestId);
  req.logger = logger.child({ requestId });
  asyncLocal.run({ requestId }, () => next());
};
