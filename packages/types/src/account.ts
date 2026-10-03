import { z } from "zod";

export const UnsubscribeStateSchema = z.object({
  scope: z.enum(["all", "post"]),
  state: z.enum(["subscribed", "unsubscribed", "post_unavailable"]),
  postTitle: z.string().nullable(),
  postUrl: z.string().nullable(),
});
export type UnsubscribeState = z.infer<typeof UnsubscribeStateSchema>;

export const MuteResultSchema = z.object({
  muted: z.boolean(),
});
export type MuteResult = z.infer<typeof MuteResultSchema>;
