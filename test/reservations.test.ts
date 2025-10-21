import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { defaultRepo } from "../src/repositories/inMemoryRepository";
import { DateTime } from "luxon";

const app = createApp();

describe("reservations", () => {
  beforeEach(() => {
    defaultRepo.clear();
  });

  it("happy path create reservation -> 201", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "k1")
      .send({
        restaurantId: "R1",
        sectorId: "S1",
        partySize: 4,
        startDateTimeISO: "2025-09-08T20:00:00-03:00",
        customer: { name: "John", phone: "+54", email: "a@b.com" },
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.tableIds).toBeDefined();
  });

  it("idempotency returns same reservation for same key", async () => {
    const key = "idem-xyz";
    const a = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", key)
      .send({
        restaurantId: "R1",
        sectorId: "S1",
        partySize: 2,
        startDateTimeISO: "2025-09-08T20:15:00-03:00",
        customer: { name: "Ana", phone: "+54", email: "a@b.com" },
      });
    const b = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", key)
      .send({
        restaurantId: "R1",
        sectorId: "S1",
        partySize: 2,
        startDateTimeISO: "2025-09-08T20:15:00-03:00",
        customer: { name: "Ana", phone: "+54", email: "a@b.com" },
      });
    expect(a.body.id).toEqual(b.body.id);
  });

  it("concurrency produces one 201 and one 409", async () => {
    const p1 = request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "c1")
      .send({
        restaurantId: "R1",
        sectorId: "S1",
        partySize: 6,
        startDateTimeISO: "2025-09-08T20:30:00-03:00",
        customer: { name: "C1", phone: "+54", email: "c1@x.com" },
      });
    const p2 = request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "c2")
      .send({
        restaurantId: "R1",
        sectorId: "S1",
        partySize: 6,
        startDateTimeISO: "2025-09-08T20:30:00-03:00",
        customer: { name: "C2", phone: "+54", email: "c2@x.com" },
      });
    const results = await Promise.all([p1, p2]);
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });

  it("Boundary: adjacent reservations touching at end-exclusive do not collide", async () => {
    const start1 = "2025-09-08T20:00:00-03:00";
    const start2 = "2025-09-08T21:30:00-03:00";
    const payload = {
      restaurantId: "R1",
      sectorId: "S1",
      partySize: 6,
      customer: { name: "A", phone: "+54", email: "a@x.com" },
    };

    const r1 = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "b1")
      .send({ ...payload, startDateTimeISO: start1 });
    const r2 = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "b2")
      .send({ ...payload, startDateTimeISO: start2 });

    expect([r1.status, r2.status]).toEqual([201, 201]);
  });

  it("Shifts: attempt outside shift → 422", async () => {
    const payload = {
      restaurantId: "R1",
      sectorId: "S1",
      partySize: 4,
      startDateTimeISO: "2025-09-08T03:00:00-03:00",
      customer: { name: "NightOwl", phone: "+54", email: "n@x.com" },
    };

    const res = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "s1")
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("outside_service_window");
  });

  it("Cancel: DELETE → 204, slot returns to available", async () => {
    const start = "2025-09-08T20:00:00-03:00";
    const payload = {
      restaurantId: "R1",
      sectorId: "S1",
      partySize: 6,
      startDateTimeISO: start,
      customer: { name: "C1", phone: "+54", email: "c@x.com" },
    };

    const create = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "d1")
      .send(payload);
    expect(create.status).toBe(201);
    const id = create.body.id;

    const del = await request(app).delete(`/api/reservations/${id}`);
    expect(del.status).toBe(204);

    const avail = await request(app).get(
      `/api/availability?restaurantId=R1&sectorId=S1&date=2025-09-08&partySize=4`
    );
    const slot = avail.body.slots.find((s: any) =>
      s.start.startsWith("2025-09-08T20:00:00")
    );
    expect(slot.available).toBe(true);
  });

  it("Timestamps: verify createdAt/updatedAt on create/cancel", async () => {
    const start = "2025-09-08T22:00:00-03:00";
    const payload = {
      restaurantId: "R1",
      sectorId: "S1",
      partySize: 4,
      startDateTimeISO: start,
      customer: { name: "T", phone: "+54", email: "t@x.com" },
    };

    const create = await request(app)
      .post("/api/reservations")
      .set("Idempotency-Key", "t1")
      .send(payload);
    expect(create.status).toBe(201);

    const resv = create.body;
    expect(resv.createdAt).toBeDefined();
    expect(resv.updatedAt).toBeDefined();
    expect(DateTime.fromISO(resv.createdAt).isValid).toBe(true);

    const del = await request(app).delete(`/api/reservations/${resv.id}`);
    expect(del.status).toBe(204);

    const after = defaultRepo.reservations.get(resv.id);
    expect(after!.status).toBe("CANCELLED");
    expect(after!.updatedAt).not.toBe(resv.updatedAt);
  });
});
