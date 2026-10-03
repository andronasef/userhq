import { randomBytes } from "node:crypto";
import type { TestHelpers } from "better-auth/plugins";

export async function signedInCookie(
  test: TestHelpers,
  user?: { name?: string; image?: string | null; email?: string; emailVerified?: boolean }
): Promise<{ cookie: string; userId: string; email: string }> {
  const randomHex = randomBytes(4).toString("hex");
  const email = user?.email ?? `e2e-${randomHex}@example.test`;
  const name = user?.name ?? "E2E User";
  const image = user?.image !== undefined ? user.image : null;

  const created = test.createUser({
    name,
    email,
    image,
    ...user,
  });
  const saved = await test.saveUser(created);
  const cookies = await test.getCookies({
    userId: saved.id,
    domain: "localhost",
  });
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  return {
    cookie,
    userId: saved.id,
    email: saved.email,
  };
}
