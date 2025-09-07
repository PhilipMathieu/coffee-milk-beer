from pathlib import Path
import geopandas as gpd
import matplotlib.pyplot as plt

# Configuration
_TOOLS_DIR = Path(__file__).resolve().parent
_DATA_DIR = _TOOLS_DIR.parent / "src" / "data" / "isochrones"

# Glob the geojson files
geojson_files = list(_DATA_DIR.glob("*.geojson"))

# Plot each file
for file in geojson_files:
    gdf = gpd.read_file(file)
    gdf.plot()
    plt.title(file.stem)
    plt.show()
