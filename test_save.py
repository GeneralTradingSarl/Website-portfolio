#!/usr/bin/env python3
"""
Test de sauvegarde des données
"""

import json
import requests

def test_save():
    # Charger les données actuelles
    with open('data/accounts.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("📊 Données actuelles:")
    print(f"- Nombre de comptes: {len(data['accounts'])}")
    
    # Modifier le premier compte pour test
    if data['accounts']:
        original_name = data['accounts'][0]['personName']
        data['accounts'][0]['personName'] = "TEST MODIFICATION"
        print(f"- Nom original: {original_name}")
        print(f"- Nouveau nom: {data['accounts'][0]['personName']}")
    
    # Tester la sauvegarde
    try:
        response = requests.post('http://localhost:8001/save-data', 
                               json=data,
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            print("✅ Sauvegarde réussie!")
            return True
        else:
            print(f"❌ Erreur de sauvegarde: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

if __name__ == "__main__":
    test_save()
