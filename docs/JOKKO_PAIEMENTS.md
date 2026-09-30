# Jokko — paiements, PayDunya et mise en production

## 1. Mode test (par défaut)

Sans aucune configuration, Jokko fonctionne en **mode test** : le fournisseur `simulated` remplace l'agrégateur. Après avoir cliqué sur « Soutenir », le fan arrive sur `/pay/sim/<ref>`, clairement marqué *Simulateur — mode test*, avec trois boutons : valider, simuler un échec, annuler. La validation passe par **exactement le même circuit** qu'un vrai paiement (notification signée → confirmation → alerte → jauge → rang).

Le tableau de bord affiche le badge **MODE TEST** et aucun argent réel ne circule.

## 2. Brancher PayDunya (sandbox)

1. Crée un compte marchand sur PayDunya, puis une application (menu *Intégrer notre API*). Récupère la **clé principale**, la **clé privée** et le **token** de test.
2. Copie `.env.example` en `.env` (ce fichier n'est jamais versionné) et complète :

   ```ini
   JOKKO_PAYMENT_PROVIDER=paydunya
   PAYDUNYA_MODE=test
   PAYDUNYA_MASTER_KEY=...
   PAYDUNYA_PRIVATE_KEY=...
   PAYDUNYA_TOKEN=...
   JOKKO_PUBLIC_URL=https://ton-tunnel.example
   ```

3. PayDunya doit pouvoir joindre ton webhook `JOKKO_PUBLIC_URL/api/webhooks/paydunya`. En local, expose `npm run dev` avec un tunnel HTTPS (cloudflared, ngrok…) et mets son URL dans `JOKKO_PUBLIC_URL`.
4. Relance `npm run dev`. La console affiche `Jokko : paiements paydunya (mode test)`.
5. Fais un paiement depuis ta page de soutien : tu es redirigé vers la page PayDunya sandbox, restreinte au moyen choisi (`wave-senegal`, `orange-money-senegal` ou `free-money-senegal`).

### Ce que fait l'intégration

| Étape | Appel |
|---|---|
| Création | `POST https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create` (en-têtes `PAYDUNYA-MASTER-KEY`, `PAYDUNYA-PRIVATE-KEY`, `PAYDUNYA-TOKEN`) |
| Notification (IPN) | PayDunya → `POST /api/webhooks/paydunya` (form-encoded `data[...]`) ; `data[hash]` doit valoir SHA-512 de la clé principale |
| Vérification | `GET .../checkout-invoice/confirm/<token>` : le statut **et** le montant sont re-vérifiés avant tout crédit |
| Secours | si l'IPN tarde, la page du fan déclenche la même vérification (au plus toutes les 3 s) |

Une notification rejouée ne crédite jamais deux fois et ne rejoue pas l'alerte. Un montant différent de celui attendu fait échouer le paiement.

> **À valider en sandbox avant la production** : le nom exact du champ de restriction de canaux (`channels`) et les identifiants de canaux dans ton compte PayDunya. Si PayDunya ignore la restriction, le fan voit simplement tous les moyens de paiement : rien ne casse.

## 3. Commissions et offres

| Variable | Défaut | Rôle |
|---|---|---|
| `JOKKO_COMMISSION_FREE` | `0.10` | commission sur l'offre Gratuite (frais d'agrégateur de 1,5 à 3,5 % inclus) |
| `JOKKO_COMMISSION_PRO` | `0.05` | commission réduite de l'offre Pro |
| `JOKKO_MIN_AMOUNT` / `JOKKO_MAX_AMOUNT` | `200` / `500000` | bornes d'un don (F CFA) |
| `JOKKO_MIN_WITHDRAWAL` | `1000` | retrait minimum |

La commission est calculée et figée à la création du paiement. Passer un streamer en Pro (débloque les 5 thèmes) :

```bash
curl -X POST "$JOKKO_PUBLIC_URL/api/admin/streamers/<slug>/plan" \
  -H "Authorization: Bearer $JOKKO_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"plan":"pro"}'
```

## 4. Retraits

Le streamer enregistre son **numéro Wave** puis demande un retrait depuis le tableau de bord. Le montant est immédiatement réservé sur son solde. Le traitement est manuel dans le MVP :

```bash
# Lister les demandes en attente
curl "$JOKKO_PUBLIC_URL/api/admin/withdrawals?status=pending" -H "Authorization: Bearer $JOKKO_ADMIN_TOKEN"

# Après le virement Wave : marquer comme versé (ou "rejected" pour libérer le solde)
curl -X POST "$JOKKO_PUBLIC_URL/api/admin/withdrawals/<id>" \
  -H "Authorization: Bearer $JOKKO_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"paid","note":"Wave réf. XXXX"}'
```

`JOKKO_ADMIN_TOKEN` doit faire au moins 16 caractères ; sans lui, l'API d'administration est désactivée.

## 5. Mise en production

```bash
npm ci
npm run build
npm start          # PORT=8080 par défaut
```

Liste de contrôle :

- [ ] `JOKKO_PUBLIC_URL` en **HTTPS** (active aussi le cookie `Secure`).
- [ ] `JOKKO_SECRET` défini (≥ 16 caractères) **et sauvegardé** : il sert aux identifiants de fans (rangs). Le changer réinitialise la correspondance des rangs.
- [ ] `JOKKO_ADMIN_TOKEN` long et aléatoire.
- [ ] `JOKKO_TRUST_PROXY=1` si un reverse proxy (nginx, Render, Railway…) est devant le serveur.
- [ ] `JOKKO_LOCAL_BRIDGE` laissé à sa valeur par défaut (désactivé en production).
- [ ] Le dossier `data/` est sur un disque persistant et **sauvegardé** (il contient comptes et paiements). Un seul processus serveur.
- [ ] Webhook PayDunya testé en sandbox de bout en bout, puis `PAYDUNYA_MODE=live` avec les clés de production.
- [ ] Un second agrégateur de secours est identifié avant l'ouverture publique (risque de dépendance).

> **Point non négociable du cahier des charges** : le statut juridique de l'entreprise et les obligations fiscales doivent être confirmés avec l'agrégateur choisi et, idéalement, un conseil local **avant** que le premier vrai paiement circule. Cette documentation n'est pas un conseil juridique ou comptable.

## 6. Ajouter un autre agrégateur (CinetPay, Hub2…)

Implémente l'interface `PaymentProvider` (`server/payments/provider.ts`) : `createCheckout`, `parseWebhook` (retourne `null` si la notification n'est pas authentique), `checkStatus`. Puis sélectionne-la dans `createProvider` (`server/app.ts`). Le service de paiement, les alertes, les rangs et le tableau de bord n'ont pas à changer. Ajoute les tests correspondants dans `server/test/`.
