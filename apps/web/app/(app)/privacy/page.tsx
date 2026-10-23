import type { Metadata } from "next";
import { LegalPage } from "../../../components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · UserHQ",
  description: "How UserHQ collects, uses, and protects your information.",
};

export default function PrivacyPage(): React.JSX.Element {
  return (
    <LegalPage title="Privacy Policy" updated="October 23, 2026">
      <p>
        UserHQ is operated by Increasing Labs. This policy explains what we collect when you use
        UserHQ, why, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with Google or GitHub we receive
          your name, email address, and profile picture. We do not receive your password.
        </li>
        <li>
          <strong>Content you submit.</strong> Feedback posts, comments, votes, and images you
          upload to a product portal.
        </li>
        <li>
          <strong>Device information.</strong> Basic browser and device details (such as browser
          and operating system) attached to posts and comments to help product teams reproduce
          issues.
        </li>
        <li>
          <strong>Session cookies.</strong> We use a cookie to keep you signed in. We do not use
          advertising or cross-site tracking cookies.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run the service: authenticate you, display your posts and comments, send notifications
        about activity you follow, and keep the service secure. We do not sell your information.
      </p>

      <h2>Who can see it</h2>
      <p>
        Posts, comments, and your display name are visible to others on the product portal where
        you post, and to that product&apos;s team. Your email address is visible to the team of the
        product you interact with, but not to other users.
      </p>

      <h2>Service providers</h2>
      <p>
        We use Google and GitHub for sign-in and Brevo to deliver email. Data is stored on servers
        operated by Increasing Labs.
      </p>

      <h2>Email</h2>
      <p>
        Notification emails include a one-click unsubscribe link. Essential account emails may
        still be sent.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can delete your account from your
        account page, which removes your personal information; contact us if you need help.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests:{" "}
        <a href="mailto:hello@increasinglab.com">hello@increasinglab.com</a>.
      </p>
    </LegalPage>
  );
}
