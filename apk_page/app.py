import os
from flask import Flask, send_from_directory

app = Flask(__name__)

# Ruta para servir la página index.html
@app.route('/')
def index():
    return send_from_directory(os.getcwd(), 'index.html')

# Ruta para la descarga del archivo APK
@app.route('/download/<filename>')
def download(filename):
    # Asegúrate de que el archivo se encuentre en el directorio correcto
    return send_from_directory(os.getcwd(), filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
