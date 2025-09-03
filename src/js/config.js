// Application configuration
export const CONFIG = {
  // Map configuration
  map: {
    defaultCenter: [43.6591, -70.2568], // Portland, Maine
    defaultZoom: 13,
    maxZoom: 18,
    minZoom: 8,
    style: 'style.json'
  },
  
  // Point of Interest categories
  poiTypes: {
    coffee: {
      name: 'Coffee Shops',
      color: '#92400e',
      osmTags: {
        'amenity': 'cafe',
        'cuisine': 'coffee_shop'
      },
      fallbackTags: {
        'amenity': 'cafe'
      },
      icon: '☕',
      description: 'Places to get coffee and light refreshments'
    },
    
    bar: {
      name: 'Bars & Restaurants',
      color: '#dc2626',
      osmTags: {
        'amenity': ['bar', 'restaurant', 'pub']
      },
      fallbackTags: {
        'amenity': 'restaurant'
      },
      icon: '🍺',
      description: 'Bars, pubs, and restaurants'
    },
    
    grocery: {
      name: 'Grocery Stores',
      color: '#fef3c7',
      osmTags: {
        'shop': 'supermarket',
        'amenity': 'marketplace'
      },
      fallbackTags: {
        'shop': 'convenience'
      },
      icon: '🛒',
      description: 'Supermarkets and convenience stores'
    }
  },
  
  // Isochrone settings
  isochrone: {
    travelMode: 'walk', // 'walk', 'bike', 'drive'
    timeIntervals: [5, 10, 15], // minutes
    defaultTime: 10,
    colors: {
      5: 'rgba(146, 64, 14, 0.3)',   // coffee-800 with opacity
      10: 'rgba(146, 64, 14, 0.5)',  // coffee-800 with opacity
      15: 'rgba(146, 64, 14, 0.7)'   // coffee-800 with opacity
    }
  },
  

  
  // UI settings
  ui: {
    sidebarWidth: '20rem',
    animationDuration: 300,
    popupTimeout: 5000
  }
};

// Export individual config sections for convenience
export const MAP_CONFIG = CONFIG.map;
export const POI_CONFIG = CONFIG.poiTypes;
export const ISOCHRONE_CONFIG = CONFIG.isochrone;
export const UI_CONFIG = CONFIG.ui;
