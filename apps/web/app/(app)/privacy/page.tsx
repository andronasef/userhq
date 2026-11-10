import type { Metadata } from "next";
import { LegalPage } from "../../../components/legal-page";
import { getRequestLocale, getDictionary } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.privacy.title} · UserHQ`,
    description: dict.privacy.intro,
  };
}

export default async function PrivacyPage(): Promise<React.JSX.Element> {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);

  return (
    <LegalPage title={dict.privacy.title} updated={dict.privacy.updated}>
      <p>{dict.privacy.intro}</p>

      <h2>{dict.privacy.h2Collect}</h2>
      <ul>
        <li>
          <strong>{dict.privacy.accountInfoTitle}</strong> {dict.privacy.accountInfoDesc}
        </li>
        <li>
          <strong>{dict.privacy.contentSubmitTitle}</strong> {dict.privacy.contentSubmitDesc}
        </li>
        <li>
          <strong>{dict.privacy.deviceInfoTitle}</strong> {dict.privacy.deviceInfoDesc}
        </li>
        <li>
          <strong>{dict.privacy.cookiesTitle}</strong> {dict.privacy.cookiesDesc}
        </li>
      </ul>

      <h2>{dict.privacy.h2Use}</h2>
      <p>{dict.privacy.useDesc}</p>

      <h2>{dict.privacy.h2WhoCanSee}</h2>
      <p>{dict.privacy.whoCanSeeDesc}</p>

      <h2>{dict.privacy.h2Providers}</h2>
      <p>{dict.privacy.providersDesc}</p>

      <h2>{dict.privacy.h2Email}</h2>
      <p>{dict.privacy.emailDesc}</p>

      <h2>{dict.privacy.h2Retention}</h2>
      <p>{dict.privacy.retentionDesc}</p>

      <h2>{dict.privacy.h2Contact}</h2>
      <p>
        {dict.privacy.contactDesc}{" "}
        <a href="mailto:hello@increasinglab.com">hello@increasinglab.com</a>.
      </p>
    </LegalPage>
  );
}
