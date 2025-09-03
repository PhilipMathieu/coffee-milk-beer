import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { CONFIG, POI_CONFIG } from './config.js';
import { createMapConfig } from './map-config.js';
import { IsochroneManager } from './isochrone.js';

// Main application class
class CoffeeMilkBeerApp {
  constructor() {
    this.map = null;
    this.isochroneManager = null;
    this.currentLocation = null;
    this.activePOITypes = new Set(['coffee', 'bar', 'grocery']);
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    try {
      await this.initializeMap();
      this.initializeIsochroneManager();
      this.setupEventListeners();
      this.setupUI();
      
      // Try to get user location on startup
      this.getUserLocation();
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showError('Failed to initialize the application. Please refresh the page.');
    }
  }

  // Initialize MapLibre GL JS map
  async initializeMap() {
    // Register PMTiles protocol
    let protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    
    const mapConfig = createMapConfig();
    
    this.map = new maplibregl.Map(mapConfig);
    
    // Wait for map to load
    await new Promise((resolve) => {
      this.map.on('load', resolve);
    });
    
    // Add navigation control
    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    
    // Add fullscreen control
    this.map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    
    console.log('Map initialized successfully');
  }

  // Initialize isochrone manager
  initializeIsochroneManager() {
    this.isochroneManager = new IsochroneManager(this.map);
  }

  // Setup event listeners
  setupEventListeners() {
    // Location button
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
      locationBtn.addEventListener('click', () => this.getUserLocation());
    }

    // POI type toggles
    Object.keys(POI_CONFIG).forEach(poiType => {
      const toggle = document.getElementById(`${poiType}-toggle`);
      if (toggle) {
        toggle.addEventListener('change', async (e) => {
          e.preventDefault();
          try {
            await this.togglePOIType(poiType, e.target.checked);
          } catch (error) {
            console.error(`Error toggling ${poiType}:`, error);
          }
        });
      }
    });

    // Time interval buttons
    Object.keys(POI_CONFIG).forEach(poiType => {
      CONFIG.isochrone.timeIntervals.forEach(time => {
        const button = document.getElementById(`${poiType}-${time}`);
        if (button) {
          button.addEventListener('click', () => {
            this.setActiveTimeInterval(poiType, time);
          });
        }
      });
    });

    // Map click events
    this.map.on('click', (e) => this.handleMapClick(e));
    
    // Map load events
    this.map.on('load', () => this.onMapLoad());
  }

  // Setup UI components
  setupUI() {
    // Initialize sidebar state
    this.updateSidebarCounts();
    
    // Set default active time intervals
    Object.keys(POI_CONFIG).forEach(poiType => {
      this.setActiveTimeInterval(poiType, CONFIG.isochrone.defaultTime);
    });
  }

  // Get user's current location
  async getUserLocation() {
    if (!navigator.geolocation) {
      this.showError('Geolocation is not supported by this browser.');
      return;
    }

    this.showLoading(true);
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      await this.setLocation(location);
      
    } catch (error) {
      console.error('Error getting location:', error);
      this.showError('Unable to get your location. Please try again or click on the map.');
    } finally {
      this.showLoading(false);
    }
  }

  // Set a specific location and generate isochrones
  async setLocation(location) {
    this.currentLocation = location;
    
    // Update map center
    this.map.flyTo({
      center: [location.lng, location.lat],
      zoom: CONFIG.map.defaultZoom,
      duration: 2000
    });

    // Add location marker
    this.addLocationMarker(location);
    
    // Set current location in isochrone manager
    this.isochroneManager.setCurrentLocation(location);
    
    // Generate isochrones for all active POI types
    await this.generateAllIsochrones();
    
    // Update UI
    this.updateSidebarCounts();
  }

  // Add location marker to the map
  addLocationMarker(location) {
    // Remove existing location marker
    if (this.map.getLayer('location-marker')) {
      this.map.removeLayer('location-marker');
    }
    if (this.map.getSource('location-source')) {
      this.map.removeSource('location-source');
    }

    // Add new location marker
    this.map.addSource('location-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        },
        properties: {
          name: 'Your Location'
        }
      }
    });

    this.map.addLayer({
      id: 'location-marker',
      type: 'circle',
      source: 'location-source',
      paint: {
        'circle-radius': 8,
        'circle-color': '#3b82f6',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3
      }
    });
  }

  // Generate isochrones for all active POI types
  async generateAllIsochrones() {
    if (!this.currentLocation) return;

    this.showLoading(true);
    
    try {
      const promises = Array.from(this.activePOITypes).map(poiType => 
        this.generateIsochrones(poiType)
      );
      
      await Promise.all(promises);
      
    } catch (error) {
      console.error('Error generating isochrones:', error);
      this.showError('Failed to generate some isochrones. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  // Generate isochrones for a specific POI type
  async generateIsochrones(poiType) {
    if (!this.currentLocation) return;

    try {
      const data = await this.isochroneManager.loadIsochrones(this.currentLocation, poiType);
      
      if (data) {
        this.isochroneManager.addIsochroneLayers(poiType, data);
        this.updatePOICount(poiType, data);
      }
      
    } catch (error) {
      console.error(`Error generating isochrones for ${poiType}:`, error);
    }
  }

  // Toggle POI type visibility
  async togglePOIType(poiType, visible) {
    if (visible) {
      this.activePOITypes.add(poiType);
      if (this.currentLocation) {
        try {
          await this.generateIsochrones(poiType);
        } catch (error) {
          console.error(`Error generating isochrones for ${poiType}:`, error);
        }
      }
    } else {
      this.activePOITypes.delete(poiType);
      this.isochroneManager.removeIsochroneLayers(poiType);
      this.updatePOICount(poiType, null);
    }
  }

  // Set active time interval for a POI type
  setActiveTimeInterval(poiType, time) {
    // Update button states
    CONFIG.isochrone.timeIntervals.forEach(t => {
      const button = document.getElementById(`${poiType}-${t}`);
      if (button) {
        button.classList.remove('bg-opacity-40', 'bg-opacity-50', 'bg-opacity-60');
        button.classList.add(`bg-opacity-${Math.min(20 + (t * 10), 60)}`);
      }
    });
    
    // Update isochrone visibility
    this.isochroneManager.toggleIsochroneLayers(poiType, true);
  }

  // Handle map click events
  handleMapClick(e) {
    const location = {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng
    };
    
    this.setLocation(location);
  }

  // Update POI count in sidebar
  updatePOICount(poiType, data) {
    const countElement = document.getElementById(`${poiType}-count`);
    if (countElement) {
      if (data && data.features) {
        countElement.textContent = data.features.length;
      } else {
        countElement.textContent = '0';
      }
    }
  }

  // Update all sidebar counts
  updateSidebarCounts() {
    Object.keys(POI_CONFIG).forEach(poiType => {
      if (this.activePOITypes.has(poiType)) {
        const stats = this.isochroneManager.getStatistics(poiType);
        this.updatePOICount(poiType, stats ? { features: Array(stats.total).fill({}) } : null);
      }
    });
  }

  // Show/hide loading overlay
  showLoading(show) {
    this.isLoading = show;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !show);
    }
  }

  // Show error message
  showError(message) {
    console.error(message);
    // You could implement a toast notification system here
    alert(message);
  }

  // Handle map load completion
  onMapLoad() {
    console.log('Map fully loaded');
    // Additional initialization after map is ready
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CoffeeMilkBeerApp();
});
