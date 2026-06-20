# Script para desplegar modelos AI en GCP VM
# Ejecutar después de habilitar billing y configurar proyecto

# 1. Crear VM con GPU preemptible
gcloud compute instances create boostify-ai-server \
  --zone=us-central1-a \
  --machine-type=n1-standard-8 \
  --accelerator=type=nvidia-tesla-t4,count=1 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=200GB \
  --preemptible \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=http-server,https-server

# 2. Subir código
gcloud compute scp --zone=us-central1-a --recurse "open source" boostify-ai-server:~/

# 3. Instalar dependencias en VM
gcloud compute ssh boostify-ai-server --zone=us-central1-a --command="
  sudo apt update && sudo apt install -y python3-pip git docker.io nvidia-docker2
  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
  cd open source
  # Instalar para cada modelo
  for dir in */; do
    if [ -f \"\$dir/requirements.txt\" ]; then
      cd \$dir && pip install -r requirements.txt && cd ..
    fi
  done
"

# 4. Crear y ejecutar contenedores Docker para modelos
# (Ejemplo para Wan2.2)
gcloud compute ssh boostify-ai-server --zone=us-central1-a --command="
  cd open source/Wan2.2-main
  docker build -t wan2.2 .
  docker run -d --gpus all -p 8000:8000 --name wan2.2 wan2.2
"

# Scripts para apagar/encender
# Apagar: gcloud compute instances stop boostify-ai-server --zone=us-central1-a
# Encender: gcloud compute instances start boostify-ai-server --zone=us-central1-a