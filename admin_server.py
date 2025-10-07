#!/usr/bin/env python3
"""
Serveur simple pour permettre la sauvegarde des données admin
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import webbrowser

class AdminHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.serve_file('index.html')
        elif self.path.startswith('/data/'):
            self.serve_file(self.path[1:])
        elif self.path.startswith('/styles.css'):
            self.serve_file('styles.css')
        elif self.path.startswith('/app.js'):
            self.serve_file('app.js')
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == '/save-data':
            self.save_data()
        else:
            self.send_error(404)
    
    def serve_file(self, filename):
        try:
            with open(filename, 'rb') as f:
                content = f.read()
            
            # Déterminer le type de contenu
            if filename.endswith('.html'):
                content_type = 'text/html'
            elif filename.endswith('.css'):
                content_type = 'text/css'
            elif filename.endswith('.js'):
                content_type = 'application/javascript'
            elif filename.endswith('.json'):
                content_type = 'application/json'
            else:
                content_type = 'application/octet-stream'
            
            self.send_response(200)
            self.send_header('Content-type', content_type)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)
    
    def save_data(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Sauvegarder dans le fichier
            with open('data/accounts.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            
            print(f"✅ Données sauvegardées avec succès!")
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(f'{{"error": "{str(e)}"}}'.encode())
            print(f"❌ Erreur lors de la sauvegarde: {e}")

def start_server():
    server = HTTPServer(('localhost', 8001), AdminHandler)
    print("🚀 Serveur admin démarré sur http://localhost:8001")
    print("📝 Le panneau admin peut maintenant sauvegarder les données!")
    print("🌐 Ouvrez http://localhost:8001 dans votre navigateur")
    server.serve_forever()

if __name__ == "__main__":
    start_server()
