from huggingface_hub import snapshot_download
import os
os.makedirs('open source/Wan2.2-main/Wan2.2-main/Wan2.2-TI2V-5B', exist_ok=True)
print('Downloading Wan2.2-TI2V-5B...')
path = snapshot_download(repo_id='Wan-AI/Wan2.2-TI2V-5B', local_dir='open source/Wan2.2-main/Wan2.2-main/Wan2.2-TI2V-5B', local_dir_use_symlinks=False)
print('Downloaded at', path)
