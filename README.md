# Le coffre mystère Wave

Un seul site pour le Salon de l’Épargne : le mini-jeu de basket, les trois parcours QR, la page « Pas de chance » et le clavier du coffre.

## Où en est le projet ?

- Le jeu se présente verticalement, avec le pingouin de dos face au panier : 5 paniers en 60 secondes.
- Sans Cloudflare configuré, le jeu affiche clairement « Mode entraînement » et ne révèle aucun indice.
- Le clavier du coffre fonctionne sans Cloudflare, vérifie au sixième chiffre, puis lance animation et son activable.
- Le mode hors connexion concerne uniquement le clavier. Attendre le message « Hors connexion prêt », puis tester en mode avion sur le téléphone du salon. Un navigateur peut vider ses données : refaire le test avant l’événement.
- Les écrans d’indices, « Pas de chance » et le clavier utilisent le fichier original du pingouin Wave fourni par l’utilisateur, sans retouche ni déformation. Les PNG historiques de mise en page ne sont pas inclus, car ils doivent être fournis à nouveau.
- Le pingouin de dos du jeu est une adaptation de cette référence, et non une vue officielle fournie. Le terrain reste dessiné par le jeu.

## Visuels du pingouin

- `assets/pingouin-wave-original.png` : copie exacte du fichier utilisateur, fond bleu compris.
- `assets/pingouin-wave-dos.png` : adaptation vue de dos sur fond transparent, créée avec l’outil de génération d’images intégré. Consigne : silhouette noire simple, pied orange en demi-cercle, nageoire levée à droite, aucun visage ni ventre blanc, sans décor, dans le style de la référence.
- Les proportions des deux fichiers sont conservées à l’affichage. La vue de dos est une interprétation, sa fidélité à une vue officielle de dos ne peut pas être garantie.

## Étape 1 · Activer le site

Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → main → /(root) → Save**.

La page Pages donnera l’adresse exacte du site. Le nom actuel du dépôt est `Wave-coffre-mystere.` (point final inclus). Si tu renommes le dépôt, les anciens QR codes ne suivront pas forcément : générer les QR définitifs seulement après avoir validé le nom et le site.

## Les pages

Ajouter ces chemins à l’adresse du site :

| Chemin | Usage |
| --- | --- |
| `jeu/?id=A` | Défi associé au premier parcours |
| `jeu/?id=B` | Défi associé au deuxième parcours |
| `jeu/?id=C` | Défi associé au troisième parcours |
| `pas-de-chance/` | Page sans mini-jeu et sans indice |
| `coffre/` | Clavier près du coffre |

Ne pas imprimer les QR avant d’avoir testé ces adresses sur un téléphone.

## Étape 2 · Activer les indices protégés

Le service est préparé dans `cloudflare/`, mais il doit encore être déployé dans ton compte Cloudflare. On fera cette étape ensemble ; ne publie pas tes réponses dans un fichier GitHub.

Le guide détaillé pour l’accompagnement se trouve dans [cloudflare/INSTALLATION.md](cloudflare/INSTALLATION.md).

## Téléphone du coffre

1. Ouvrir `coffre/` sur iPhone ou Android avec Internet.
2. Toucher « Activer le son » ; vérifier volume et mode silencieux.
3. Attendre « Hors connexion prêt ».
4. Tester en mode avion : recharger la page puis saisir une combinaison.
5. L’équipe ouvre le coffre à la main. Le bouton « Équipe · Nouvelle tentative » prépare le prochain essai.

Le verrouillage est local à ce téléphone, pas un verrouillage global de l’événement.

## Protection et limites

Les indices sont conservés dans les secrets Cloudflare, et le serveur compte les tirs avec un délai minimal et une limite de 60 secondes. Un joueur ne peut pas simplement envoyer « score : 5 ». La visée peut toutefois être automatisée et les références A/B/C sont modifiables : ce système vise une protection légère, pas une compétition anti-triche.

Le clavier est volontairement autonome. L’empreinte de la combinaison évite une lecture immédiate du code, mais elle peut être testée par recherche exhaustive. Utiliser l’appareil surveillé par l’équipe. L’animation n’actionne aucune serrure physique.

## Vérification technique

Pas de dépendance pour le site. Servir les fichiers par HTTP en développement et HTTPS en production. Les tests du service sont exécutables avec `node --test tests/service.test.mjs`. Pour tester aussi le clavier, définir la variable locale `WAVE_TEST_CODE` avec la combinaison attendue, puis exécuter `node --test tests/*.test.mjs`. Ne jamais enregistrer cette variable dans un fichier suivi par Git.

Références : [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/), [Secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).
