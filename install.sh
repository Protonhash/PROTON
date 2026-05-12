#!/bin/bash
set -e

# PROTON Miner Installer
# Usage: curl -sSL proton.fun/install.sh | bash

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

REPO="Protonhash/PROTON"
BINARY_NAME="proton"
INSTALL_DIR="$HOME/.proton/bin"

echo ""
echo -e "${CYAN}"
echo "    ██████╗ ██████╗  ██████╗ ████████╗ ██████╗ ███╗   ██╗"
echo "    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗████╗  ██║"
echo "    ██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██╔██╗ ██║"
echo "    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║╚██╗██║"
echo "    ██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚████║"
echo "    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═══╝"
echo -e "${NC}"
echo -e "    ${BOLD}AI Compute Mining for Solana${NC}"
echo ""

# Detect OS and architecture
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Linux*)   PLATFORM="linux" ;;
        Darwin*)  PLATFORM="macos" ;;
        MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
        *)        echo -e "${RED}Unsupported OS: $OS${NC}"; exit 1 ;;
    esac

    case "$ARCH" in
        x86_64|amd64)  ARCH="x86_64" ;;
        aarch64|arm64) ARCH="aarch64" ;;
        *)             echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
    esac

    echo -e "  ${GREEN}✓${NC} Detected: ${BOLD}$PLATFORM-$ARCH${NC}"
}

# Download binary
download_binary() {
    echo -e "  ${YELLOW}⏳${NC} Downloading PROTON miner..."

    RELEASE_URL="https://github.com/$REPO/releases/latest/download/${BINARY_NAME}-${PLATFORM}-${ARCH}"

    if [ "$PLATFORM" = "windows" ]; then
        RELEASE_URL="${RELEASE_URL}.exe"
        BINARY_NAME="${BINARY_NAME}.exe"
    fi

    mkdir -p "$INSTALL_DIR"

    if command -v curl &> /dev/null; then
        curl -sSL "$RELEASE_URL" -o "$INSTALL_DIR/$BINARY_NAME" 2>/dev/null || {
            echo -e "  ${RED}✗${NC} Download failed. Building from source..."
            build_from_source
            return
        }
    elif command -v wget &> /dev/null; then
        wget -q "$RELEASE_URL" -O "$INSTALL_DIR/$BINARY_NAME" 2>/dev/null || {
            echo -e "  ${RED}✗${NC} Download failed. Building from source..."
            build_from_source
            return
        }
    else
        echo -e "  ${RED}✗${NC} Neither curl nor wget found. Building from source..."
        build_from_source
        return
    fi

    chmod +x "$INSTALL_DIR/$BINARY_NAME"
    echo -e "  ${GREEN}✓${NC} Downloaded successfully"
}

# Build from source (fallback)
build_from_source() {
    if ! command -v cargo &> /dev/null; then
        echo -e "  ${YELLOW}⏳${NC} Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi

    echo -e "  ${YELLOW}⏳${NC} Building from source..."
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 "https://github.com/$REPO.git" "$TEMP_DIR/proton"
    cd "$TEMP_DIR/proton/miner"
    cargo build --release
    mkdir -p "$INSTALL_DIR"
    cp target/release/$BINARY_NAME "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
    rm -rf "$TEMP_DIR"
    echo -e "  ${GREEN}✓${NC} Built successfully"
}

# Add to PATH
setup_path() {
    SHELL_NAME="$(basename "$SHELL")"
    PROFILE=""

    case "$SHELL_NAME" in
        bash) PROFILE="$HOME/.bashrc" ;;
        zsh)  PROFILE="$HOME/.zshrc" ;;
        fish) PROFILE="$HOME/.config/fish/config.fish" ;;
        *)    PROFILE="$HOME/.profile" ;;
    esac

    if [ -n "$PROFILE" ] && ! grep -q "$INSTALL_DIR" "$PROFILE" 2>/dev/null; then
        if [ "$SHELL_NAME" = "fish" ]; then
            echo "set -gx PATH $INSTALL_DIR \$PATH" >> "$PROFILE"
        else
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$PROFILE"
        fi
        echo -e "  ${GREEN}✓${NC} Added to PATH in $PROFILE"
    fi

    export PATH="$INSTALL_DIR:$PATH"
}

# Verify installation
verify() {
    if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
        echo ""
        echo -e "  ${GREEN}✓ PROTON installed successfully!${NC}"
        echo ""
        echo -e "  ${BOLD}Quick Start:${NC}"
        echo -e "    ${CYAN}proton register${NC}    Create account"
        echo -e "    ${CYAN}proton benchmark${NC}   Test your hardware"
        echo -e "    ${CYAN}proton mine${NC}        Start mining"
        echo ""
        echo -e "  ${YELLOW}Restart your terminal or run:${NC}"
        echo -e "    source $PROFILE"
        echo ""
    else
        echo -e "  ${RED}✗ Installation failed${NC}"
        exit 1
    fi
}

# Main
detect_platform
download_binary
setup_path
verify
