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

export const OwnedWorkspaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
});
export type OwnedWorkspaceMember = z.infer<typeof OwnedWorkspaceMemberSchema>;

export const OwnedWorkspaceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  productCount: z.number(),
  postCount: z.number(),
  members: z.array(OwnedWorkspaceMemberSchema),
});
export type OwnedWorkspace = z.infer<typeof OwnedWorkspaceSchema>;

export const AccountSchema = z.object({
  name: z.string(),
  image: z.string().nullable(),
  commentEmails: z.boolean(),
  isPlatformOwner: z.boolean(),
  ownedWorkspaces: z.array(OwnedWorkspaceSchema).default([]),
});
export type Account = z.infer<typeof AccountSchema>;

export const UpdatePreferencesInputSchema = z.object({
  commentEmails: z.boolean(),
});
export type UpdatePreferencesInput = z.infer<
  typeof UpdatePreferencesInputSchema
>;

export const DeleteAccountInputSchema = z.object({
  workspaces: z.array(
    z.object({
      slug: z.string(),
      action: z.enum(["transfer", "delete"]),
      toUserId: z.string().optional(),
    })
  ),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;
