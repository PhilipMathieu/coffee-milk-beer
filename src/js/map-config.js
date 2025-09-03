import { MAP_CONFIG } from './config.js';

// MapLibre GL JS map configuration
export const createMapConfig = () => ({
  container: 'map',
  style: MAP_CONFIG.style,
  center: MAP_CONFIG.defaultCenter,
  zoom: MAP_CONFIG.defaultZoom,
  maxZoom: MAP_CONFIG.maxZoom,
  minZoom: MAP_CONFIG.minZoom,
  attributionControl: true,
  customAttribution: [
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    '© <a href="https://carto.com/attributions">CARTO</a>'
  ].join(' | '),
  preserveDrawingBuffer: false,
  antialias: true,
  fadeDuration: 300
});

// Layer configurations for different POI types
export const createLayerConfig = (poiType, timeInterval) => {
  const baseConfig = {
    id: `${poiType}-isochrone-${timeInterval}`,
    type: 'fill',
    paint: {
      'fill-color': getIsochroneColor(poiType, timeInterval),
      'fill-opacity': 0.6,
      'fill-outline-color': getIsochroneOutlineColor(poiType, timeInterval)
    },
    filter: ['==', ['get', 'time'], timeInterval]
  };

  return baseConfig;
};

// POI marker layer configuration
export const createPOILayerConfig = (poiType) => ({
  id: `${poiType}-markers`,
  type: 'circle',
  paint: {
    'circle-radius': 6,
    'circle-color': getPOIColor(poiType),
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-opacity': 0.8
  },
  filter: ['==', ['get', 'type'], poiType]
});

// Get color for isochrone based on POI type and time
function getIsochroneColor(poiType, timeInterval) {
  const colors = {
    coffee: {
      5: 'rgba(146, 64, 14, 0.3)',   // coffee-800
      10: 'rgba(146, 64, 14, 0.5)',
      15: 'rgba(146, 64, 14, 0.7)'
    },
    bar: {
      5: 'rgba(220, 38, 38, 0.3)',   // red-600
      10: 'rgba(220, 38, 38, 0.5)',
      15: 'rgba(220, 38, 38, 0.7)'
    },
    grocery: {
      5: 'rgba(254, 243, 199, 0.3)', // yellow-100
      10: 'rgba(254, 243, 199, 0.5)',
      15: 'rgba(254, 243, 199, 0.7)'
    }
  };
  
  return colors[poiType]?.[timeInterval] || colors.coffee[timeInterval];
}

// Get outline color for isochrones
function getIsochroneOutlineColor(poiType, timeInterval) {
  const colors = {
    coffee: '#92400e',
    bar: '#dc2626',
    grocery: '#fbbf24'
  };
  
  return colors[poiType] || colors.coffee;
}

// Get color for POI markers
function getPOIColor(poiType) {
  const colors = {
    coffee: '#92400e',
    bar: '#dc2626',
    grocery: '#fbbf24'
  };
  
  return colors[poiType] || colors.coffee;
}

// Map interaction configurations
export const mapInteractions = {
  scrollZoom: true,
  boxZoom: true,
  dragRotate: false,
  dragPan: true,
  keyboard: true,
  doubleClickZoom: true,
  touchZoomRotate: true
};

// Popup configuration
export const popupConfig = {
  closeButton: true,
  closeOnClick: false,
  maxWidth: '300px',
  className: 'custom-popup'
};
