import { describe, it, expect } from "vitest";
import { loginErrorCopy, isDisplayableErrorCode } from "./login-errors";

describe("loginErrorCopy and isDisplayableErrorCode", () => {
  it("maps access_denied", () => {
    const res = loginErrorCopy("access_denied");
    expect(res.title).toBe("Sign-in canceled");
    expect(res.body).toBe(
      "You canceled sign-in at the provider. Choose Google or GitHub to try again."
    );
  });

  it("maps state error codes to Sign-in timed out", () => {
    for (const code of [
      "state_mismatch",
      "state_not_found",
      "state_invalid",
      "please_restart_the_process",
    ]) {
      const res = loginErrorCopy(code);
      expect(res.title).toBe("Sign-in timed out");
      expect(res.body).toBe("Your sign-in attempt expired. Start again below.");
    }
  });

  it("maps account linking codes to Couldn't connect this account", () => {
    for (const code of ["account_not_linked", "unable_to_link_account"]) {
      const res = loginErrorCopy(code);
      expect(res.title).toBe("Couldn't connect this account");
      expect(res.body).toBe(
        "An account with this email already exists, but this provider didn't confirm the email address. Sign in with the provider you used before."
      );
    }
  });

  it("maps email_not_found to No email address shared", () => {
    const res = loginErrorCopy("email_not_found");
    expect(res.title).toBe("No email address shared");
    expect(res.body).toBe(
      "Your account didn't share an email address with us. Add a verified email to your Google or GitHub account, then try again."
    );
  });

  it("maps provider reachability codes to Couldn't reach the provider", () => {
    for (const code of [
      "unable_to_get_user_info",
      "invalid_code",
      "no_code",
    ]) {
      const res = loginErrorCopy(code);
      expect(res.title).toBe("Couldn't reach the provider");
      expect(res.body).toBe(
        "We couldn't finish signing you in with that provider. Try again, or use the other provider."
      );
    }
  });

  it("maps request_failed to Couldn't start sign-in", () => {
    const res = loginErrorCopy("request_failed");
    expect(res.title).toBe("Couldn't start sign-in");
    expect(res.body).toBe("Check your connection and try again.");
  });

  it("maps account_banned to This account can't sign in", () => {
    const res = loginErrorCopy("account_banned");
    expect(res.title).toBe("This account can't sign in");
    expect(res.body).toBe(
      "Your access to UserHQ has been suspended. If you think this is a mistake, contact the UserHQ team."
    );
  });

  it("maps unknown or unlisted code to Sign-in failed fallback", () => {
    const res = loginErrorCopy("some_unknown_error_code");
    expect(res.title).toBe("Sign-in failed");
    expect(res.body).toBe(
      "Something went wrong while signing you in. Try again."
    );
  });

  it("validates isDisplayableErrorCode regex", () => {
    expect(isDisplayableErrorCode("access_denied")).toBe(true);
    expect(isDisplayableErrorCode("state_mismatch")).toBe(true);
    expect(isDisplayableErrorCode("BAD CODE")).toBe(false);
    expect(isDisplayableErrorCode("<script>")).toBe(false);
    expect(isDisplayableErrorCode("error-code-with-hyphens")).toBe(false);
    expect(isDisplayableErrorCode("")).toBe(false);
    expect(isDisplayableErrorCode("a".repeat(64))).toBe(true);
    expect(isDisplayableErrorCode("a".repeat(65))).toBe(false);
  });
});
