#!/bin/bash

set -e

echo "🚀 Setting up Coffee Milk Beer development environment..."

# Install system dependencies for tippecanoe
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y build-essential libsqlite3-dev zlib1g-dev

# Install uv (Python package manager)
echo "📦 Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
uv sync

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install tippecanoe for tile building
echo "🗺️  Installing tippecanoe..."
git clone https://github.com/felt/tippecanoe.git /tmp/tippecanoe
cd /tmp/tippecanoe
make -j
sudo make install
cd -
rm -rf /tmp/tippecanoe

echo "✅ Development environment setup complete!"
echo ""
echo "To get started:"
echo "  1. Run 'uv run cmb-generate-isochrones --location \"Your City, State\"' to generate isochrones"
echo "  2. Run 'uv run cmb-convert-pmtiles --combine' to convert to tiles with tippecanoe"
echo "  3. Run 'npm run dev:all' to start the development server"