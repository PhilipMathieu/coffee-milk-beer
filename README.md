# Coffee Milk Beer - Neighborhood Essentials

A geospatial data visualization project that combines MapLibre GL JS, Tailwind CSS, and OSMnx to create interactive maps showing precomputed isochrones to various points of interest:

- Coffee shops
- Bars and restaurants
- Grocery stores

## Project Structure

```
coffee-milk-beer/
├── src/                    # Source code
│   ├── js/                # JavaScript modules
│   ├── css/               # CSS and Tailwind
│   └── data/              # Data files and precomputed isochrones
├── public/                 # Static assets
├── tools/                  # OSMnx isochrone generation scripts
├── docs/                   # Documentation
└── dist/                   # Built output
```

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+
- npm or yarn
- uv (Python package manager)
- PMTiles binary (for data conversion)

### Installation

1. **Install uv** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # or on Windows:
   # powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. **Install Python dependencies**:
   ```bash
   uv sync
   ```

3. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

4. **Generate isochrones** (required for first run):
   ```bash
   uv run cmb-generate-isochrones --location "Portland, ME"
   ```

5. **Convert to PMTiles** (required for first run):
   ```bash
   uv run cmb-convert-pmtiles --combine
   ```

### Python CLI (installable)

After syncing with `uv`, you can also run the steps as console scripts:

```bash
uv run cmb-generate-isochrones --location "New York, NY"
uv run cmb-convert-pmtiles --combine
```

Once published to PyPI later, these commands will be available after `pip install coffee-milk-beer`.

6. **Start development server**:
   ```bash
   # Run Vite and Tailwind watcher together
   npm run dev:all
   ```

7. **Build for production (static output in `dist/`)**:
   ```bash
   npm run build:site
   ```

## Static Deployment (GitHub Pages)

This project deploys as a pure static site. CI builds Tailwind and Vite, then publishes the `dist/` folder to GitHub Pages.

### Setup

1. Ensure your default branch is `main` (or update the workflow to match).
2. In GitHub, go to Settings → Pages:
   - Source: GitHub Actions
3. The provided workflow at `.github/workflows/pages.yml` will:
   - Install dependencies with `npm ci`
   - Run `npm run build:site` (Tailwind → `dist/tailwind.css`, then `vite build`)
   - Upload `dist/` as the Pages artifact
   - Deploy to Pages

After a push to `main`, the site will be available at your repository’s Pages URL. You can trigger a manual deploy via the Actions tab (workflow_dispatch).

## Customization

### Adding New POI Types

1. Modify `src/js/config.js` to add new point of interest categories
2. Update the isochrone generation script in `tools/`
3. Add corresponding UI components

### Styling

- Modify `src/css/tailwind.css` for custom Tailwind configurations
- Edit `src/css/custom.css` for additional custom styles

### Map Configuration

- Update `src/js/map-config.js` for map styling and layer configurations
- Modify `src/js/isochrone.js` for isochrone visualization parameters

## Technologies Used

- **MapLibre GL JS**: Modern, open-source mapping library
- **PMTiles**: Single-file archive format for efficient map tile storage and serving
- **Tailwind CSS**: Utility-first CSS framework
- **OSMnx**: Python library for working with OpenStreetMap data and generating isochrones
- **Vite**: Fast build tool and dev server
- **uv**: Fast Python package manager and resolver

## PMTiles Integration

This project uses PMTiles for efficient storage and serving of map data:

- **Base Tiles**: Street networks, land use, and transportation data
- **Isochrone Data**: Precomputed travel time polygons for different POI types
- **Vector Tiles**: Optimized for web delivery and rendering performance

### PMTiles Workflow

1. Generate isochrones using OSMnx (`tools/generate_isochrones.py`)
2. Convert GeoJSON to PMTiles format (`tools/convert_to_pmtiles.py`)
3. Serve PMTiles via the web application
4. Render using MapLibre GL JS with PMTiles protocol support

## License

MIT License - see LICENSE file for details.
