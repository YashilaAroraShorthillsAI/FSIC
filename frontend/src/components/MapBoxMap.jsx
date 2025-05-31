import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'MAP BOX KEY HERE'; // Replace with your Mapbox access token

const MapBoxMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [locationInfo, setLocationInfo] = useState({});
  const [geminiPlan, setGeminiPlan] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [78.9629, 20.5937],
        zoom: 4,
      });

      map.current.on('click', async (e) => {
        const { lat, lng } = e.lngLat;
        console.log('Map clicked at:', lat, lng);

        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const geoData = await geoRes.json();

          const district =
            geoData.address.county ||
            geoData.address.city_district ||
            geoData.address.suburb ||
            geoData.address.town;
          const state = geoData.address.state;

          if (!district || !state) {
            alert('Could not determine district/state for this location.');
            return;
          }

          console.log('District:', district, 'State:', state);

          const apiUrl = `http://localhost:5000/api/data/district?district=${encodeURIComponent(
            district
          )}&state=${encodeURIComponent(state)}&trees=10000&years=5`;

          const response = await fetch(apiUrl);
          const data = await response.json();

          if (!response.ok) {
            alert(data.error || 'No data found.');
            return;
          }

          setLocationInfo(data.data);
          setGeminiPlan(data.plan);
          setModalOpen(true);
        } catch (err) {
          console.error('Error:', err);
          alert('An error occurred. Check console for details.');
        }
      });
    }
  }, []);

  // Handle Search
  const handleSearch = async () => {
    if (!searchQuery) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', India'
        )}`
      );
      const data = await res.json();

      if (data.length === 0) {
        alert('State not found.');
        return;
      }

      const { lat, lon } = data[0];

      map.current.flyTo({
        center: [parseFloat(lon), parseFloat(lat)],
        zoom: 6,
        essential: true,
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  return (
    <>
      {/* Search Bar */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 999 }}>
        <input
          type="text"
          placeholder="Enter state name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '8px', width: '200px' }}
        />
        <button onClick={handleSearch} style={{ marginLeft: '8px', padding: '8px' }}>
          🔍 Search
        </button>
      </div>

      {/* Map */}
      <div ref={mapContainer} style={{ width: '100%', height: '90vh' }} />

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              width: '80%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <button
              style={{ position: 'absolute', top: '10px', right: '15px' }}
              onClick={() => setModalOpen(false)}
            >
              ❌ Close
            </button>
            <h2>
              {locationInfo.district_name}, {locationInfo.state_name}
            </h2>
            <h4>AI-Generated Plan:</h4>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{geminiPlan}</pre>
          </div>
        </div>
      )}
    </>
  );
};

export default MapBoxMap;
