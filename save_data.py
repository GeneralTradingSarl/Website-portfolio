#!/usr/bin/env python3
"""
Script pour sauvegarder les données modifiées depuis le panneau admin
Usage: python save_data.py
"""

import json
import os
from datetime import datetime

def save_accounts_data():
    """Sauvegarde les données des comptes modifiées"""
    
    # Chemin vers le fichier accounts.json
    accounts_file = "data/accounts.json"
    
    # Vérifier si le fichier existe
    if not os.path.exists(accounts_file):
        print(f"Erreur: Le fichier {accounts_file} n'existe pas!")
        return False
    
    try:
        # Lire le fichier actuel
        with open(accounts_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print("Données actuelles chargées:")
        print(f"- Nombre de comptes: {len(data.get('accounts', []))}")
        
        # Afficher les premiers comptes
        for i, account in enumerate(data.get('accounts', [])[:3]):
            print(f"  {i+1}. {account.get('personName', 'N/A')} - {account.get('name', 'N/A')}")
        
        # Créer une sauvegarde
        backup_file = f"data/accounts_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"\nSauvegarde créée: {backup_file}")
        print("Pour modifier les données, utilisez le panneau admin sur le site web.")
        print("Le fichier sera automatiquement mis à jour.")
        
        return True
        
    except Exception as e:
        print(f"Erreur lors de la sauvegarde: {e}")
        return False

if __name__ == "__main__":
    print("=== Gestionnaire de données des comptes ===")
    save_accounts_data()
