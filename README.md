TOKAI ELITE — Portefeuille de Comptes
=====================================

Qu’est‑ce que c’est ?
---------------------
Site statique (HTML/CSS/JS) pour visualiser la performance des comptes de trading: tableau, profils avec statistiques avancées, historique des trades et graphiques (Chart.js via CDN). Aucune API payante.

Démarrage local
---------------
- Ouvrir `index.html` dans votre navigateur.
- Les données se trouvent dans `data/accounts.json`.

Modifier les données
--------------------
- Chaque compte: `{ personName, name, totalDeposit, monthly[], trades[], stats }`.
- Si `trades` est vide, l’app génère des trades réalistes pour alimenter les stats et graphiques.

Déployer gratuitement (GitHub Pages)
-----------------------------------
1) Créez un dépôt public sur GitHub.
2) En local (PowerShell):
```bash
cd "C:\Users\HP\Desktop\Job\Website"
git init
git branch -m main
echo.> .nojekyll
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<votre-user>/<votre-repo>.git
git push -u origin main
```
3) Activez Pages: Repository → Settings → Pages → Source: Deploy from a branch → Branch: `main` / Folder: `/root` → Save.

URL
---
Après 1–2 minutes: `https://<votre-user>.github.io/<votre-repo>/`

Structure
---------
- `index.html`: UI + modale profil
- `styles.css`: styles (thème sombre)
- `app.js`: logique et graphiques
- `data/accounts.json`: données locales

Licence
-------
Usage libre.


