from flask import Flask, request, jsonify
from flask_cors import CORS # type: ignore
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import os # <--- Importa o OS pra ler as variáveis de ambiente

app = Flask(__name__)
CORS(app)

# Lê as chaves diretamente do servidor (Render)
SPOTIPY_CLIENT_ID = os.environ.get('SPOTIPY_CLIENT_ID')
SPOTIPY_CLIENT_SECRET = os.environ.get('SPOTIPY_CLIENT_SECRET')

auth_manager = SpotifyClientCredentials(client_id=SPOTIPY_CLIENT_ID, client_secret=SPOTIPY_CLIENT_SECRET)
sp = spotipy.Spotify(auth_manager=auth_manager)

@app.route('/search', methods=['GET'])
def search_albums():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'Faltou o termo da busca, mano'}), 400
    
    try:
        # Busca álbuns no Spotify
        results = sp.search(q=query, type='album', limit=12)
        albums = []
        
        for item in results['albums']['items']:
            albums.append({
                'id': item['id'],
                'name': item['name'],
                'artist': item['artists'][0]['name'],
                'image': item['images'][0]['url'] if item['images'] else ''
            })
            
        return jsonify(albums), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)