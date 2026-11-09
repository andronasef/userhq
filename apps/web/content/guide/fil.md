<!-- section: overview -->
## Pangkalahatang-ideya at Estruktura

Tinutulungan ng UserHQ ang iyong koponan na mangolekta at umaksyon sa feedback mula sa iyong mga customer. Narito kung paano nakaayos ang iyong workspace:

<cards>
- **1. Workspace**: Ang punong himpilan ng iyong koponan. Narito ang mga miyembro, pagsingil, mga API key, webhook, at ang pinag-isang feedback inbox sa lahat ng iyong produkto.
- **2. Products (Mga Produkto)**: Ang mga indibidwal na app o serbisyong binuo mo (hal. Web App, iOS App, API). Bawat produkto ay may sariling feedback board, roadmap, changelog, mga kategorya, at sariling branding.
- **3. Customer Portals (Mga Portal ng Customer)**: Ang branded na portal na binibisita ng iyong mga user para magsumite ng ideya, bumoto sa mga hiling na feature, subaybayan ang pampublikong roadmap, at magbasa ng mga release announcement.
</cards>

<!-- section: roles-permissions -->
## Mga Tungkulin at Pahintulot ng Koponan

Makipagtulungan nang maayos sa buong koponan habang pinapanatili ang ganap na kontrol sa mga setting ng workspace:

<cards>
- **Workspace Owner (May-ari)**: Ganap na kontrol sa workspace: pamahalaan ang mga subscription, mag-imbita ng mga admin, gumawa ng mga API key, mag-configure ng mga webhook, at maglipat ng pagmamay-ari.
- **Workspace Admin (Admin)**: Maaaring mamahala ng mga produkto, mag-triage ng feedback, opisyal na sumagot sa mga customer, pamahalaan ang mga roadmap card, at mag-publish ng release notes.
- **Workspace Member (Miyembro)**: Maaaring tumingin ng mga naisumiteng feedback, makilahok sa mga panloob na talakayan ng koponan, at sumubaybay sa mga kahilingan ng customer.
</cards>

<!-- section: requests-inbox -->
## Mga Kahilingan at Pag-triage

Matatagpuan sa `/dashboard/[ws]/requests`, pinagsasama-sama ng pinag-isang Requests inbox ang lahat ng isinumite ng mga customer mula sa bawat produkto sa isang mabilis na triage view.

<cards>
- **Multi-Dimension Filtering**: Salain agad ayon sa Produkto, Yugto ng Katayuan (Backlog, Kasalukuyang Ginagawa, Tapos na), Kategorya, Paghahanap gamit ang keyword, at Saklaw ng petsa.
- **Mabilis na Pag-update ng Katayuan**: Ilipat ang mga aytem sa mga yugto (Sinusuri, Nakaplano, Ginagawa, Tapos na) sa isang click. Awtomatikong maipaaalam sa mga customer na bumoto sa kahilingan.
</cards>

<!-- section: comments-attention -->
## Mga Komento at Inbox ng Nangangailangan ng Pansin

Matatagpuan sa `/dashboard/[ws]/comments`, ang inbox na ito ay gumaganap bilang isang mabilis na customer support desk para sa iyong mga talakayan ng feedback.

### Mga Yugto ng Daloy ng Trabaho

<stages>
- **Needs Attention (Kailangan ng Pansin)**: Anumang komento ng customer na wala pang opisyal na sagot mula sa koponan. Minamarkahan ng kulay-amber na indicator upang walang makaligtaang katanungan.
- **Handled (Naasikaso na)**: Awtomatikong naaalis mula sa pila ng pansin kapag sumagot ang isang miyembro ng koponan na may opisyal na badge, o manu-manong minamarkahan bilang naasikaso na.
</stages>

<!-- section: author-location -->
## Pakikipag-ugnayan sa May-akda at Impormasyon sa Lokasyon

Upang bigyan ang iyong koponan ng mahalagang konteksto kung sino ang nagsumite ng feedback, nagpapakita ang mga card ng kahilingan at komento ng mga detalye ng may-akda:

- **Direktang Pakikipag-ugnayan sa Email**: I-click ang mail button sa tabi ng pangalan ng may-akda upang mabilis silang makausap para sa mga panayam sa user o mga tanong.
- **Heograpikong Konteksto**: Tingnan ang tinatayang lokasyon ng customer (hal. `London, United Kingdom [GB]`) upang maunawaan ang mga trend ng paggamit ayon sa rehiyon.
- **Disenyong Nakalaan sa Privacy**: Ang mga email address at lokasyon ng mga may-akda ay makikita lamang ng mga miyembro ng koponan ng workspace at hindi kailanman ipinapakita sa mga pampublikong portal ng customer.

<!-- section: customer-portals -->
## Mga Pampublikong Portal ng Customer

Bawat produkto sa iyong workspace ay maaaring magkaroon ng sarili nitong pampublikong portal sa `/[ws]/[product]`.

<cards>
- **Modular Feature Toggles**: Malayang i-enable o i-disable ang Feedback Board, Roadmap, Changelog, o FAQ sa bawat produkto batay sa iyong kahandaan.
- **Custom Branding at Mga Kulay**: I-customize ang iyong portal gamit ang iyong logo, pangalan ng brand, at custom na accent color para maging seamless na extension ng iyong app.
- **Multi-Language at RTL**: Suporta para sa 13 wika na may awtomatikong pagtukoy sa bisita, tagapili ng wika, at pagsusulat ng naisalokal na content.
- **Pagpapalit ng Default na Wika**: Ang mga umiiral na pagsasalin ay itinataas sa mga pangunahing field at ang dating teksto ay pinapanatili bilang pagsasalin.
- **Mga Badge ng User**: Kilalanin ang mga customer gamit ang mga badge sa tabi ng kanilang pangalan sa mga post at komento, na itinalaga nang manu-mano o sa pamamagitan ng mga panuntunan sa pagpapatungkol.
</cards>

<!-- section: roadmap-changelog -->
## Pagpaplano ng Roadmap at Mga Tala sa Paglabas (Changelog)

<cards>
- **Interaktibong Roadmap**: Isaayos ang pagbuo ng feature sa mga visual na column (hal. Pinag-iisipan, Nakaplano, Ginagawa). Direktang i-link ang feedback ng customer sa mga roadmap card.
- **Changelog at Mga Anunsyo**: Mag-publish ng mga tala sa paglabas na may mga tag ng kategorya (Bagong Feature, Pagpapabuti, Pag-aayos ng Bug) at awtomatikong ipaalam sa mga humiling na customer.
</cards>

<!-- section: faq-system -->
## Self-Serve FAQ Knowledge Base

Magdagdag ng mga madalas itanong na nakaayos sa mga kategorya sa portal ng iyong produkto. Ang pagbibigay ng agarang sagot ay nagbabawas ng mga duplicate na hiling at karaniwang ticket sa suporta.

<!-- section: themes-push -->
## Mga Tema at Web Push Alert

Kasama sa UserHQ ang apat na tema: **System**, **Light**, **Dark** (malalim na navy), at **Charcoal** (neutral na halos itim). Maaari ding i-enable ng mga miyembro ng koponan ang browser Web Push notifications sa `/account`.

<!-- section: api-overview -->
## Automation API at Pagpapatotoo

Ikonekta ang mga panlabas na system, CI/CD pipeline, Slack, Discord, Linear, GitHub, o mga panloob na dashboard gamit ang UserHQ REST Automation API.

### Header ng Pagpapatotoo

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Mga Limitasyon sa Rate**: Mapagbigay na 120 kahilingan/minuto na allowance bawat API key na may awtomatikong token-bucket throttling.
- **Mga Naka-scope na Pahintulot**: Ang mga key ay maaaring i-scope sa mga partikular na produkto at bigyan ng mga piling pahintulot sa pagbasa/pagsulat.
</cards>

<!-- section: swagger-explorer -->
## Interaktibong API Explorer

Subukan ang mga endpoint, suriin ang mga parameter, tingnan ang mga schema ng kahilingan at tugon, at bumuo ng agarang mga snippet ng code sa cURL, TypeScript, at Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Mga Webhook at Pagpapatunay ng Lagda ng HMAC

Naghahatid ang UserHQ ng mga real-time na kaganapan sa HTTP POST sa tuwing may ginagawang mga kahilingan, nagbabago ang katayuan, o dumarating ang mga komento. Bawat paghahatid ay may secure na lagda ng HMAC-SHA256 sa header na `x-userhq-signature`.

### Halimbawa ng Pag-verify ng HMAC sa Node.js / Express

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
