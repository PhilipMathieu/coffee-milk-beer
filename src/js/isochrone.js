import { CONFIG, ISOCHRONE_CONFIG } from './config.js';
import { createLayerConfig } from './map-config.js';

// Isochrone data manager for PMTiles
export class IsochroneManager {
  constructor(map) {
    this.map = map;
    this.isochroneData = new Map();
    this.activeLayers = new Set();
    this.currentLocation = null;
    this.pmtilesSource = null;
  }

  // Initialize PMTiles source for isochrones
  async initializePMTilesSource() {
    if (this.pmtilesSource) return;

    try {
      // Add PMTiles source for isochrones
      this.map.addSource('isochrones-pmtiles', {
        type: 'vector',
        url: 'pmtiles:/pmtiles/isochrones.pmtiles'
      });
      
      this.pmtilesSource = 'isochrones-pmtiles';
      console.log('PMTiles isochrone source initialized');
    } catch (error) {
      console.error('Failed to initialize PMTiles source:', error);
    }
  }

  // Load isochrone data for a specific location and POI type
  async loadIsochrones(location, poiType) {
    const key = `${poiType}-${location.lat}-${location.lng}`;
    
    if (this.isochroneData.has(key)) {
      return this.isochroneData.get(key);
    }

    try {
      // Initialize PMTiles source if not already done
      await this.initializePMTilesSource();
      
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
    if (!this.pmtilesSource) return;

    try {
      // Add layers for each time interval using PMTiles source
      ISOCHRONE_CONFIG.timeIntervals.forEach(time => {
        const layerId = `${poiType}-isochrone-${time}`;

        // Add layer using PMTiles source
        const layerConfig = createLayerConfig(poiType, time);
        layerConfig.source = this.pmtilesSource;
        layerConfig['source-layer'] = 'isochrones'; // PMTiles source layer
        
        this.map.addLayer(layerConfig);
        this.activeLayers.add(layerId);
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
