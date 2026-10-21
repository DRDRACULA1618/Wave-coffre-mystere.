# Le coffre mystère Wave

Un seul site pour le Salon de l’Épargne : le mini-jeu de basket, les trois parcours QR, la page « Pas de chance » et le clavier du coffre.

## Où en est le projet ?

- Le jeu se présente verticalement, avec le pingouin de dos face au panier : 13 paniers en 15 secondes.
- Sans Cloudflare configuré, le jeu affiche clairement « Mode entraînement » et ne révèle aucun indice.
- Le clavier du coffre fonctionne sans Cloudflare, vérifie au sixième chiffre, puis lance animation et son activable. Deux combinaisons incorrectes bloquent le clavier ; l’équipe peut réinitialiser les essais.
- Le ballon est tenu dans la nageoire droite du pingouin vu de dos. Les tirs et paniers ont des bruitages légers, activés par défaut au premier appui sur « Commencer » si le navigateur le permet ; le bouton de son permet de les couper.
- Le mode hors connexion concerne uniquement le clavier. Après un premier chargement complet, tester en mode avion sur le téléphone du salon. Un navigateur peut vider ses données : refaire le test avant l’événement.
- Les écrans d’indices, « Pas de chance » et le clavier utilisent le fichier original du pingouin Wave fourni par l’utilisateur, sans retouche ni déformation. Les PNG historiques de mise en page ne sont pas inclus, car ils doivent être fournis à nouveau.
- Le pingouin de dos du jeu est une adaptation de cette référence, et non une vue officielle fournie. Le terrain reste dessiné par le jeu. Sa taille s’adapte à la hauteur disponible pour garder la jauge, « Tirer » et le son visibles sans défilement, y compris dans les navigateurs intégrés.

## Visuels du pingouin

- `assets/pingouin-wave-original.png` : copie exacte du dernier PNG transparent fourni par l’utilisateur.
- `assets/pingouin-wave-original.svg` : cadre SVG qui incorpore ce PNG sans modifier ses pixels et utilise une fenêtre ajustée à la zone visible ; les grandes marges transparentes ne réduisent donc pas la taille du personnage à l’écran.
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
3. Laisser la page se charger complètement pendant quelques secondes pour préparer les ressources hors connexion.
4. Tester en mode avion : recharger la page puis saisir une combinaison.
5. L’équipe ouvre le coffre à la main. Le bouton « Équipe · Nouvelle tentative » prépare le prochain essai.

Chaque participant dispose de deux combinaisons complètes. Après deux erreurs, le clavier se bloque. Le compteur et la victoire restent enregistrés sur ce navigateur après rechargement. L’équipe peut remettre deux essais à disposition avec le bouton de réinitialisation. Effacer les données du navigateur supprime ce compteur local. Le verrouillage est local à ce téléphone, pas un verrouillage global de l’événement.

## Protection et limites

Les indices sont conservés dans les secrets Cloudflare, et le serveur compte les tirs avec un délai minimal et une limite de 15, 13 ou 11 secondes selon le jeu. Un joueur ne peut pas simplement envoyer « score : 13 ». Les appuis peuvent être automatisés : ce système vise une protection légère pour une animation, pas une compétition anti-triche.

Le clavier est volontairement autonome. L’empreinte de la combinaison évite une lecture immédiate du code, mais elle peut être testée par recherche exhaustive. Utiliser l’appareil surveillé par l’équipe. L’animation n’actionne aucune serrure physique.

## Vérification technique

Pas de dépendance pour le site. Servir les fichiers par HTTP en développement et HTTPS en production. Les tests du service sont exécutables avec `node --test tests/service.test.mjs`. Pour tester aussi le clavier, définir la variable locale `WAVE_TEST_CODE` avec la combinaison attendue, puis exécuter `node --test tests/*.test.mjs`. Ne jamais enregistrer cette variable dans un fichier suivi par Git.

Références : [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/get-started/), [Secrets Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

## Affichage mobile du coffre

Le clavier et la victoire utilisent la hauteur dynamique du navigateur (Safari et Android), avec une disposition compacte sur petits écrans. L’en-tête affiche uniquement « LE COFFRE MYSTÈRE ». Le cache hors connexion reste actif sans mention technique affichée. Les confettis sont dessinés immédiatement pendant seize secondes ; le réglage de réduction des animations conserve une décoration fixe.

## Difficulté du défi

L’objectif reste 13 paniers. Le temps diminue : jeu 1 / A = 15 secondes, jeu 2 / B = 13 secondes, jeu 3 / C = 11 secondes. Cloudflare impose la durée de la session et le client affiche cette valeur avant le démarrage. Les parties déjà créées avant cette mise à jour conservent leurs 15 secondes. Chaque tir accepté compte désormais comme un panier, sans précision de visée ni timing à respecter. Le bouton Tirer se réactive après une animation de 160 ms ; le délai local minimal est de 180 ms et le serveur impose un minimum de 150 ms. La jauge de visée est masquée et les consignes invitent simplement à appuyer sur Tirer. Le score reste vérifié par Cloudflare, avec un seul panier par tir, et aucun indice avant 13 paniers.

Le jeu utilise la hauteur et la largeur de `visualViewport` quand elles sont disponibles ; le terrain se réduit pour conserver la jauge, le bouton Tirer et le son à l’écran. Les confettis sont plus denses (240 éléments) et visibles 16 secondes.

## Logo Wave

Toutes les pages utilisent le fichier de logo fourni par l’utilisateur, pingouin et mot Wave réunis. `assets/logo-wave.png` est une copie exacte de ce fichier ; `assets/logo-wave.svg` l’incorpore sans retouche, avec un cadrage qui retire uniquement les marges transparentes à l’affichage. Les proportions et couleurs d’origine sont conservées. Le logo est également mis en cache avec le clavier hors connexion.


## Liens neutres et compatibilité

Les quatre QR utilisent désormais des chemins `/s/<identifiant>/` de même longueur. Ces quatre pages HTML sont identiques : aucun chiffre, ordre d’indice ou résultat propre au QR n’est écrit dans leur URL ou dans leur HTML. La résolution `/resolve` et la création `/session` se font en POST auprès de Cloudflare. Le service choisit la référence en fonction du jeton ; une référence fournie en même temps ne peut pas la modifier. Cette présentation évite les spoilers dans la barre d’adresse, sans transformer les liens publics en secrets.

Les anciens `/jeu/?id=A`, `B`, `C` et `/pas-de-chance/` restent présents et demandent au serveur leur adresse neutre, puis utilisent `location.replace` pour ne pas conserver une étape supplémentaire dans l’historique. L’accueil et `/coffre/` restent disponibles. Ne pas supprimer les anciens chemins : des QR peuvent déjà être imprimés.


## Consignes de la chasse

La page sans indice affiche en grand « Pas de chance cette fois ! » puis « Scanne le prochain QR code ! ». Après une victoire, l’indice et la consigne « Fais une capture d’écran de cet indice. Puis scanne le prochain QR code. » sont agrandis. Les statistiques du jeu disparaissent à la victoire pour laisser la place à la consigne sur mobile. Les affiches invitent à scanner avec l’appareil photo pour tenter de remporter la cagnotte mystère.

## Suivi des trois indices

Les quatre pages rappellent « Code à 6 chiffres » et « 3 indices de 2 chiffres ». Un indice n’est enregistré qu’après réception réussie de la récompense du serveur. Chaque position (gauche, centre, droite) n’est comptée qu’une seule fois. Le navigateur mémorise uniquement les positions obtenues, sans les chiffres, sous `wave-hunt-found-v1`. La page sans indice et les parties d’entraînement ne font pas avancer le compteur. À 3/3, le message de victoire et la page sans indice invitent à rejoindre le coffre. Le suivi reste propre au navigateur et n’est pas synchronisé entre appareils ou navigateurs. Si le stockage est bloqué, le jeu continue et le compteur fonctionne pour la page ouverte.
