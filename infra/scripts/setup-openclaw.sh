#!/bin/bash
# OpenClaw Setup Script for Boostify
# Runs inside WSL2 or Linux for isolated environment
set -euo pipefail

echo "=== Boostify OpenClaw Setup ==="
echo "Date: $(date -u)"
echo "OS: $(uname -a)"

# Check Node version
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
echo "Node: $NODE_VERSION"

REQUIRED_MAJOR=22
REQUIRED_MINOR=16

check_node() {
  if [[ "$NODE_VERSION" == "not installed" ]]; then
    echo "Node.js not found. Installing Node 24 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
    NODE_VERSION=$(node --version)
    echo "Installed Node: $NODE_VERSION"
  fi

  local version="${NODE_VERSION#v}"
  local major=$(echo "$version" | cut -d. -f1)
  local minor=$(echo "$version" | cut -d. -f2)

  if (( major < REQUIRED_MAJOR )) || (( major == REQUIRED_MAJOR && minor < REQUIRED_MINOR )); then
    echo "Node $NODE_VERSION does not meet minimum (v${REQUIRED_MAJOR}.${REQUIRED_MINOR}). Upgrading..."
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo "Node version OK: $(node --version)"
}

install_openclaw() {
  echo ""
  echo "=== Installing OpenClaw ==="
  npm install -g openclaw@latest
  echo "OpenClaw installed: $(openclaw --version 2>/dev/null || echo 'checking...')"
}

setup_openclaw() {
  echo ""
  echo "=== OpenClaw Setup ==="
  
  # Create workspace
  mkdir -p ~/.openclaw/workspace

  # Copy config if it exists
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CONFIG_SRC="$SCRIPT_DIR/../../services/openclaw-gateway/openclaw.config.json"
  if [[ -f "$CONFIG_SRC" ]]; then
    cp "$CONFIG_SRC" ~/.openclaw/openclaw.json
    echo "Config copied to ~/.openclaw/openclaw.json"
  fi

  # Run doctor to check everything
  echo ""
  echo "=== Running OpenClaw Doctor ==="
  openclaw doctor || true
}

verify_health() {
  echo ""
  echo "=== Health Verification ==="
  openclaw --version 2>/dev/null && echo "CLI: OK" || echo "CLI: NOT FOUND"
  
  echo ""
  echo "=== Setup Complete ==="
  echo "Next steps:"
  echo "  1. openclaw onboard       # Interactive setup"
  echo "  2. openclaw gateway       # Start the gateway"
  echo "  3. openclaw health        # Check health"
  echo ""
  echo "To connect channels later:"
  echo "  openclaw channels login   # WhatsApp/Telegram/Discord"
}

# Main
check_node
install_openclaw
setup_openclaw
verify_health
