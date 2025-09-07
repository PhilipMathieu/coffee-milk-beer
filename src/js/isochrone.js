import { CONFIG, ISOCHRONE_CONFIG } from './config.js';
import { createLayerConfig } from './map-config.js';
import { PMTiles } from 'pmtiles';

// Isochrone data manager for PMTiles
export class IsochroneManager {
  constructor(map) {
    this.map = map;
    this.isochroneData = new Map();
    this.activeLayers = new Set();
    this.currentLocation = null;
    this.pmtilesSources = new Map(); // Track multiple sources by POI type
  }

  // Initialize PMTiles source for isochrones
  async initializePMTilesSource(poiType, location) {
    const sourceId = `isochrones-${poiType}-${Math.round(location.lat * 1000)}-${Math.round(location.lng * 1000)}`;
    
    if (this.map.getSource(sourceId)) {
      this.pmtilesSources.set(poiType, sourceId);
      return;
    }

    try {
      // Determine the correct PMTiles file based on location and POI type
      const pmtilesFile = this.getPMTilesFileName(poiType, location);
      const pmtilesUrl = `${window.location.origin}/pmtiles/${pmtilesFile}`;
      
      // Create PMTiles instance
      const p = new PMTiles(pmtilesUrl);
      
      // Add PMTiles source for isochrones
      this.map.addSource(sourceId, {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`
      });
      
      this.pmtilesSources.set(poiType, sourceId);
      console.log(`PMTiles isochrone source initialized: ${pmtilesFile}`);
      
      // Wait for the source to load before proceeding
      return new Promise((resolve, reject) => {
        this.map.on('sourcedata', (e) => {
          if (e.sourceId === sourceId && e.isSourceLoaded) {
            console.log(`PMTiles source ${sourceId} loaded successfully`);
            resolve();
          }
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error(`PMTiles source ${sourceId} failed to load within 10 seconds`));
        }, 10000);
      });
      
    } catch (error) {
      console.error('Failed to initialize PMTiles source:', error);
      throw error;
    }
  }

  // Get the correct PMTiles filename based on POI type and location
  getPMTilesFileName(poiType, location) {
    // For now, use the Portland, ME files as they seem to be the main ones
    // In a real implementation, you'd determine the correct file based on location
    const lat = Math.round(location.lat * 1000);
    const lng = Math.round(location.lng * 1000);
    
    // Check if we're in the Portland, ME area (roughly)
    if (lat >= 43600 && lat <= 43700 && lng >= -70250 && lng <= -70200) {
      return `${poiType}_Portland_ME_isochrones.pmtiles`;
    } else {
      // Default to Portland, ME for now
      return `${poiType}_Portland_ME_isochrones.pmtiles`;
    }
  }

  // Load isochrone data for a specific location and POI type
  async loadIsochrones(location, poiType) {
    const key = `${poiType}-${location.lat}-${location.lng}`;
    
    // Set current location for use in layer configuration
    this.currentLocation = location;
    
    if (this.isochroneData.has(key)) {
      return this.isochroneData.get(key);
    }

    try {
      // Initialize PMTiles source for this specific location and POI type
      await this.initializePMTilesSource(poiType, location);
      
      // For PMTiles, we'll create a mock data structure since the actual data
      // will be loaded via vector tiles. This is a placeholder for the UI.
      const mockData = this.createMockIsochroneData(poiType, location);
      this.isochroneData.set(key, mockData);
      return mockData;
    } catch (error) {
      console.error(`Failed to load isochrones for ${poiType}:`, error);
      return null;
    }
  }

  // Create mock data structure for UI display (since PMTiles loads data via vector tiles)
  createMockIsochroneData(poiType, location) {
    return {
      type: 'FeatureCollection',
      features: [],
      properties: {
        poi_type: poiType,
        location: location,
        time_intervals: ISOCHRONE_CONFIG.timeIntervals
      }
    };
  }

  // Add isochrone layers to the map using PMTiles
  addIsochroneLayers(poiType, data) {
    const pmtilesSource = this.pmtilesSources.get(poiType);
    if (!pmtilesSource) {
      console.log(`No PMTiles source available for ${poiType}`);
      return;
    }

    console.log(`Adding isochrone layers for ${poiType} using source: ${pmtilesSource}`);

    try {
      // Add layers for each time interval using PMTiles source
      ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
        const layerId = `${poiType}-isochrone-${time}`;

        // Add layer using PMTiles source
        const layerConfig = createLayerConfig(poiType, time);
        layerConfig.source = pmtilesSource;
        // Get the correct source layer name from the PMTiles file
        const pmtilesFile = this.getPMTilesFileName(poiType, this.currentLocation);
        const sourceLayerName = pmtilesFile.replace('.pmtiles', '');
        layerConfig['source-layer'] = sourceLayerName;
        
        console.log(`Adding layer ${layerId} with config:`, layerConfig);
        
        try {
          this.map.addLayer(layerConfig);
          this.activeLayers.add(layerId);
          console.log(`Successfully added layer ${layerId}`);
        } catch (layerError) {
          console.error(`Failed to add layer ${layerId}:`, layerError);
        }
      });
    } catch (error) {
      console.error(`Failed to add isochrone layers for ${poiType}:`, error);
    }
  }

  // Remove isochrone layers for a specific POI type
  removeIsochroneLayers(poiType) {
    ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
      const layerId = `${poiType}-isochrone-${time}`;
      
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
        this.activeLayers.delete(layerId);
      }
    });
  }

  // Toggle isochrone layers visibility
  toggleIsochroneLayers(poiType, visible) {
    ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
      const layerId = `${poiType}-isochrone-${time}`;
      
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }

  // Update isochrone colors based on POI type
  updateIsochroneColors(poiType) {
    ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
      const layerId = `${poiType}-isochrone-${time}`;
      
      if (this.map.getLayer(layerId)) {
        const color = this.getIsochroneColor(poiType, time);
        const outlineColor = this.getIsochroneOutlineColor(poiType, time);
        
        this.map.setPaintProperty(layerId, 'fill-color', color);
        this.map.setPaintProperty(layerId, 'fill-outline-color', outlineColor);
      }
    });
  }

  // Get isochrone color for a specific POI type and time
  getIsochroneColor(poiType, timeInterval) {
    const colors = {
      coffee: {
        5: 'rgba(146, 64, 14, 0.3)',
        10: 'rgba(146, 64, 14, 0.5)',
        15: 'rgba(146, 64, 14, 0.7)'
      },
      bar: {
        5: 'rgba(220, 38, 38, 0.3)',
        10: 'rgba(220, 38, 38, 0.5)',
        15: 'rgba(220, 38, 38, 0.7)'
      },
      grocery: {
        5: 'rgba(254, 243, 199, 0.3)',
        10: 'rgba(254, 243, 199, 0.5)',
        15: 'rgba(254, 243, 199, 0.7)'
      }
    };
    
    return colors[poiType]?.[timeInterval] || colors.coffee[timeInterval];
  }

  // Get outline color for isochrones
  getIsochroneOutlineColor(poiType, timeInterval) {
    const colors = {
      coffee: '#92400e',
      bar: '#dc2626',
      grocery: '#fbbf24'
    };
    
    return colors[poiType] || colors.coffee;
  }

  // Clear all isochrone data
  clearAll() {
    this.isochroneData.clear();
    this.activeLayers.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    this.activeLayers.clear();
  }

  // Get statistics for a specific POI type
  getStatistics(poiType) {
    const key = `${poiType}-${this.currentLocation?.lat}-${this.currentLocation?.lng}`;
    const data = this.isochroneData.get(key);
    
    if (!data || !data.features) return null;
    
    const stats = {
      total: data.features.length,
      byTime: {}
    };
    
    ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
      const count = data.features.filter(f => 
        (f.properties.time || f.properties.duration) === time
      ).length;
      stats.byTime[time] = count;
    });
    
    return stats;
  }

  // Set current location for statistics
  setCurrentLocation(location) {
    this.currentLocation = location;
  }
}
