import React, { useState, useRef } from 'react';
import Map, { Marker, NavigationControl, Popup, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // Ensure Mapbox CSS is included
import * as turf from '@turf/turf'; // For calculating bounding box
import gadmData from '../gadm41_IND_2.json'; // Import the GADM GeoJSON file

const MapBoxMap = () => {
  const mapRef = useRef();
  // State to store clicked coordinates
  const [clickCoords, setClickCoords] = useState({ lng: null, lat: null });
  // State to control popup visibility and content
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState(null);
  // State for filtered GeoJSON (selected state or district)
  const [filteredGeoJSON, setFilteredGeoJSON] = useState(null);
  // State for search query and suggestions
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Extract unique states and districts for search suggestions
  const states = [...new Set(gadmData.features.map(f => f.properties.NAME_1))];
  const districts = gadmData.features.map(f => ({
    state: f.properties.NAME_1,
    district: f.properties.NAME_2,
  }));

  // Fetch district name using Mapbox Reverse Geocoding API
  const fetchDistrictName = async (lng, lat) => {
    const accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=place,region`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      let districtName = null;

      // Look for district in the response
      if (data.features && data.features.length > 0) {
        for (const feature of data.features) {
          if (feature.place_type.includes('place')) {
            districtName = feature.text; // e.g., "Jaipur"
            break;
          } else if (feature.place_type.includes('region')) {
            // Sometimes the district might be in the context
            if (feature.context) {
              const districtContext = feature.context.find(ctx => ctx.id.includes('place'));
              if (districtContext) {
                districtName = districtContext.text;
                break;
              }
            }
          }
        }
      }

      return districtName;
    } catch (error) {
      console.error('Error fetching district name:', error);
      return null;
    }
  };

  // Fetch data from backend for the district and log to terminal
  const fetchDistrictData = async (district) => {
    if (!district) return;

    try {
      const response = await fetch(`http://localhost:5000/api/data/district?district=${district}`);
      const data = await response.json();
      console.log(`Fetched data for district "${district}":`, data); // Log to terminal
      setPopupContent(data);
    } catch (error) {
      console.error('Error fetching district data:', error);
      setPopupContent({ error: 'Failed to fetch data' });
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(e.target.value);
    setShowSuggestions(true);

    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const matchingStates = states
      .filter(state => state.toLowerCase().includes(query))
      .map(state => ({ type: 'state', name: state }));

    const matchingDistricts = districts
      .filter(d => d.district.toLowerCase().includes(query))
      .map(d => ({ type: 'district', name: d.district, state: d.state }));

    setSuggestions([...matchingStates, ...matchingDistricts]);
  };

  // Handle search selection
  const handleSearchSelect = (item) => {
    setSearchQuery(item.name);
    setShowSuggestions(false);

    let filteredFeatures;
    if (item.type === 'state') {
      filteredFeatures = gadmData.features.filter(
        f => f.properties.NAME_1 === item.name
      );
    } else {
      filteredFeatures = gadmData.features.filter(
        f => f.properties.NAME_1 === item.state && f.properties.NAME_2 === item.name
      );
    }

    const newFilteredGeoJSON = {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };
    setFilteredGeoJSON(newFilteredGeoJSON);

    if (newFilteredGeoJSON.features.length > 0) {
      const bbox = turf.bbox(newFilteredGeoJSON);
      const [minLng, minLat, maxLng, maxLat] = bbox;
      mapRef.current?.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 50, duration: 1000 }
      );
    } else {
      console.warn(`Region "${item.name}" not found in the GeoJSON data.`);
    }
  };

  // Handle mouse click to capture coordinates and fetch district data
  const handleClick = async (event) => {
    const { lng, lat } = event.lngLat;
    setClickCoords({ lng, lat });
    setShowPopup(true);

    // Fetch district name using Mapbox Reverse Geocoding
    const districtName = await fetchDistrictName(lng, lat);
    if (districtName) {
      // Fetch data for the district
      await fetchDistrictData(districtName);
    } else {
      setPopupContent({ error: 'Could not determine district' });
    }
  };

  // Handle mouse leave to hide popup
  const handleMouseLeave = () => {
    setShowPopup(false);
    setPopupContent(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Search box */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 70,
          zIndex: 1,
          width: '250px',
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search for a state or district..."
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '14px',
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onFocus={() => setShowSuggestions(true)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '5px',
              maxHeight: '200px',
              overflowY: 'auto',
              position: 'absolute',
              width: '100%',
              zIndex: 2,
            }}
          >
            {suggestions.map((item, index) => (
              <li
                key={index}
                onMouseDown={() => handleSearchSelect(item)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
                onMouseLeave={(e) => (e.target.style.backgroundColor = 'white')}
              >
                {item.name} ({item.type === 'state' ? 'State' : `District, ${item.state}`})
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Display coordinates in a fixed div at top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 0 5px rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      >
        {clickCoords.lng && clickCoords.lat ? (
          <p>
            Longitude: {clickCoords.lng.toFixed(4)}, Latitude: {clickCoords.lat.toFixed(4)}
          </p>
        ) : (
          <p>Click on the map to see coordinates</p>
        )}
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 75.7873,
          latitude: 26.9124,
          zoom: 10,
        }}
        style={{ width: '100%', height: '100vh' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      >
        <NavigationControl position="top-left" />

        {/* Add boundary layer for the selected region */}
        {filteredGeoJSON && filteredGeoJSON.features.length > 0 && (
          <Source id="boundary" type="geojson" data={filteredGeoJSON}>
            <Layer
              id="boundary-layer"
              type="line"
              paint={{
                'line-color': '#FF0000',
                'line-width': 2,
              }}
            />
            <Layer
              id="fill-layer"
              type="fill"
              paint={{
                'fill-color': '#FF0000',
                'fill-opacity': 0.2,
              }}
            />
          </Source>
        )}

        {/* Optional: Marker at clicked position */}
        {clickCoords.lng && clickCoords.lat && (
          <Marker
            longitude={clickCoords.lng}
            latitude={clickCoords.lat}
            color="blue"
          />
        )}

        {/* Popup to show all fetched data of coordinates according to district  */}
        {showPopup && clickCoords.lng && clickCoords.lat && (
          <Popup
          longitude={clickCoords.lng}
          latitude={clickCoords.lat}
          closeButton={false}
          closeOnClick={false}
          offset={[0, -10]}
        >
          <div style={{ padding: '10px', maxWidth: '300px' }}>
            {popupContent ? (
              Array.isArray(popupContent) ? (
                popupContent.length > 0 ? (
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      District: {popupContent[0].District}
                    </h4>
                    <p><strong>Average Temp (°C):</strong> {popupContent[0].Average_Temp_C.toFixed(2)}</p>
                    <p><strong>Culturable but Barren (sq km):</strong> {popupContent[0].Culturable_but_Barren_sq_km.toFixed(2)}</p>
                    <p><strong>Forest Coverage (sq km):</strong> {popupContent[0].Forest_coverage_sq_km.toFixed(2)}</p>
                    <p><strong>Misc Tree Crops (sq km):</strong> {popupContent[0].Misc_Tree_Crops_sq_km.toFixed(2)}</p>
                    <p><strong>Moderately Dense Forest (sq km):</strong> {popupContent[0].Moderately_Dense_Forest_sq_km.toFixed(2)}</p>
                    <p><strong>Open Forest (sq km):</strong> {popupContent[0].Open_Forest_sq_km.toFixed(2)}</p>
                    <p><strong>Permanent Pastures (sq km):</strong> {popupContent[0].Permanent_Pastures_sq_km.toFixed(2)}</p>
                    <p><strong>Rainfall (mm):</strong> {popupContent[0].Rainfall_mm}</p>
                    <p><strong>Soil pH:</strong> {popupContent[0].Soil_pH}</p>
                    <p><strong>Total Uncultivated Land (sq km):</strong> {popupContent[0].Total_Uncultivated_land.toFixed(2)}</p>
                    <p><strong>Very Dense Forest (sq km):</strong> {popupContent[0].Very_Dense_Forest_sq_km.toFixed(2)}</p>
                  </div>
                ) : (
                  <p>No fire alerts found in this district.</p>
                )
              ) : (
                <p>{popupContent.error}</p>
              )
            ) : (
              <p>Loading...</p>
            )}
          </div>
        </Popup>
        )}
      </Map>
    </div>
  );
};

export default MapBoxMap;