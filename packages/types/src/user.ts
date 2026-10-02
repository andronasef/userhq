import { z } from "zod";

export const PublicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
