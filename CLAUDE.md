# Lucarne — jeu foot de la semaine entre potes

Appli web d'une seule page pour jouer avec des amis toute la semaine, **sans compte** : hébergée sur Vercel (dépôt GitHub `guillaumeaspro/lucarne`, déploiement automatique depuis `main`). Une ancienne version tourne aussi comme artifact claude.ai (slug `89614fe2-9905-418f-a2de-f2b64ce6dfc6`), utile pour tester. Un jeu différent chaque jour, mêmes défis pour tout le monde, classement hebdomadaire commun.

## Programme (heure de Paris)
| Jour | Jeu | Principe | Points max |
|---|---|---|---|
| Lun | 🧭 Parcours | 5 joueurs (3 classiques + 2 « aguerris ») à trouver d'après leurs clubs, saisie libre avec tolérance aux fautes | 1500 |
| Mar | 🕵️ L'Imposteur | 5 manches : qui n'a jamais joué dans ce club ? (20 s) | 1500 |
| Mer | 🔎 Joueur mystère | Nationalité, poste et date de naissance d'emblée, puis 6 indices progressifs ; saisie libre | 1500 |
| Jeu | 📋 Top liste | Compléter une liste fermée, 3 vies | 1500 |
| Ven | 🟩 Le Onze manquant | Retrouver la compo d'un match mythique, 3 vies | 1500 |
| Sam | ⚖️ Plus ou moins | Duels de stats, série jusqu'à la 1re erreur (15 max) | 1500 |
| Dim | ❓ Quiz | 10 QCM chronométrés | 1500 |

Chaque jeu ouvre à **7h (heure de Paris)** et reste le jeu du jour jusqu'à 7h le lendemain (`todayStr`, `openAt`). Après une partie, un teaser du jeu suivant s'affiche avec un compte à rebours. Un essai par jour ; les jours manqués de la semaine en cours peuvent être rattrapés.

## Navigation (simplifiée)
Barre en bas avec 3 onglets (`S.tab`) :
- **Jouer** (`homeJouer`) : volontairement épuré. Une seule grosse carte (feuille aimantée) avec le jeu du jour et « Jouer » ; une fois joué : score, « Revoir ma partie », prochain jeu + compte à rebours hh:mm:ss. Dessous : un lien « X jeux à rattraper › » s'il y en a, puis une ligne avec 7 pastilles (L M M J V S D, cliquables) + total de la semaine + rang (mène au classement). Rien d'autre : l'install/notifs est dans Infos (pastille rouge sur l'onglet s'il manque quelque chose).
- **Classement** (`homeClassement`) : Semaine / Général / Aujourd'hui, récap de la semaine passée sur le terrain, ardoise des Ricard, palmarès.
- **Infos** (`homeInfos`) : profil (pseudo, code joueur), appli et notifs, programme, règles, mode test organisateur.
Principe : une seule chose importante par écran, pas d'information répétée.

## Classement (`league()`)
- **Général cumulé**, jamais remis à zéro, avec le détail des points de chaque semaine.
- **Ricard 🥃** : à la fin de chaque semaine, le(s) dernier(s) doit(vent) un Ricard à chacun des autres participants. Participants d'une semaine = joueurs ayant joué cette semaine-là ou la précédente (un absent compte 0). Égalité générale = personne ne paie.
- **Inactifs** : 2 semaines sans jouer (semaine en cours + précédente) = retiré de l'affichage ; une partie suffit pour revenir. Les données ne sont pas supprimées.
- Onglets : Général / Semaine / Aujourd'hui, + palmarès des vainqueurs de chaque semaine.

## Structure
- `source/` : `style.css`, `questions.js` (banque du quiz `Q`), `data.js` (joueurs `P`, couleurs des clubs, banques des jeux), `app.js` (logique commune), `backend_web.js` (site Vercel), `backend_claude.js` (artifact).
- `source/launcher.html` : page publiée dans l'artifact claude.ai épinglé (slug `89614fe2-…`), qui renvoie vers le site.
- `python3 source/build.py` génère `index.html` (le site, à la racine) et `source/artifact.html` (version artifact). Ne jamais modifier `index.html` à la main.
- Rotation : chaque banque est mélangée une fois puis avance d'un cran par semaine ISO (`weekSlice`).
- Variété : dans l'Imposteur, chaque joueur n'est l'imposteur qu'une seule fois dans la banque, et les manches sont regroupées par semaine sans qu'un même nom revienne deux fois (`imposteurWeeks`). Au Plus ou moins, un joueur ou club n'apparaît qu'une fois par jour (`pmRounds`). Vérifier ces règles après tout ajout de contenu.
- Tout joueur cité dans `PARCOURS` doit exister dans `P`. Réponses en saisie libre : alias séparés par `|`, tolérance Levenshtein 1 (≥ 5 lettres) ou 2 (≥ 8 lettres).
- Style « Tableau tactique » : ardoise #2A3735 dans un cadre bois #6E4B2E, craie #ECEAE2, craie jaune #F4E3A1 (accent), corail #F2A38C (erreurs, lanterne rouge), aimant #D6453A. Polices : Permanent Marker (titres), Gochi Hand (écriture craie), Inter (chiffres, boutons). Jeu du jour = feuille de papier aimantée ; compte à rebours en panneau de score ; récap du lundi dessiné sur un terrain (1er en attaque, dernier dans les cages). Maquettes de référence : artifact « Lucarne — pistes de design » (B2, B3, écran de jeu).
- Écussons : génériques (bouclier aux couleurs du club + sigle), **jamais les logos officiels** ; pas de photos de joueurs.
- Contenu : uniquement des faits stables. Éviter « club actuel » et records en cours.

## Données (site Vercel)
- `api/state.js` (fonction Vercel) : `GET /api/state` renvoie toutes les fiches ; `POST` enregistre la fiche d'un joueur (`{id, secret, doc}`), refusée si le secret ne correspond pas (empreinte sha256 stockée).
- Stockage : un seul fichier `lucarne/state.json` dans Vercel Blob (variable `BLOB_READ_WRITE_TOKEN`, fournie par Vercel quand le stockage est relié au projet).
- Côté joueur : identifiant + secret dans le navigateur (`localStorage`), sa fiche locale fait foi et se renvoie toute seule si le serveur est en retard. On n'envoie au serveur que les parties terminées et le pseudo (économise les opérations Blob du plan gratuit).
- « Mon code joueur » permet de récupérer son profil sur un autre appareil.
- Mode test organisateur : ouvrir une fois le site avec `#orga` à la fin du lien.
- Pas de compte : n'importe qui ayant le lien peut jouer sous le pseudo de son choix.


## Appli installable et notifications
- PWA : `manifest.webmanifest`, `icons/` (icône originale : cage + ballon dans la lucarne), `sw.js` (réception des notifications, page dispo hors connexion). Balises ajoutées par `source/build.py` pour la version site seulement.
- Carte « 📲 L'appli Lucarne » sur l'accueil : installation (bouton Android / consignes iPhone : Partager → Sur l'écran d'accueil) puis « Activer les notifications ». Sur iPhone, les notifs ne marchent qu'une fois l'appli installée.
- `api/push.js` : GET clé publique, POST abonnement (lié au joueur), DELETE désabonnement.
- Clés de notification (VAPID), abonnements et envois déjà faits : fichier privé `lucarne/private/…` à adresse aléatoire dans Vercel Blob (retrouvé par le serveur via `list`). Les clés sont générées automatiquement au premier usage, aucune variable à saisir.
- `api/cron.js` : planifié tous les jours à 6h05 UTC dans `vercel.json` (7h05 l'hiver, 8h05 l'été ; Vercel gratuit peut décaler dans l'heure). Envoie « Nouveau jeu dispo », et le lundi le récap de la semaine écoulée s'il n'est pas déjà parti. Un envoi par jour maximum.
- Récap anticipé : dès que tous les joueurs actifs (≥ 2) ont fini les 7 jeux, `api/state.js` envoie le récap tout de suite (une fois par semaine).
- Carte « 📊 Récap de la semaine » sur l'accueil (dernière semaine terminée) ; les notifs du récap ouvrent `/#recap`.

## Publication
- Modifier `source/`, lancer `python3 source/build.py`, puis commit + push sur `main` : Vercel redéploie tout seul.
- C'est Claude qui fait la mise en ligne : l'utilisateur ne veut rien avoir à faire à la main.
- Je ne suis pas développeur : explique les changements en langage clair.

## Contenu disponible (sans répétition)
| Jeu | Banque | Semaines |
|---|---|---|
| Parcours | 36 classiques (3/sem.) + 24 aguerris (2/sem.) | 12 |
| Imposteur | 60 manches (5/sem.) | 12 |
| Joueur mystère | 163 joueurs (15 fiches rédigées + fiches générées depuis `P`, hors années 90 sauf Ballons d'or : `MYSTERE_EXCLUS`) | 163 |
| Top liste | 12 listes | 12 |
| Onze manquant | 12 compos (gabarits `F433`, `F4231`, `F442`, `F3421`, helper `mkOnze`) | 12 |
| Plus ou moins | 7 catégories (`pre` = préfixe d'affichage, `low` = le plus petit gagne) | tirage aléatoire |
| Quiz | 153 questions, rotation ordonnée par blocs de 10 | 15 |
