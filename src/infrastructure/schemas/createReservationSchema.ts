import { z } from "zod";
import { DateTime } from "luxon";

export const createReservationSchema = z.object({
  restaurantId: z.string().nonempty(),
  sectorId: z.string().nonempty(),
  partySize: z.number().int().min(1),
  startDateTimeISO: z.string().refine(val => DateTime.fromISO(val).isValid, { message: "Invalid datetime" }),
  customer: z.object({
    name: z.string().nonempty(),
    phone: z.string().nonempty(),
    email: z.string().email(),
  }),
  notes: z.string().optional(),
});