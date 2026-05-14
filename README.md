# AES Image Encryption & Decryption System

A modern, web-based image encryption and decryption application built using Python Flask, HTML, CSS, and Vanilla JavaScript. It uses the AES (Advanced Encryption Standard) algorithm (CBC mode) to securely encrypt and decrypt images.

## Features
- **Upload Image**: Support for PNG, JPG, JPEG formats.
- **AES-128 Encryption**: Uses a secure random 16-byte key and IV.
- **Image Previews**: Displays original, noisy encrypted preview, and restored decrypted images.
- **Download**: Allows downloading of both encrypted and decrypted images.
- **Beautiful UI**: Modern glassmorphism design with a dark cyan neon theme.

## Setup Instructions

1. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

3. Open your browser and navigate to `http://127.0.0.1:5000/`.

## Usage
1. Upload an image using the drag-and-drop area or click to select a file.
2. Click the "Encrypt" button. A random AES key will be generated, and a noisy image preview will appear.
3. Click the "Decrypt" button to restore the original image using the same key.
4. Download the encrypted or decrypted images using the provided buttons.
