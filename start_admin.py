#!/usr/bin/env python3
"""
Script pour démarrer le serveur admin et ouvrir le navigateur
"""

import subprocess
import webbrowser
import time
import threading

def start_server():
    """Démarrer le serveur admin"""
    subprocess.run(['python', 'admin_server.py'])

def open_browser():
    """Ouvrir le navigateur après un délai"""
    time.sleep(2)
    webbrowser.open('http://localhost:8001')

if __name__ == "__main__":
    print("🚀 Démarrage du serveur admin...")
    
    # Démarrer le serveur dans un thread séparé
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Ouvrir le navigateur
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    print("✅ Serveur démarré sur http://localhost:8001")
    print("🌐 Le navigateur va s'ouvrir automatiquement")
    print("📝 Utilisez le panneau admin pour modifier les données")
    print("🔑 Mot de passe admin: admin123")
    print("\nAppuyez sur Ctrl+C pour arrêter le serveur")
    
    try:
        # Garder le script en vie
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Arrêt du serveur")
