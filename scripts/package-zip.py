#!/usr/bin/env python3
import os
import shutil
import zipfile

OUTPUT_NAME = 'terminator-network-simulator.zip'
PUBLIC_DEST = os.path.join('public', OUTPUT_NAME)

EXCLUDE_DIRS = {'node_modules', 'dist', '.git', '__pycache__', '.vite', '.output', '.cache'}
EXCLUDE_FILES = {OUTPUT_NAME, '.env', '.DS_Store', 'Thumbs.db'}

print("Creating clean zip archive for GitHub...")

count = 0
with zipfile.ZipFile(OUTPUT_NAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
        for file in files:
            # Exclude secret .env and logs, but keep .env.example
            if file in EXCLUDE_FILES or file.endswith('.log'):
                continue
            if file.startswith('.env') and file != '.env.example':
                continue
            
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, '.')
            
            # Skip public/terminator-network-simulator.zip if already there
            if arcname.endswith(OUTPUT_NAME):
                continue
                
            zipf.write(file_path, arcname)
            count += 1

# Copy to public folder for direct browser download
os.makedirs('public', exist_ok=True)
shutil.copy2(OUTPUT_NAME, PUBLIC_DEST)

size_kb = os.path.getsize(OUTPUT_NAME) / 1024
print(f"✅ Berhasil membuat {OUTPUT_NAME} ({count} file, {size_kb:.1f} KB)")
print(f"✅ Tersalin ke {PUBLIC_DEST} untuk akses download langsung melalui browser")
