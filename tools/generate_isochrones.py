#!/usr/bin/env python3
"""
Generate isochrones to various points of interest using OSMnx.

This script generates isochrones (travel time polygons) to coffee shops,
bars/restaurants, and grocery stores from a given location using OpenStreetMap data.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import networkx as nx
import geopandas as gpd
import pandas as pd
import numpy as np
import osmnx as ox
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
import folium
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
_TOOLS_DIR = Path(__file__).resolve().parent
_REPO_DIR = _TOOLS_DIR.parent
CONFIG = {
    'travel_mode': 'walk',  # 'walk', 'bike', 'drive'
    'time_intervals': [5, 10, 15],  # minutes
    'default_location': 'Portland, ME, USA',
    'default_coords': (43.6591, -70.2568),  # Portland, Maine
    'output_dir': str((_REPO_DIR / 'src/data/isochrones').resolve()),
    'cache_dir': str((_REPO_DIR / 'src/data/cache').resolve()),
    'max_distance': 5000,  # meters
    'network_type': 'walk',  # 'walk', 'bike', 'drive'
    'simplify': True,
    'clean_periphery': True,
    'custom_filter': None
    ,
    # Verbose plotting: when True, save intermediate plots (network, POIs, reachable nodes, hulls)
    'verbose': False,
    # Subdirectory under output_dir to save verbose plots
    'verbose_dir': 'verbose'
}

# POI type definitions
POI_TYPES = {
    'coffee': {
        'name': 'Coffee Shops',
        'tags': {
            'amenity': 'cafe',
            'cuisine': 'coffee_shop'
        },
        'fallback_tags': {
            'amenity': 'cafe'
        },
        'color': '#92400e'
    },
    'bar': {
        'name': 'Bars & Restaurants',
        'tags': {
            'amenity': ['bar', 'restaurant', 'pub']
        },
        'fallback_tags': {
            'amenity': 'restaurant'
        },
        'color': '#dc2626'
    },
    'grocery': {
        'name': 'Grocery Stores',
        'tags': {
            'shop': 'supermarket',
            'amenity': 'marketplace'
        },
        'fallback_tags': {
            'shop': 'convenience'
        },
        'color': '#fbbf24'
    }
}


class IsochroneGenerator:
    """Generate isochrones to various POI types using OSMnx."""
    
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.setup_directories()
        self.geolocator = Nominatim(user_agent="coffee_milk_beer_isochrones")
        
        # Configure OSMnx (v2.x settings API)
        try:
            ox.settings.use_cache = True
            ox.settings.cache_folder = self.config['cache_dir']
            ox.settings.log_console = True
            ox.settings.log_file = True
        except AttributeError:
            # Fallback for older OSMnx versions if needed
            raise ImportError("OSMnx version 2.x or higher is required")
    
    def setup_directories(self):
        """Create necessary directories if they don't exist."""
        Path(self.config['output_dir']).mkdir(parents=True, exist_ok=True)
        Path(self.config['cache_dir']).mkdir(parents=True, exist_ok=True)
        if self.config.get('verbose'):
            Path(self.config['output_dir']).joinpath(self.config.get('verbose_dir', 'verbose')).mkdir(parents=True, exist_ok=True)
    
    def get_location_coordinates(self, location_query: str) -> Tuple[float, float]:
        """Get coordinates for a location query using geocoding."""
        try:
            location = self.geolocator.geocode(location_query)
            if location:
                return (location.latitude, location.longitude)
            else:
                logger.warning(f"Could not geocode: {location_query}")
                return self.config['default_coords']
        except GeocoderTimedOut:
            logger.warning(f"Geocoding timed out for: {location_query}")
            return self.config['default_coords']
    
    def get_network(self, center_coords: Tuple[float, float], 
                    radius: int = 5000):
        """Get the street network around the center point."""
        try:
            # center_coords is (lat, lon), but OSMnx expects (lon, lat)
            # So we need to reverse the coordinates
            lon, lat = center_coords[1], center_coords[0]
            
            # Get the street network
            G = ox.graph_from_point(
                (lat, lon),  # OSMnx expects (lat, lon)
                dist=radius,
                network_type=self.config['network_type'],
                custom_filter=self.config['custom_filter']
            )
            
            # Project to UTM for accurate distance calculations
            try:
                # OSMnx 2.x
                G = ox.projection.project_graph(G)
            except AttributeError:
                # Older versions
                G = ox.project_graph(G)
            
            logger.info(f"Retrieved network with {len(G.nodes)} nodes and {len(G.edges)} edges")
            return G
            
        except Exception as e:
            logger.error(f"Error getting network: {e}")
            raise
    
    def get_pois(self, center_coords: Tuple[float, float], 
                  poi_type: str, radius: int = 5000) -> gpd.GeoDataFrame:
        """Get points of interest for a specific type."""
        poi_config = POI_TYPES[poi_type]
        
        try:
            # center_coords is (lat, lon), but OSMnx expects (lat, lon) for features_from_point
            lat, lon = center_coords[0], center_coords[1]
            
            # Try primary tags first (OSMnx v2 uses features_* APIs)
            try:
                pois = ox.features_from_point(
                    (lat, lon),
                    tags=poi_config['tags'],
                    dist=radius
                )
            except AttributeError:
                raise ImportError("OSMnx version 2.x or later is required for this functionality")
            
            # If no results, try fallback tags
            if pois.empty and 'fallback_tags' in poi_config:
                logger.info(f"No POIs found with primary tags for {poi_type}, trying fallback")
                try:
                    pois = ox.features_from_point(
                        (lat, lon),
                        tags=poi_config['fallback_tags'],
                        dist=radius
                    )
                except AttributeError:
                    pois = ox.geometries_from_point(
                        (lat, lon),
                        tags=poi_config['fallback_tags'],
                        dist=radius
                    )
            
            if not pois.empty:
                # Convert to GeoDataFrame if it's not already
                if not isinstance(pois, gpd.GeoDataFrame):
                    pois = gpd.GeoDataFrame(pois)
                
                # Add POI type and clean up
                pois['poi_type'] = poi_type
                pois['category'] = poi_config['name']
                
                # Keep only essential columns
                essential_cols = ['geometry', 'poi_type', 'category', 'name', 'amenity', 'shop']
                available_cols = [col for col in essential_cols if col in pois.columns]
                pois = pois[available_cols]
                
                logger.info(f"Found {len(pois)} {poi_type} POIs")
                # Ensure POIs have a CRS (assume WGS84 if not set)
                if pois.crs is None:
                    try:
                        pois.set_crs('EPSG:4326', inplace=True)
                    except Exception:
                        pois.crs = 'EPSG:4326'
                return pois
            else:
                logger.warning(f"No POIs found for {poi_type}")
                return gpd.GeoDataFrame()
                
        except Exception as e:
            logger.error(f"Error getting POIs for {poi_type}: {e}")
            return gpd.GeoDataFrame()
    
    def generate_isochrones(self, center_coords: Tuple[float, float], 
                           poi_type: str) -> Dict:
        """Generate isochrones to POIs of a specific type."""
        logger.info(f"Generating isochrones for {poi_type}")
        
        try:
            # Get the street network
            G = self.get_network(center_coords, self.config['max_distance'])
            
            # Get POIs
            pois = self.get_pois(center_coords, poi_type, self.config['max_distance'])

            # If verbose, plot the network and POIs
            if self.config.get('verbose'):
                try:
                    # Find center node for plotting context (safe best-effort)
                    try:
                        center_node = ox.distance.nearest_nodes(G, center_coords[1], center_coords[0])
                    except Exception:
                        center_node = None
                    self._plot_network_and_pois(G, center_node, pois, poi_type, center_coords)
                except Exception as e:
                    logger.warning(f"Verbose plotting failed at initial step: {e}")
            
            if pois.empty:
                logger.warning(f"No POIs found for {poi_type}, skipping isochrone generation")
                return self._create_empty_isochrones()
            
            # Calculate isochrones around each POI and merge into a master isochrone
            # for this POI category. This produces one merged polygon per time interval.
            isochrones = self._calculate_isochrones(G, pois)
            
            # Convert to GeoJSON
            geojson = self._isochrones_to_geojson(isochrones, poi_type)
            
            logger.info(f"Generated isochrones for {poi_type}: {len(geojson['features'])} features")
            return geojson
            
        except Exception as e:
            logger.error(f"Error generating isochrones for {poi_type}: {e}")
            return self._create_empty_isochrones()
    
    def _calculate_isochrones(self, G: ox.graph, pois: gpd.GeoDataFrame) -> Dict[int, List[Polygon]]:
        """Calculate isochrones by generating per-POI reachable polygons and
        returning a list of polygons per time interval to be merged later.

        We treat each POI as a center and compute reachable nodes within each
        time interval, build a hull/buffer for that POI/time, and append it to
        the corresponding time bucket. The final merge happens in
        _isochrones_to_geojson.
        """
        isochrones = {time: [] for time in self.config['time_intervals']}

        # Add travel time to edges (walking speed: 1.4 m/s = 84 m/min)
        meters_per_minute = 84  # walking speed
        for edge in G.edges(data=True, keys=True) if G.is_multigraph() else G.edges(data=True):
            if len(edge) == 4:
                u, v, k, data = edge
            else:
                u, v, data = edge
            # Ensure length exists
            if 'length' in data and data['length'] is not None:
                data['time'] = data['length'] / meters_per_minute

        # Ensure POIs are in WGS84 for nearest node lookups
        try:
            pois_wgs = pois.to_crs('EPSG:4326') if pois.crs and pois.crs != 'EPSG:4326' else pois.copy()
        except Exception:
            pois_wgs = pois.copy()

        # Iterate over POIs and generate polygons per time interval
        for idx, poi in pois_wgs.iterrows():
            try:
                geom = poi.geometry
                if geom is None or geom.is_empty:
                    continue

                # Get lon, lat for nearest_nodes (OSMnx expects lon, lat)
                lon, lat = geom.x, geom.y

                try:
                    poi_node = ox.distance.nearest_nodes(G, lon, lat)
                except AttributeError:
                    poi_node = ox.nearest_nodes(G, lon, lat)
                except Exception:
                    # If nearest node lookup fails, skip this POI
                    continue

                # For each time interval compute reachable nodes from this POI
                for time_minutes in self.config['time_intervals']:
                    try:
                        subgraph = nx.ego_graph(G, poi_node, radius=time_minutes, distance='time')

                        if len(subgraph.nodes) == 0:
                            # fallback: create buffer around POI in projected CRS
                            # derive a small buffer in meters and add
                            buffer_distance = time_minutes * meters_per_minute
                            # Build a GeoDataFrame for projection handling
                            try:
                                # Use graph CRS if available, otherwise assume UTM-like
                                crs_proj = G.graph.get('crs', None)
                                poi_gdf = gpd.GeoDataFrame(geometry=[geom], crs='EPSG:4326')
                                if crs_proj and crs_proj != 'EPSG:4326':
                                    poi_proj = poi_gdf.to_crs(crs_proj)
                                else:
                                    poi_proj = poi_gdf.to_crs(poi_gdf.estimate_utm_crs())
                                poly = poi_proj.buffer(buffer_distance).iloc[0]
                                # convert back to projected/expected coords for later union
                                poly = gpd.GeoSeries([poly], crs=poi_proj.crs).to_crs(crs_proj or poi_proj.crs).iloc[0]
                            except Exception:
                                # As last resort, buffer in degrees (approximate)
                                poly = geom.buffer(buffer_distance / 111000.0)
                            isochrones[time_minutes].append(poly)
                            continue

                        # Collect node point geometries using projected coordinates when available
                        node_points = []
                        for node in subgraph.nodes():
                            node_data = G.nodes[node]
                            if 'x' in node_data and 'y' in node_data:
                                node_points.append(Point(node_data['x'], node_data['y']))
                            elif 'lon' in node_data and 'lat' in node_data:
                                node_points.append(Point(node_data['lon'], node_data['lat']))

                        if not node_points:
                            continue

                        # Build GeoDataFrame for points and set CRS to graph CRS if available
                        points_gdf = gpd.GeoDataFrame(geometry=node_points)
                        points_gdf.crs = G.graph.get('crs', None) or 'EPSG:32619'

                        if len(points_gdf) > 2:
                            # union then convex hull to get a single polygon
                            try:
                                convex_hull = points_gdf.unary_union.convex_hull
                            except Exception:
                                convex_hull = points_gdf.geometry.unary_union.convex_hull
                            isochrones[time_minutes].append(convex_hull)
                        else:
                            # Too few points - buffer the POI in the projected CRS
                            try:
                                crs_proj = G.graph.get('crs', None)
                                poi_gdf = gpd.GeoDataFrame(geometry=[geom], crs='EPSG:4326')
                                if crs_proj and crs_proj != 'EPSG:4326':
                                    poi_proj = poi_gdf.to_crs(crs_proj)
                                else:
                                    poi_proj = poi_gdf.to_crs(poi_gdf.estimate_utm_crs())
                                buffer_distance = time_minutes * meters_per_minute
                                buffer_geom = poi_proj.buffer(buffer_distance).iloc[0]
                                isochrones[time_minutes].append(buffer_geom)
                            except Exception:
                                buffer_geom = geom.buffer((time_minutes * meters_per_minute) / 111000.0)
                                isochrones[time_minutes].append(buffer_geom)

                    except Exception as e:
                        logger.debug(f"Skipping POI isochrone for time {time_minutes} at POI {idx}: {e}")
                        continue

            except Exception as e:
                logger.debug(f"Error processing POI {idx}: {e}")
                continue

        return isochrones

    def _plot_network_and_pois(self, G, center_node, pois, poi_type: str, center_coords: Tuple[float, float]):
        """Save a plot of the network, center, and POIs for debugging (verbose mode)."""
        try:
            outdir = Path(self.config['output_dir']) / self.config.get('verbose_dir', 'verbose')
            outdir.mkdir(parents=True, exist_ok=True)

            # Try to get nodes and edges GeoDataFrames from OSMnx
            try:
                nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)
            except Exception:
                # Fallback names for older/newer versions
                nodes_gdf = None
                edges_gdf = None

            fig, ax = plt.subplots(figsize=(8, 8))

            # Plot edges if available
            if edges_gdf is not None and not edges_gdf.empty:
                edges_gdf.plot(ax=ax, linewidth=0.5, edgecolor='gray')

            # Plot nodes if available
            if nodes_gdf is not None and not nodes_gdf.empty:
                nodes_gdf.plot(ax=ax, markersize=2, color='black')

            # Plot POIs (convert to same CRS as nodes if possible)
            if pois is not None and not pois.empty:
                try:
                    if nodes_gdf is not None and nodes_gdf.crs and pois.crs and pois.crs != nodes_gdf.crs:
                        pois_proj = pois.to_crs(nodes_gdf.crs)
                    else:
                        pois_proj = pois
                    pois_proj.plot(ax=ax, color='red', markersize=20, marker='x', label='POIs')
                except Exception:
                    try:
                        pois.plot(ax=ax, color='red', markersize=20, marker='x')
                    except Exception:
                        pass

            # Plot center
            try:
                if center_node is not None and nodes_gdf is not None and center_node in nodes_gdf.index:
                    center_point = nodes_gdf.loc[center_node].geometry
                    gpd.GeoSeries([center_point]).plot(ax=ax, color='blue', markersize=50, marker='*')
                else:
                    # use provided center_coords (lat, lon) and transform to nodes CRS if possible
                    center_point = Point(center_coords[1], center_coords[0])
                    center_gs = gpd.GeoSeries([center_point], crs='EPSG:4326')
                    if nodes_gdf is not None and nodes_gdf.crs and nodes_gdf.crs != 'EPSG:4326':
                        center_gs = center_gs.to_crs(nodes_gdf.crs)
                    center_gs.plot(ax=ax, color='blue', markersize=50, marker='*')
            except Exception:
                pass

            ax.set_title(f'Network and POIs - {poi_type}')
            ax.set_axis_off()

            filename = outdir / f'network_pois_{poi_type}.png'
            fig.savefig(filename, bbox_inches='tight', dpi=200)
            plt.close(fig)
            logger.info(f"Saved verbose network/POI plot to {filename}")
        except Exception as e:
            logger.warning(f"Failed to save network/POI plot: {e}")

    def _plot_isochrone_step(self, G, center_node, nodes_gdf: gpd.GeoDataFrame, time_minutes: int, poi_type: Optional[str]):
        """Save a plot of reachable nodes for a given time interval."""
        try:
            outdir = Path(self.config['output_dir']) / self.config.get('verbose_dir', 'verbose')
            outdir.mkdir(parents=True, exist_ok=True)

            # Try to get edges for context
            try:
                nodes_all, edges_all = ox.graph_to_gdfs(G)
            except Exception:
                nodes_all = None
                edges_all = None

            fig, ax = plt.subplots(figsize=(8, 8))

            if edges_all is not None and not edges_all.empty:
                edges_all.plot(ax=ax, linewidth=0.4, color='lightgray')

            # Plot all nodes faintly
            if nodes_all is not None and not nodes_all.empty:
                nodes_all.plot(ax=ax, markersize=1, color='gray')

            # Plot reachable nodes
            try:
                # nodes_gdf likely in projected CRS; try to match edges CRS
                if nodes_all is not None and nodes_all.crs and nodes_gdf.crs and nodes_gdf.crs != nodes_all.crs:
                    nodes_plot = nodes_gdf.to_crs(nodes_all.crs)
                else:
                    nodes_plot = nodes_gdf
                nodes_plot.plot(ax=ax, markersize=6, color='blue', label=f'reachable ({time_minutes} min)')
            except Exception:
                try:
                    nodes_gdf.plot(ax=ax, markersize=6, color='blue')
                except Exception:
                    pass

            ax.set_title(f'Reachable nodes - {time_minutes} min')
            ax.set_axis_off()

            safe_type = poi_type if poi_type else 'all'
            filename = outdir / f'isochrone_nodes_{safe_type}_{time_minutes}min.png'
            fig.savefig(filename, bbox_inches='tight', dpi=200)
            plt.close(fig)
            logger.info(f"Saved verbose isochrone nodes plot to {filename}")
        except Exception as e:
            logger.warning(f"Failed to save isochrone nodes plot: {e}")
    
    def _isochrones_to_geojson(self, isochrones: Dict[int, List[Polygon]], 
                               poi_type: str) -> Dict:
        """Convert isochrones to GeoJSON format."""
        features = []
        
        for time, polygons in isochrones.items():
            if polygons:
                # Merge overlapping polygons
                merged = unary_union(polygons)
                
                # Ensure we're working with WGS84 coordinates (lat, lon)
                # If the geometry is in a projected CRS, we need to transform it back
                # Create a GeoDataFrame to handle CRS transformation properly
                merged_gdf = gpd.GeoDataFrame(geometry=[merged])
                # Set CRS if not already set (assume UTM for projected coords)
                if not merged_gdf.crs:
                    # Check if coordinates look like projected (large numbers)
                    coords = list(merged.exterior.coords)[0]
                    if abs(coords[0]) > 180 or abs(coords[1]) > 90:
                        # Likely projected coordinates, assume UTM Zone 19N (Portland, ME area)
                        merged_gdf.crs = 'EPSG:32619'
                    else:
                        # Likely already in WGS84
                        merged_gdf.crs = 'EPSG:4326'
                
                # Transform to WGS84 if needed
                if merged_gdf.crs != 'EPSG:4326':
                    merged_gdf = merged_gdf.to_crs('EPSG:4326')
                    merged = merged_gdf.geometry.iloc[0]
                
                # Convert to GeoJSON
                if merged.geom_type == 'Polygon':
                    # Ensure coordinates are in [lon, lat] format for GeoJSON
                    coords = list(merged.exterior.coords)
                    features.append({
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [coords]
                        },
                        'properties': {
                            'time': time,
                            'poi_type': poi_type,
                            'travel_mode': self.config['travel_mode'],
                            'description': f'{time} minute {self.config["travel_mode"]} isochrone to {poi_type}'
                        }
                    })
                elif merged.geom_type == 'MultiPolygon':
                    for poly in merged.geoms:
                        coords = list(poly.exterior.coords)
                        features.append({
                            'type': 'Feature',
                            'geometry': {
                                'type': 'Polygon',
                                'coordinates': [coords]
                            },
                            'properties': {
                                'time': time,
                                'poi_type': poi_type,
                                'travel_mode': self.config['travel_mode'],
                                'description': f'{time} minute {self.config["travel_mode"]} isochrone to {poi_type}'
                            }
                        })
        
        return {
            'type': 'FeatureCollection',
            'features': features,
            'properties': {
                'poi_type': poi_type,
                'travel_mode': self.config['travel_mode'],
                'time_intervals': self.config['time_intervals'],
                'generated_at': pd.Timestamp.now().isoformat()
            }
        }
    
    def _create_empty_isochrones(self) -> Dict:
        """Create empty isochrone GeoJSON when no data is available."""
        return {
            'type': 'FeatureCollection',
            'features': [],
            'properties': {
                'poi_type': 'unknown',
                'travel_mode': self.config['travel_mode'],
                'time_intervals': self.config['time_intervals'],
                'generated_at': pd.Timestamp.now().isoformat(),
                'note': 'No POIs found in this area'
            }
        }
    
    def save_isochrones(self, isochrones: Dict, poi_type: str, 
                       location_name: str) -> str:
        """Save isochrones to a GeoJSON file."""
        # Clean location name for filename
        safe_location = "".join(c for c in location_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_location = safe_location.replace(' ', '_')
        
        filename = f"{poi_type}_{safe_location}_isochrones.geojson"
        filepath = Path(self.config['output_dir']) / filename
        
        with open(filepath, 'w') as f:
            json.dump(isochrones, f, indent=2)
        
        logger.info(f"Saved isochrones to {filepath}")
        return str(filepath)
    
    def generate_all_isochrones(self, location_query: str = None) -> Dict[str, str]:
        """Generate isochrones for all POI types at a given location."""
        if location_query is None:
            location_query = self.config['default_location']
        
        logger.info(f"Generating isochrones for location: {location_query}")
        
        # Get coordinates
        coords = self.get_location_coordinates(location_query)
        logger.info(f"Using coordinates: {coords}")
        
        # Generate isochrones for each POI type
        results = {}
        for poi_type in POI_TYPES.keys():
            try:
                isochrones = self.generate_isochrones(coords, poi_type)
                filepath = self.save_isochrones(isochrones, poi_type, location_query)
                results[poi_type] = filepath
                
            except Exception as e:
                logger.error(f"Failed to generate isochrones for {poi_type}: {e}")
                results[poi_type] = None
        
        return results


def main():
    """Main function to run the isochrone generation."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate isochrones to POIs using OSMnx')
    parser.add_argument('--location', '-l', type=str, 
                       help='Location to generate isochrones for (e.g., "New York, NY")')
    parser.add_argument('--poi-type', '-p', type=str, choices=list(POI_TYPES.keys()),
                       help='Generate isochrones for specific POI type only')
    parser.add_argument('--config', '-c', type=str,
                       help='Path to configuration JSON file')
    parser.add_argument('--output-dir', '-o', type=str,
                       help='Output directory for generated files')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose plotting of intermediate results')
    
    args = parser.parse_args()
    
    # Load custom config if provided
    config = CONFIG.copy()
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config.update(json.load(f))
        except Exception as e:
            logger.error(f"Failed to load config file: {e}")
            return
    
    # Override output directory if provided
    if args.output_dir:
        config['output_dir'] = args.output_dir

    # CLI flag to enable verbose plotting
    if getattr(args, 'verbose', False):
        config['verbose'] = True
    
    # Initialize generator
    generator = IsochroneGenerator(config)
    
    # Generate isochrones
    if args.poi_type:
        # Generate for specific POI type only
        if args.poi_type not in POI_TYPES:
            logger.error(f"Invalid POI type: {args.poi_type}")
            return
        
        location = args.location or config['default_location']
        coords = generator.get_location_coordinates(location)
        isochrones = generator.generate_isochrones(coords, args.poi_type)
        filepath = generator.save_isochrones(isochrones, args.poi_type, location)
        logger.info(f"Generated isochrones for {args.poi_type}: {filepath}")
        
    else:
        # Generate for all POI types
        results = generator.generate_all_isochrones(args.location)
        
        # Print results
        logger.info("Isochrone generation completed:")
        for poi_type, filepath in results.items():
            if filepath:
                logger.info(f"  {poi_type}: {filepath}")
            else:
                logger.error(f"  {poi_type}: Failed")


if __name__ == '__main__':
    main()
