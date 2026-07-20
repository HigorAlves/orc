#!/usr/bin/env sh
# orc CLI installer — downloads the right release binary for this host.
#
#   curl -fsSL https://raw.githubusercontent.com/HigorAlves/orc/main/cli/install.sh | sh
#
# Env overrides:
#   ORC_VERSION   release tag to install (default: latest)
#   ORC_BIN_DIR   install directory (default: /usr/local/bin, or ~/.local/bin
#                 when the former is not writable)
set -eu

REPO="HigorAlves/orc"
BIN="orc"

info() { printf '%s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; exit 1; }

# --- detect platform -------------------------------------------------------
os=$(uname -s)
case "$os" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *) err "unsupported OS: $os (use 'go install' or download from GitHub Releases)" ;;
esac

arch=$(uname -m)
case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) err "unsupported architecture: $arch" ;;
esac

# --- resolve version -------------------------------------------------------
version="${ORC_VERSION:-}"
if [ -z "$version" ]; then
  info "Resolving latest release…"
  version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name":' | head -1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  [ -n "$version" ] || err "could not resolve latest version; set ORC_VERSION"
fi
# goreleaser strips the leading v from the archive name.
nover=$(printf '%s' "$version" | sed 's/^v//')

# --- download + extract ----------------------------------------------------
asset="orc_${nover}_${os}_${arch}.tar.gz"
url="https://github.com/${REPO}/releases/download/${version}/${asset}"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

info "Downloading ${asset}…"
curl -fsSL "$url" -o "$tmp/$asset" || err "download failed: $url"

# Verify checksum when the checksums file is available.
if curl -fsSL "https://github.com/${REPO}/releases/download/${version}/checksums.txt" -o "$tmp/checksums.txt" 2>/dev/null; then
  want=$(grep " ${asset}\$" "$tmp/checksums.txt" | awk '{print $1}')
  if [ -n "$want" ]; then
    if command -v shasum >/dev/null 2>&1; then
      got=$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')
    elif command -v sha256sum >/dev/null 2>&1; then
      got=$(sha256sum "$tmp/$asset" | awk '{print $1}')
    fi
    [ -z "${got:-}" ] || [ "$got" = "$want" ] || err "checksum mismatch for $asset"
  fi
fi

tar -xzf "$tmp/$asset" -C "$tmp"

# --- choose an install dir -------------------------------------------------
bindir="${ORC_BIN_DIR:-/usr/local/bin}"
if [ ! -d "$bindir" ] || [ ! -w "$bindir" ]; then
  bindir="$HOME/.local/bin"
  mkdir -p "$bindir"
fi

install -m 0755 "$tmp/$BIN" "$bindir/$BIN" 2>/dev/null || {
  cp "$tmp/$BIN" "$bindir/$BIN" && chmod 0755 "$bindir/$BIN"
}

info "Installed ${BIN} ${version} to ${bindir}/${BIN}"
case ":$PATH:" in
  *":$bindir:"*) : ;;
  *) info "Add ${bindir} to your PATH to run 'orc'." ;;
esac
info "Next: run 'orc' to launch the installer, or 'orc install' to add the plugin."
