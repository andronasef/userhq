import type { Metadata } from "next";
import { LegalPage } from "../../../components/legal-page";
import { getRequestLocale, getDictionary } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.terms.title} · UserHQ`,
    description: dict.terms.intro,
  };
}

export default async function TermsPage(): Promise<React.JSX.Element> {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);

  return (
    <LegalPage title={dict.terms.title} updated={dict.terms.updated}>
      <p>{dict.terms.intro}</p>

      <h2>{dict.terms.h2Account}</h2>
      <p>{dict.terms.accountDesc}</p>

      <h2>{dict.terms.h2Content}</h2>
      <p>{dict.terms.contentDesc}</p>

      <h2>{dict.terms.h2Acceptable}</h2>
      <p>{dict.terms.acceptableDesc}</p>

      <h2>{dict.terms.h2Availability}</h2>
      <p>{dict.terms.availabilityDesc}</p>

      <h2>{dict.terms.h2Liability}</h2>
      <p>{dict.terms.liabilityDesc}</p>

      <h2>{dict.terms.h2Changes}</h2>
      <p>
        {dict.terms.changesDesc}{" "}
        <a href="/privacy">{dict.privacy.title}</a>.
      </p>

      <h2>{dict.terms.h2Contact}</h2>
      <p>
        <a href="mailto:hello@increasinglab.com">hello@increasinglab.com</a>
      </p>
    </LegalPage>
  );
}
