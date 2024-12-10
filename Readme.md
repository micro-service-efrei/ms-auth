# Docker Compose Setup pour Microservice Auth et PostgreSQL

Ce projet utilise **Docker Compose** pour déployer un microservice d'authentification (`ms-auth`) avec une base de données PostgreSQL associée (`db`).

## Étapes pour démarrer les services

### 1. Cloner le projet

Si tu n'as pas encore cloné le projet, commence par cloner le repository :

```bash
git clone git@github.com:micro-service-efrei/ms-auth.git
cd ms-auth
```

### 2. Créer un fichier `.env`

Assure-toi d'avoir un fichier `.env` à la racine du projet avec les variables d'environnement nécessaires pour la configuration de la base de données et du service d'authentification.
Voir l'exemple `.env.exemple`

**Note** : Modifie les valeurs selon tes besoins.

### 3. Lancer les services avec Docker Compose

Assure-toi que tu es dans le répertoire racine du projet où se trouve ton fichier `docker-compose.yml`.

Exécute la commande suivante pour démarrer les services :

```bash
docker-compose up
```

### 4. Effectuer la migration du schéma de la base de données

Après avoir démarré les services avec **`docker-compose up`**, tu devras exécuter la migration du schéma de la base de données pour que la structure des tables soit mise à jour.

Pour cela, exécute la commande suivante dans ton terminal :

```bash
docker exec -d ms-auth npm run migrate up
```

### 5. Vérification du bon fonctionnement

- Le microservice **`ms-auth`** devrait maintenant être disponible sur [http://localhost:3000](http://localhost:3000).
