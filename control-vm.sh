# Scripts para controlar la VM AI

# Encender VM
start-vm() {
  gcloud compute instances start boostify-ai-server --zone=us-central1-a
  echo "VM iniciada. Espera 2-3 minutos para que esté lista."
}

# Apagar VM
stop-vm() {
  gcloud compute instances stop boostify-ai-server --zone=us-central1-a
  echo "VM apagada para ahorrar costos."
}

# Ver estado
status-vm() {
  gcloud compute instances describe boostify-ai-server --zone=us-central1-a --format="value(status)"
}

# Ejecutar: source control-vm.sh && start-vm