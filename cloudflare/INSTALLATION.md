# Activation du service d’indices

Ce guide sert à l’accompagnement. Le site et le clavier n’exigent aucune installation logicielle pour les visiteurs. Le service doit encore être déployé ; le dépôt seul ne l’active pas.

## Chemin conseillé avec accompagnement

1. Dans Cloudflare, ouvrir Workers & Pages, puis créer une application à partir du dépôt GitHub existant.
2. Sélectionner ce dépôt et le dossier racine `cloudflare` pour que Cloudflare utilise son `package.json` et sa configuration Wrangler.
3. L’installation utilise `npm install` et le déploiement `npx wrangler deploy`. Aucun build du site n’est requis.
4. Vérifier que la liaison `SESSIONS` et la migration SQLite `GameSession` sont détectées dans `wrangler.jsonc`. Si l’interface diffère ou demande un abonnement, arrêter et demander un accompagnement plutôt que payer.
5. Dans les paramètres du Worker, ajouter un secret nommé `REWARDS_JSON`. Sa valeur est un objet JSON avec les trois références A, B, C et leurs réponses à deux chiffres, toutes sous forme de texte. Les vraies réponses doivent être saisies uniquement dans Cloudflare, jamais dans GitHub. Exemple de forme, avec valeurs fictives : `{"A":"01","B":"02","C":"03"}`.
6. Vérifier `ALLOWED_ORIGIN` : l’origine GitHub Pages sans chemin et sans barre finale. La valeur préparée est `https://drdracula1618.github.io`.
7. Déployer à nouveau si Cloudflare le demande après l’ajout du secret.
8. Copier l’adresse HTTPS du Worker, puis remplacer la valeur vide `apiUrl` dans le fichier `config.js` à la racine du dépôt. Ne jamais y mettre les réponses.
9. Tester les trois parcours sur un vrai téléphone : victoire, échec, réseau interrompu et affichage de l’indice. La latence du réseau peut influencer la visée, car le serveur évalue le tir à sa réception.

Les intitulés exacts du tableau de bord peuvent évoluer. Le service utilise des Durable Objects SQLite et n’exige pas de domaine personnalisé. Vérifier les quotas du compte avant l’événement ; aucune promesse de gratuité illimitée n’est faite.

## Alternative pour la personne qui accompagne

Avec Node.js installé, dans le dossier `cloudflare/` :

```sh
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put REWARDS_JSON
```

Saisir le JSON privé à la demande de Wrangler, puis renseigner uniquement l’URL publique du Worker dans `config.js`.

## Contrôles du service

- Une session est liée à une référence validée A, B ou C.
- Le score et le chronomètre sont gérés dans une session Durable Object.
- Les requêtes de tir dupliquées ne comptent pas deux fois.
- Les tirs sont espacés d’au moins 1,1 seconde.
- Un indice n’est renvoyé qu’après cinq paniers enregistrés par le serveur.
- La session est effacée après dix minutes, les compteurs réseau après une heure.
- La limite de création est 600 sessions par heure par adresse réseau pour permettre une connexion partagée au salon. Elle ne protège pas contre une attaque distribuée.
- Aucun suivi des personnes, formulaire d’inscription ou classement n’est ajouté.
