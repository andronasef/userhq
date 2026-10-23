import type { Metadata } from "next";
import { LegalPage } from "../../../components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · UserHQ",
  description: "The terms that govern your use of UserHQ.",
};

export default function TermsPage(): React.JSX.Element {
  return (
    <LegalPage title="Terms of Service" updated="October 23, 2026">
      <p>
        By using UserHQ, operated by Increasing Labs, you agree to these terms. If you do not
        agree, please do not use the service.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with Google or GitHub and are responsible for activity on your account.
        Workspace creation is by invitation.
      </p>

      <h2>Your content</h2>
      <p>
        You own what you post. You grant us and the relevant product team a license to host and
        display it as part of the service. Do not post anything unlawful, abusive, infringing, or
        malicious, or attempt to access data that is not yours.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not disrupt the service, probe for vulnerabilities without permission, scrape it at
        scale, or use it to send spam. We may remove content or suspend accounts that violate these
        terms.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep UserHQ running but provide it &ldquo;as is&rdquo; without warranties. We may
        change or discontinue features at any time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, Increasing Labs is not liable for indirect or consequential
        damages arising from your use of the service.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; continued use after a change means you accept it. See also our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@increasinglab.com">hello@increasinglab.com</a>
      </p>
    </LegalPage>
  );
}
