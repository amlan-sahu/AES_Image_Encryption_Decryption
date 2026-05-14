import os
import time
import secrets
from flask import Flask, render_template, request, jsonify, send_file, url_for
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from PIL import Image
import numpy as np
import io

app = Flask(__name__)

# Configure folders
BASE_DIR = "/tmp"

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ENCRYPTED_FOLDER = os.path.join(BASE_DIR, 'encrypted')
DECRYPTED_FOLDER = os.path.join(BASE_DIR, 'decrypted')

for folder in [UPLOAD_FOLDER, ENCRYPTED_FOLDER, DECRYPTED_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['ENCRYPTED_FOLDER'] = ENCRYPTED_FOLDER
app.config['DECRYPTED_FOLDER'] = DECRYPTED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB limit

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_noisy_image(encrypted_bytes, original_shape, output_path):
    """
    Converts encrypted bytes into a displayable noisy image preview.
    """
    # Calculate required size for the noisy image
    h, w = original_shape[:2]
    # We just need to fit the bytes into an image, RGB
    num_pixels = h * w
    required_bytes = num_pixels * 3
    
    # Pad or truncate the encrypted bytes to fit the RGB image
    padded_bytes = bytearray(encrypted_bytes)
    if len(padded_bytes) < required_bytes:
        padded_bytes.extend(os.urandom(required_bytes - len(padded_bytes)))
    elif len(padded_bytes) > required_bytes:
        padded_bytes = padded_bytes[:required_bytes]
        
    # Create numpy array and reshape
    noisy_array = np.frombuffer(padded_bytes, dtype=np.uint8).reshape((h, w, 3))
    
    # Save as image
    noisy_image = Image.fromarray(noisy_array, 'RGB')
    noisy_image.save(output_path, 'PNG')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secrets.token_hex(8) + "_" + file.filename
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Determine image format/shape to help with the noisy preview
        with Image.open(filepath) as img:
            img = img.convert('RGB')
            shape = (img.height, img.width, 3)
            
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'url': url_for('static', filename='uploads/' + filename),
            'shape': shape
        })
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/encrypt', methods=['POST'])
def encrypt():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        start_time = time.time()
        
        # 1. Generate a random 16-byte secret key and IV
        key = os.urandom(16)
        iv = os.urandom(16)
        
        # 2. Read image bytes
        with open(filepath, 'rb') as f:
            image_bytes = f.read()
            
        # 3. Encrypt using AES CBC Mode and PKCS7 Padding
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padded_data = pad(image_bytes, AES.block_size)
        encrypted_bytes = cipher.encrypt(padded_data)
        
        # Prepend IV to the encrypted data for decryption
        encrypted_data = iv + encrypted_bytes
        
        # Save encrypted data to binary file
        bin_filename = filename + '.bin'
        bin_filepath = os.path.join(app.config['ENCRYPTED_FOLDER'], bin_filename)
        with open(bin_filepath, 'wb') as f:
            f.write(encrypted_data)
            
        # 4. Convert encrypted bytes into a displayable noisy image preview
        noisy_filename = "noisy_" + filename.rsplit('.', 1)[0] + '.png'
        noisy_filepath = os.path.join(app.config['ENCRYPTED_FOLDER'], noisy_filename)
        
        # Get shape from original image
        with Image.open(filepath) as img:
            shape = (img.height, img.width, 3)
            
        create_noisy_image(encrypted_bytes, shape, noisy_filepath)
        
        encrypt_time = round(time.time() - start_time, 4)
        
        # Store key temporarily in the response (for the user to see and use)
        # In a real app, storing key in session or client side depends on architecture.
        # We will send it to the client.
        
        return jsonify({
            'message': 'Encryption successful',
            'key': key.hex(),
            'encrypted_url': url_for('static', filename='encrypted/' + noisy_filename),
            'bin_filename': bin_filename,
            'encrypt_time': encrypt_time
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def decrypt():
    data = request.json
    bin_filename = data.get('bin_filename')
    key_hex = data.get('key')
    original_filename = data.get('original_filename')
    
    if not bin_filename or not key_hex:
        return jsonify({'error': 'Missing binary file or key'}), 400
        
    bin_filepath = os.path.join(app.config['ENCRYPTED_FOLDER'], bin_filename)
    if not os.path.exists(bin_filepath):
        return jsonify({'error': 'Encrypted file not found'}), 404
        
    try:
        start_time = time.time()
        
        # Parse the key
        key = bytes.fromhex(key_hex)
        if len(key) != 16:
            return jsonify({'error': 'Invalid key length. Must be 16 bytes.'}), 400
            
        # Read the encrypted data
        with open(bin_filepath, 'rb') as f:
            encrypted_data = f.read()
            
        # Extract IV (first 16 bytes) and ciphertext
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        
        # Decrypt
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted_padded = cipher.decrypt(ciphertext)
        decrypted_bytes = unpad(decrypted_padded, AES.block_size)
        
        # Save the restored image
        decrypted_filename = "decrypted_" + original_filename
        decrypted_filepath = os.path.join(app.config['DECRYPTED_FOLDER'], decrypted_filename)
        with open(decrypted_filepath, 'wb') as f:
            f.write(decrypted_bytes)
            
        decrypt_time = round(time.time() - start_time, 4)
        
        return jsonify({
            'message': 'Decryption successful',
            'decrypted_url': url_for('static', filename='decrypted/' + decrypted_filename),
            'decrypt_time': decrypt_time
        })
    except ValueError as e:
        return jsonify({'error': 'Incorrect key or corrupted file.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run()
