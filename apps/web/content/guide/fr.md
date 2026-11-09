<!-- section: overview -->
## Aperçu & Structure

UserHQ aide votre équipe à recueillir les avis de vos clients et à agir en conséquence. Voici comment s'organise votre espace de travail :

<cards>
- **1. Workspace (Espace de travail)** : Le centre de contrôle de votre équipe. Il regroupe vos collaborateurs, la facturation, les clés API, les webhooks et la boîte de réception unifiée de retours pour tous vos produits.
- **2. Products (Produits)** : Les applications ou services individuels que vous développez (ex. Application Web, Application iOS, API). Chaque produit dispose de son propre tableau de retours, d'une feuille de route, d'un changelog, de catégories et d'une identité visuelle propre.
- **3. Customer Portals (Portails clients)** : Le portail personnalisé que vos utilisateurs consultent pour proposer des idées, voter pour des fonctionnalités, suivre votre feuille de route publique et lire les annonces de versions.
</cards>

<!-- section: roles-permissions -->
## Rôles & Permissions d'équipe

Collaborez facilement avec toute votre équipe tout en conservant un contrôle absolu sur les paramètres de l'espace de travail :

<cards>
- **Workspace Owner (Propriétaire)** : Contrôle total : gestion des abonnements, invitation d'administrateurs, création de clés API, configuration des webhooks et transfert de propriété.
- **Workspace Admin (Administrateur)** : Peut gérer les produits, trier les retours, répondre officiellement aux clients, gérer les cartes de la feuille de route et publier des notes de version.
- **Workspace Member (Membre)** : Peut consulter les suggestions, participer aux discussions internes de l'équipe et suivre les demandes des clients.
</cards>

<!-- section: requests-inbox -->
## Demandes & Triage

Située à l'adresse `/dashboard/[ws]/requests`, la boîte de réception unifiée rassemble toutes les contributions des clients de chaque produit dans une vue de triage optimisée.

<cards>
- **Filtrage multidimensionnel** : Filtrez instantanément par produit, phase d'avancement (Backlog, En cours, Terminé), catégorie, recherche textuelle et plages de dates.
- **Mises à jour rapides d'état** : Déplacez les éléments d'une phase à l'autre (À l'étude, Planifié, En développement, Terminé) en un clic. Les clients ayant voté pour la demande sont avertis automatiquement.
</cards>

<!-- section: comments-attention -->
## Commentaires & Boîte d'attention requise

Située à `/dashboard/[ws]/comments`, cette boîte de réception fonctionne comme un centre de support réactif pour toutes vos discussions.

### Étapes du flux de travail

<stages>
- **Needs Attention (Attention requise)** : Tout commentaire client n'ayant pas encore reçu de réponse officielle de l'équipe. Mis en avant par des indicateurs ambrés pour qu'aucune question ne soit négligée.
- **Handled (Traité)** : Retiré automatiquement de la file d'attente dès qu'un membre de l'équipe publie une réponse officielle, ou marqué manuellement comme traité.
</stages>

<!-- section: author-location -->
## Contact auteur & Localisation géographique

Pour offrir à votre équipe un contexte précieux sur les personnes soumettant des retours, les cartes de demandes et de commentaires affichent des détails utiles :

- **Prise de contact directe par email** : Cliquez sur le bouton email à côté du nom de l'auteur pour le contacter directement pour des entretiens utilisateurs ou des précisions.
- **Contexte géographique** : Consultez la localisation approximative du client (ex. `London, United Kingdom [GB]`) pour comprendre les tendances d'usage régional.
- **Confidentialité dès la conception** : Les adresses email et coordonnées géographiques sont réservées aux membres de l'équipe et ne sont jamais visibles sur les portails publics.

<!-- section: customer-portals -->
## Portails clients publics

Chaque produit de votre espace de travail peut disposer de son propre portail public sur `/[ws]/[product]`.

<cards>
- **Modules de fonctionnalités activables** : Activez ou désactivez de manière indépendante le tableau d'idées, la feuille de route, le changelog ou la FAQ par produit.
- **Image de marque & Couleurs personnalisées** : Personnalisez votre portail avec votre logo, votre nom de marque et une couleur d'accentuation sur mesure.
- **Support multilingue & RTL** : Prise en charge de 13 langues avec détection automatique du visiteur, sélecteur de langue et rédaction de contenu traduit.
- **Changement de langue par défaut** : Les traductions existantes sont promues dans les champs principaux et le texte précédent est conservé comme traduction.
- **Badges utilisateurs** : Valorisez les clients avec des badges à côté de leur nom, attribués manuellement ou via des règles d'attribution automatique.
</cards>

<!-- section: roadmap-changelog -->
## Feuille de route & Notes de version

<cards>
- **Feuille de route interactive** : Organisez les fonctionnalités en colonnes visuelles (ex. À l'étude, Planifié, En cours). Liez directement les retours des clients aux cartes.
- **Changelog & Annonces de versions** : Publiez des notes de version catégorisées (Nouvelle fonctionnalité, Amélioration, Correctif de bug). Informez immédiatement les utilisateurs demandeurs.
</cards>

<!-- section: faq-system -->
## Base de connaissances FAQ en libre-service

Ajoutez des questions fréquentes organisées en catégories sur votre portail produit. Offrir des réponses immédiates réduit les soumissions en double et désengorge votre support.

<!-- section: themes-push -->
## Thèmes & Notifications Web Push

UserHQ propose quatre thèmes : **Système**, **Clair**, **Sombre** (bleu marine profond) et **Anthracite** (proche du noir neutre). Les membres de l'équipe peuvent activer les alertes Web Push dans `/account`.

<!-- section: api-overview -->
## API d'automatisation & Authentification

Connectez vos outils externes, vos pipelines CI/CD, Slack, Discord, Linear, GitHub ou vos tableaux de bord internes avec l'API REST UserHQ.

### En-tête d'authentification

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Limites de requêtes** : Limite généreuse de 120 requêtes par minute par clé API avec régulation automatique par token-bucket.
- **Permissions ciblées** : Les clés peuvent être limitées à des produits particuliers et dotées de droits de lecture/écriture sélectifs.
</cards>

<!-- section: swagger-explorer -->
## Explorateur d'API interactif

Testez les endpoints, explorez les paramètres, inspectez les schémas de requête et réponse, et générez des exemples de code cURL, TypeScript et Python en un clic.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhooks & Vérification de signature HMAC

UserHQ diffuse des événements HTTP POST en temps réel lors de la création de demandes, changements d'état ou publication de commentaires. Chaque envoi contient une signature sécurisée HMAC-SHA256 dans l'en-tête `x-userhq-signature`.

### Exemple de vérification HMAC en Node.js / Express

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
