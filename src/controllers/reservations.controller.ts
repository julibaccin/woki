import express from "express";
import { defaultRepo } from "../repositories/inMemoryRepository";
import { createReservationUseCase } from "../usecases/createReservation";
import { validateBody } from "../infrastructure/middlewares/validateZod";
import { createReservationSchema } from "../infrastructure/schemas/createReservationSchema";
import { getAvailabilityUseCase } from "../usecases/getAvailability";

const router = express.Router();

router.get("/availability", async (req, res) => {
 try {
    const { restaurantId, sectorId, date, partySize } = req.query as any;
    const availability = await getAvailabilityUseCase(defaultRepo, {
      restaurantId,
      sectorId,
      date,
      partySize: Number(partySize),
    });
    return res.json(availability);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.error ?? "internal", detail: err.detail });
  }
});

router.post("/reservations", validateBody(createReservationSchema), async (req, res) => {
  try {
    const idempotencyKey = req.header("Idempotency-Key") ?? undefined;
    const payload = req.body;
    const result = await createReservationUseCase(
      defaultRepo,
      payload,
      idempotencyKey
    );
    if (result.fromCache) return res.status(200).json(result.reservation);
    return res.status(201).json(result.reservation);
  } catch (err: any) {
    if (err.status)
      return res
        .status(err.status)
        .json({ error: err.error, detail: err.detail });
    console.error(err);
    return res.status(500).json({ error: "internal" });
  }
});

router.delete("/reservations/:id", async (req, res) => {
  const id = req.params.id;
  const ok = await defaultRepo.cancelReservation(id);
  if (!ok) return res.status(404).json({ error: "not_found" });
  return res.status(204).send();
});

router.get("/reservations/day", async (req, res) => {
  const { restaurantId, date, sectorId } = req.query as any;
  if (!restaurantId || !date)
    return res.status(400).json({ error: "missing_params" });
  const items = await defaultRepo.listReservationsForDay(
    restaurantId,
    date,
    sectorId
  );
  return res.json({ date, items });
});

export default router;
