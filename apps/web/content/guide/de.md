<!-- section: overview -->
## Übersicht & Struktur

UserHQ hilft Ihrem Team, Feedback von Ihren Kunden zu sammeln und darauf zu reagieren. So ist Ihr Arbeitsbereich aufgebaut:

<cards>
- **1. Workspace (Arbeitsbereich)**: Die zentrale Anlaufstelle Ihres Teams. Beherbergt Ihre Teammitglieder, Abrechnung, API-Schlüssel, Webhooks und den einheitlichen Feedback-Posteingang für alle Ihre Produkte.
- **2. Products (Produkte)**: Die einzelnen Apps oder Dienste, die Sie entwickeln (z. B. Web-App, iOS-App, API). Jedes Produkt hat sein eigenes Feedback-Board, seine eigene Roadmap, sein Changelog, Kategorien und individuelles Branding.
- **3. Customer Portals (Kundenportale)**: Das gebrandete Portal, das Ihre Benutzer besuchen, um Ideen einzureichen, über Feature-Anfragen abzustimmen, Ihre öffentliche Roadmap zu verfolgen und Release-Ankündigungen zu lesen.
</cards>

<!-- section: roles-permissions -->
## Rollen & Teamberechtigungen

Arbeiten Sie nahtlos mit Ihrem gesamten Team zusammen und behalten Sie gleichzeitig die volle Kontrolle über die Einstellungen des Arbeitsbereichs:

<cards>
- **Workspace Owner (Inhaber)**: Vollständige Kontrolle: Abonnements verwalten, Administratoren einladen, API-Schlüssel erstellen, Webhooks konfigurieren und Eigentümerschaft übertragen.
- **Workspace Admin (Administrator)**: Kann Produkte verwalten, Feedback triagieren, Kunden offiziell antworten, Roadmap-Karten verwalten und Versionshinweise veröffentlichen.
- **Workspace Member (Mitglied)**: Kann Feedback-Einsendungen einsehen, an internen Teamdiskussionen teilnehmen und Kundenanfragen verfolgen.
</cards>

<!-- section: requests-inbox -->
## Feedback-Anfragen & Triage

Unter `/dashboard/[ws]/requests` vereint der einheitliche Posteingang alle Kundeneinsendungen aus jedem Produkt in einer einzigen, leistungsstarken Triage-Ansicht.

<cards>
- **Mehrdimensionale Filterung**: Filtern Sie sofort nach Produkt, Statusphase (Backlog, In Bearbeitung, Abgeschlossen), Kategorie, Stichwortsuche und Datumsbereichen.
- **Schnelle Statusaktualisierungen**: Verschieben Sie Einträge mit einem Klick zwischen Phasen (Wird geprüft, Geplant, In Bearbeitung, Abgeschlossen). Kunden, die für die Anfrage gestimmt haben, werden automatisch benachrichtigt.
</cards>

<!-- section: comments-attention -->
## Kommentare & Handlungsbedarf-Posteingang

Unter `/dashboard/[ws]/comments` dient dieser Posteingang als reaktionsschneller Support-Desk für Ihre Feedback-Diskussionen.

### Workflow-Phasen

<stages>
- **Needs Attention (Handlungsbedarf)**: Jeder Kundenkommentar, der noch keine offizielle Antwort vom Team erhalten hat. Mit bernsteinfarbenen Indikatoren hervorgehoben, damit keine Anfrage übersehen wird.
- **Handled (Erledigt)**: Wird automatisch aus der Aufmerksamkeits-Warteschlange entfernt, sobald ein Teammitglied mit einem offiziellen Abzeichen antwortet, oder manuell als erledigt markiert.
</stages>

<!-- section: author-location -->
## Autorenkontakt & Standort-Einblicke

Um Ihrem Team wertvollen Kontext darüber zu geben, wer Feedback einreicht, zeigen die Anfragen- und Kommentarkarten in Ihrem Dashboard Autorendetails an:

- **Direkte Kontaktaufnahme per E-Mail**: Klicken Sie auf den Mail-Button neben dem Namen des Autors, um ihn direkt für Benutzerinterviews oder Rückfragen zu kontaktieren.
- **Geografischer Kontext**: Sehen Sie den ungefähren Standort des Kunden (z. B. `London, United Kingdom [GB]`), um geografische Nutzungsmuster zu verstehen.
- **Datenschutzorientiertes Design**: E-Mail-Adressen und Standorte von Autoren sind ausschließlich für Mitglieder des Workspace-Teams sichtbar und werden niemals auf öffentlichen Portalen angezeigt.

<!-- section: customer-portals -->
## Öffentliche Kundenportale

Jedes Produkt in Ihrem Arbeitsbereich kann ein eigenes öffentliches Portal unter `/[ws]/[product]` haben.

<cards>
- **Modulare Funktionsschalter**: Aktivieren oder deaktivieren Sie Feedback-Board, Roadmap, Changelog oder FAQ unabhängig voneinander pro Produkt.
- **Individuelles Branding & Farben**: Passen Sie Ihr Portal mit Ihrem Logo, Markennamen und einer benutzerdefinierten Akzentfarbe an.
- **Mehrsprachigkeit & RTL**: Unterstützung für 13 Sprachen mit automatischer Besuchererkennung, Sprachauswahl und lokalisierter Inhaltserstellung.
- **Standardsprache ändern**: Bestehende Übersetzungen werden in die Hauptfelder übernommen und der vorherige Text bleibt als Übersetzung erhalten.
- **Benutzerabzeichen**: Zeichnen Sie Kunden mit Abzeichen neben ihren Namen bei Beiträgen und Kommentaren aus. Weisen Sie diese manuell oder über Attributionsregeln zu.
</cards>

<!-- section: roadmap-changelog -->
## Roadmap-Planung & Release-Notes

<cards>
- **Interaktive Roadmap**: Organisieren Sie die Funktionsentwicklung in visuellen Spalten (z. B. In Prüfung, Geplant, In Entwicklung). Verknüpfen Sie Feedback direkt mit Roadmap-Karten.
- **Changelog & Release-Ankündigungen**: Veröffentlichen Sie nach Kategorien geordnete Versionshinweise (Neue Funktion, Verbesserung, Fehlerbehebung). Schließen Sie automatisch den Kreis zu Kunden.
</cards>

<!-- section: faq-system -->
## Self-Service FAQ Wissensdatenbank

Fügen Sie häufig gestellte Fragen in thematischen Kategorien auf Ihrem Produktportal hinzu. Direkte Antworten reduzieren doppelte Feature-Einsendungen und Support-Tickets.

<!-- section: themes-push -->
## Designs & Web-Push-Benachrichtigungen

UserHQ bietet vier Designs: **System**, **Hell**, **Dunkel** (Tiefes Marineblau) und **Anthrazit** (neutrales Fast-Schwarz). Teammitglieder können in `/account` Web-Push-Benachrichtigungen aktivieren.

<!-- section: api-overview -->
## Automatisierungs-API & Authentifizierung

Verbinden Sie externe Systeme, CI/CD-Pipelines, Slack, Discord, Linear, GitHub oder interne Dashboards über die UserHQ REST-Automatisierungs-API.

### Authentifizierungs-Header

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Rate Limits**: Großzügiges Kontingent von 120 Anfragen pro Minute pro API-Schlüssel mit automatischer Token-Bucket-Drosselung.
- **Berechtigungsumfang**: Schlüssel können auf bestimmte Produkte beschränkt und mit Lese-/Schreibberechtigungen für bestimmte Ressourcen versehen werden.
</cards>

<!-- section: swagger-explorer -->
## Interaktiver API-Explorer

Testen Sie Endpunkte, untersuchen Sie Parameter, prüfen Sie Anfrage-/Antwort-Schemas und generieren Sie sofort Code-Snippets in cURL, TypeScript und Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks & HMAC-Signaturverifizierung

UserHQ sendet HTTP-POST-Ereignisse in Echtzeit, wenn Anfragen erstellt werden, Statusänderungen auftreten oder Kommentare eingehen. Jede Übertragung enthält eine sichere HMAC-SHA256-Signatur im Header `x-userhq-signature`.

### Node.js / Express HMAC-Verifizierungsbeispiel

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
