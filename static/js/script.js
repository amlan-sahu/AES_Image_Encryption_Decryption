document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewsSection = document.getElementById('previewsSection');
    
    const originalImg = document.getElementById('originalImg');
    const encryptedImg = document.getElementById('encryptedImg');
    const decryptedImg = document.getElementById('decryptedImg');
    
    const encryptPlaceholder = document.getElementById('encryptPlaceholder');
    const decryptPlaceholder = document.getElementById('decryptPlaceholder');
    
    const encryptBtn = document.getElementById('encryptBtn');
    const decryptBtn = document.getElementById('decryptBtn');
    
    const downloadEncryptedBtn = document.getElementById('downloadEncryptedBtn');
    const downloadDecryptedBtn = document.getElementById('downloadDecryptedBtn');
    
    const keySection = document.getElementById('keySection');
    const aesKeyInput = document.getElementById('aesKeyInput');
    const copyKeyBtn = document.getElementById('copyKeyBtn');
    
    const uploadSpinner = document.getElementById('uploadSpinner');
    const encryptSpinner = document.getElementById('encryptSpinner');
    const decryptSpinner = document.getElementById('decryptSpinner');
    
    const encryptTime = document.getElementById('encryptTime');
    const decryptTime = document.getElementById('decryptTime');
    
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    // State Variables
    let currentUploadedFilename = '';
    let currentEncryptedBin = '';
    let currentOriginalFilename = ''; // Keep track of original name to save decrypted file

    // --- Toast Notifications ---
    function showToast(message, type = 'success') {
        toastMessage.textContent = message;
        toast.className = 'toast glass-panel show ' + type;
        
        if (type === 'success') {
            toastIcon.className = 'fa-solid fa-check-circle';
        } else {
            toastIcon.className = 'fa-solid fa-exclamation-circle';
        }

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // --- File Upload Logic ---
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    async function handleFileUpload(file) {
        // Reset UI
        previewsSection.style.display = 'grid';
        keySection.style.display = 'none';
        
        encryptedImg.style.opacity = '0';
        decryptedImg.style.opacity = '0';
        
        encryptPlaceholder.style.display = 'block';
        decryptPlaceholder.style.display = 'block';
        
        encryptBtn.disabled = false;
        decryptBtn.disabled = true;
        
        downloadEncryptedBtn.style.display = 'none';
        downloadDecryptedBtn.style.display = 'none';
        
        encryptTime.textContent = '';
        decryptTime.textContent = '';

        currentOriginalFilename = file.name;
        
        const formData = new FormData();
        formData.append('image', file);

        uploadSpinner.style.display = 'block';
        originalImg.style.opacity = '0';

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                currentUploadedFilename = data.filename;
                originalImg.src = data.url;
                originalImg.onload = () => {
                    originalImg.style.opacity = '1';
                };
                showToast('Image uploaded successfully!');
            } else {
                showToast(data.error || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Network error during upload', 'error');
        } finally {
            uploadSpinner.style.display = 'none';
        }
    }

    // --- Encrypt Logic ---
    encryptBtn.addEventListener('click', async () => {
        if (!currentUploadedFilename) return;

        encryptBtn.disabled = true;
        encryptSpinner.style.display = 'block';
        encryptPlaceholder.style.display = 'none';
        encryptedImg.style.opacity = '0';

        try {
            const response = await fetch('/encrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: currentUploadedFilename })
            });

            const data = await response.json();

            if (response.ok) {
                // Show Key
                keySection.style.display = 'block';
                aesKeyInput.value = data.key;
                
                currentEncryptedBin = data.bin_filename;

                // Update Encrypted Image Preview
                // Add timestamp to bypass browser cache
                encryptedImg.src = data.encrypted_url + '?t=' + new Date().getTime();
                encryptedImg.onload = () => {
                    encryptedImg.style.opacity = '1';
                };

                // Enable Decrypt and Download
                decryptBtn.disabled = false;
                downloadEncryptedBtn.style.display = 'flex';
                downloadEncryptedBtn.href = data.encrypted_url;

                encryptTime.textContent = `Encryption time: ${data.encrypt_time}s`;
                showToast('Image encrypted successfully!');
            } else {
                showToast(data.error || 'Encryption failed', 'error');
                encryptPlaceholder.style.display = 'block';
                encryptBtn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showToast('Network error during encryption', 'error');
            encryptPlaceholder.style.display = 'block';
            encryptBtn.disabled = false;
        } finally {
            encryptSpinner.style.display = 'none';
        }
    });

    // --- Decrypt Logic ---
    decryptBtn.addEventListener('click', async () => {
        if (!currentEncryptedBin || !aesKeyInput.value) return;

        decryptBtn.disabled = true;
        decryptSpinner.style.display = 'block';
        decryptPlaceholder.style.display = 'none';
        decryptedImg.style.opacity = '0';

        try {
            const response = await fetch('/decrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bin_filename: currentEncryptedBin,
                    key: aesKeyInput.value,
                    original_filename: currentOriginalFilename
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Update Decrypted Image Preview
                decryptedImg.src = data.decrypted_url + '?t=' + new Date().getTime();
                decryptedImg.onload = () => {
                    decryptedImg.style.opacity = '1';
                };

                // Enable Download
                downloadDecryptedBtn.style.display = 'flex';
                downloadDecryptedBtn.href = data.decrypted_url;

                decryptTime.textContent = `Decryption time: ${data.decrypt_time}s`;
                showToast('Image decrypted successfully!');
            } else {
                showToast(data.error || 'Decryption failed', 'error');
                decryptPlaceholder.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            showToast('Network error during decryption', 'error');
            decryptPlaceholder.style.display = 'block';
        } finally {
            decryptSpinner.style.display = 'none';
            decryptBtn.disabled = false;
        }
    });

    // --- Copy Key Logic ---
    copyKeyBtn.addEventListener('click', () => {
        if (aesKeyInput.value) {
            navigator.clipboard.writeText(aesKeyInput.value)
                .then(() => showToast('AES Key copied to clipboard!'))
                .catch(() => showToast('Failed to copy key', 'error'));
        }
    });
});
