import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialisation de l'application Flask
app = Flask(__name__)

# Configuration du CORS pour autoriser les requêtes depuis n'importe quelle origine.
# C'est le "laissez-passer" pour que votre frontend puisse parler au backend.
CORS(app)

# Le chemin où Render va stocker vos données de manière persistante.
DATA_DIR = os.getenv('RENDER_DISK_PATH', 'data')
ACCOUNTS_FILE = os.path.join(DATA_DIR, 'accounts.json')

# Un "endpoint" simple pour vérifier que le serveur est bien en ligne.
@app.route('/')
def index():
    return jsonify(status="ok", message="Admin server with Flask is running")

# L'endpoint pour sauvegarder les données. Il n'accepte que les requêtes POST.
@app.route('/save-data', methods=['POST'])
def save_data():
    try:
        # Récupérer les données JSON envoyées par le frontend
        data = request.get_json()
        if not data:
            return jsonify(error="No data provided"), 400

        # S'assurer que le dossier de données existe
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)

        # Écrire les données dans le fichier accounts.json
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ Données sauvegardées avec succès dans {ACCOUNTS_FILE}")
        return jsonify(success=True)

    except Exception as e:
        print(f"❌ Erreur lors de la sauvegarde: {e}")
        return jsonify(error=str(e)), 500

# Cette partie est utile pour le test en local mais ne sera pas utilisée par Gunicorn
if __name__ == '__main__':
    # Le port est fourni par Render via une variable d'environnement, sinon on utilise 8001
    port = int(os.environ.get('PORT', 8001))
    app.run(host='0.0.0.0', port=port)