export function isPlatformOwner(
  user: { email?: string | null; emailVerified?: boolean | null } | null | undefined,
  ownerEmail: string
): boolean {
  return (
    !!user &&
    user.emailVerified === true &&
    (user.email ?? "").toLowerCase() === ownerEmail.toLowerCase()
  );
}
