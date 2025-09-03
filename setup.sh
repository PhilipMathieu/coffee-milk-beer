#!/bin/bash

# Coffee Milk Beer - Project Setup Script
# This script demonstrates proper usage of uv for Python environment management
# and validates the key libraries used in the project.

set -e  # Exit on any error

echo "🚀 Setting up Coffee Milk Beer project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if uv is installed
check_uv() {
    print_status "Checking if uv is installed..."
    if command -v uv &> /dev/null; then
        print_success "uv is already installed"
        uv --version
    else
        print_warning "uv is not installed. Installing now..."
        install_uv
    fi
}

# Install uv
install_uv() {
    print_status "Installing uv..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -LsSf https://astral.sh/uv/install.sh | sh
        source ~/.bashrc
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -LsSf https://astral.sh/uv/install.sh | sh
        source ~/.zshrc
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows
        print_error "Please install uv manually on Windows using:"
        print_error "powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\""
        exit 1
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Verify installation
    if command -v uv &> /dev/null; then
        print_success "uv installed successfully"
        uv --version
    else
        print_error "Failed to install uv"
        exit 1
    fi
}

# Setup Python environment with uv
setup_python_env() {
    print_status "Setting up Python environment with uv..."
    
    # Create virtual environment
    uv venv
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    uv sync
    
    print_success "Python environment setup complete"
}

# Validate key libraries
validate_libraries() {
    print_status "Validating key libraries..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Test OSMnx
    print_status "Testing OSMnx..."
    if uv run python -c "import osmnx; print(f'OSMnx version: {osmnx.__version__}')"; then
        print_success "OSMnx is working correctly"
    else
        print_error "OSMnx validation failed"
        exit 1
    fi
    
    # Test GeoPandas
    print_status "Testing GeoPandas..."
    if uv run python -c "import geopandas; print(f'GeoPandas version: {geopandas.__version__}')"; then
        print_success "GeoPandas is working correctly"
    else
        print_error "GeoPandas validation failed"
        exit 1
    fi
    
    # Test other key libraries
    print_status "Testing other key libraries..."
    uv run python -c "
import shapely
import networkx
import folium
import geopy
import flask
import flask_cors
print('All key libraries imported successfully')
print(f'Shapely version: {shapely.__version__}')
print(f'NetworkX version: {networkx.__version__}')
print(f'Flask version: {flask.__version__}')
"
    
    print_success "All key libraries validated successfully"
}

# Setup Node.js environment
setup_node_env() {
    print_status "Setting up Node.js environment..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ and try again."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js version: $(node --version)"
    
    # Install npm dependencies
    print_status "Installing npm dependencies..."
    npm install
    
    print_success "Node.js environment setup complete"
}

# Build Tailwind CSS
build_tailwind() {
    print_status "Building Tailwind CSS..."
    
    # Create dist directory if it doesn't exist
    mkdir -p dist
    
    # Build Tailwind CSS
    npm run tailwind:build
    
    print_success "Tailwind CSS built successfully"
}

# Generate sample isochrones
generate_sample_isochrones() {
    print_status "Generating sample isochrones..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Create data directories
    mkdir -p src/data/isochrones
    mkdir -p src/data/cache
    
    # Generate isochrones for default location
    print_status "Generating isochrones for New York..."
    uv run python tools/generate_isochrones.py --location "New York, NY, USA"
    
    print_success "Sample isochrones generated"
}

# Test the application
test_application() {
    print_status "Testing the application..."
    
    # Test if the HTML file loads correctly
    if [ -f "index.html" ]; then
        print_success "HTML file found and ready"
    else
        print_error "HTML file not found"
        exit 1
    fi
    
    # Test if the JavaScript files exist
    if [ -f "src/js/main.js" ]; then
        print_success "JavaScript files found"
    else
        print_error "JavaScript files not found"
        exit 1
    fi
    
    # Test if the Python tools exist
    if [ -f "tools/generate_isochrones.py" ]; then
        print_success "Python tools found"
    else
        print_error "Python tools not found"
        exit 1
    fi
    
    print_success "Application structure validated"
}

# Display next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the development server:"
    echo "   npm run dev"
    echo ""
    echo "2. In another terminal, start the API server:"
    echo "   source .venv/bin/activate"
    echo "   uv run python tools/api_server.py"
    echo ""
    echo "3. Generate isochrones for a specific location:"
    echo "   source .venv/bin/activate"
    echo "   uv run python tools/generate_isochrones.py --location 'Your City, State'"
    echo ""
    echo "4. Open your browser and navigate to: http://localhost:3000"
    echo ""
    echo "Project structure:"
    echo "├── src/js/          # JavaScript modules"
    echo "├── src/css/         # CSS and Tailwind"
    echo "├── src/data/        # Generated isochrones"
    echo "├── tools/           # OSMnx scripts"
    echo "└── dist/            # Built assets"
    echo ""
}

# Main setup function
main() {
    print_status "Starting Coffee Milk Beer project setup..."
    
    # Check prerequisites
    check_uv
    
    # Setup environments
    setup_python_env
    setup_node_env
    
    # Validate everything works
    validate_libraries
    build_tailwind
    test_application
    
    # Generate sample data
    generate_sample_isochrones
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
