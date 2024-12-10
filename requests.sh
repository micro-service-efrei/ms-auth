#!/bin/bash

# Fonction pour réinitialiser la base de données
reset_database() {
    echo "Arrêt des conteneurs..."
    docker-compose down
    
    echo "Suppression du volume de la base de données..."
    docker volume rm ms-auth-db-development
    
    echo "Redémarrage des conteneurs..."
    docker-compose up -d
    
    echo "Attente de 5 secondes pour que la base de données soit prête..."
    sleep 5
    
    echo "Base de données réinitialisée !"
}

# Ajout d'une option pour réinitialiser la base de données
case "$1" in
    "reset-db")
        reset_database
        ;;
    *)
        # Test du healthcheck
        echo "Testing health endpoint..."
        curl -X GET http://localhost:3000/ms-auth/health

        # Test de l'inscription avec plus de détails
        echo -e "\n\nTesting register endpoint..."
        curl -X POST http://localhost:3000/ms-auth/register \
          -H "Content-Type: application/json" \
          -H "Accept: application/json" \
          -v \
          -d '{
            "username": "testuser",
            "password": "password123",
            "role": "user"
          }'

        # Test de la connexion (login)
        echo -e "\n\nTesting login endpoint..."
        curl -X POST http://localhost:3000/ms-auth/login \
          -H "Content-Type: application/json" \
          -d '{
            "username": "testuser",
            "password": "password123"
          }' \
          -v

        # Stocker le token JWT (à exécuter après le login et remplacer YOUR_TOKEN)
        TOKEN="YOUR_TOKEN"

        # Test de la route protégée
        echo -e "\n\nTesting protected endpoint..."
        curl -X GET http://localhost:3000/ms-auth/protected \
          -H "Authorization: Bearer $TOKEN"
        ;;
esac