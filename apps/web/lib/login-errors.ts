export type LoginErrorCopy = {
  title: string;
  body: string;
};

export const LOGIN_ERRORS: Record<string, LoginErrorCopy> = {
  access_denied: {
    title: "Sign-in canceled",
    body: "You canceled sign-in at the provider. Choose Google or GitHub to try again.",
  },
  state_mismatch: {
    title: "Sign-in timed out",
    body: "Your sign-in attempt expired. Start again below.",
  },
  state_not_found: {
    title: "Sign-in timed out",
    body: "Your sign-in attempt expired. Start again below.",
  },
  state_invalid: {
    title: "Sign-in timed out",
    body: "Your sign-in attempt expired. Start again below.",
  },
  please_restart_the_process: {
    title: "Sign-in timed out",
    body: "Your sign-in attempt expired. Start again below.",
  },
  account_not_linked: {
    title: "Couldn't connect this account",
    body: "An account with this email already exists, but this provider didn't confirm the email address. Sign in with the provider you used before.",
  },
  unable_to_link_account: {
    title: "Couldn't connect this account",
    body: "An account with this email already exists, but this provider didn't confirm the email address. Sign in with the provider you used before.",
  },
  email_not_found: {
    title: "No email address shared",
    body: "Your account didn't share an email address with us. Add a verified email to your Google or GitHub account, then try again.",
  },
  unable_to_get_user_info: {
    title: "Couldn't reach the provider",
    body: "We couldn't finish signing you in with that provider. Try again, or use the other provider.",
  },
  invalid_code: {
    title: "Couldn't reach the provider",
    body: "We couldn't finish signing you in with that provider. Try again, or use the other provider.",
  },
  no_code: {
    title: "Couldn't reach the provider",
    body: "We couldn't finish signing you in with that provider. Try again, or use the other provider.",
  },
  request_failed: {
    title: "Couldn't start sign-in",
    body: "Check your connection and try again.",
  },
  account_banned: {
    title: "This account can't sign in",
    body: "Your access to UserHQ has been suspended. If you think this is a mistake, contact the UserHQ team.",
  },
};

export function loginErrorCopy(code: string): LoginErrorCopy {
  return (
    LOGIN_ERRORS[code] ?? {
      title: "Sign-in failed",
      body: "Something went wrong while signing you in. Try again.",
    }
  );
}

export function isDisplayableErrorCode(code: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(code);
}
