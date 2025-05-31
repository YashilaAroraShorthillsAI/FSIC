const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// === Gemini API key ===
const GEMINI_API_KEY = 'GEMINI API KEY'; // ⛔ WARNING: Hardcoding API keys is insecure for production
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// === MySQL Configuration ===
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'your_password', // Replace with your MySQL password
  database: 'forest',
};

// === Endpoint ===
app.get('/api/data/district', async (req, res) => {
  try {
    const { district, state, trees = 10000, years } = req.query;

    if (!district) {
      return res.status(400).json({ error: 'District name is required' });
    }

    const connection = await mysql.createConnection(dbConfig);

    let query = `
      SELECT 
        d.district_name,
        d.state_name,
        dd.latitude,
        dd.longitude,
        dd.soil_ph,
        dd.rainfall_mm,
        dd.average_temp_c,
        dd.very_dense_forest_sq_km,
        dd.moderately_dense_forest_sq_km,
        dd.open_forest_sq_km,
        dd.forest_coverage_sq_km,
        dd.permanent_pastures_sq_km,
        dd.misc_tree_crops_sq_km,
        dd.culturable_but_barren_sq_km,
        dd.total_uncultivated_land_sq_km
      FROM districts d
      JOIN district_data dd ON d.district_id = dd.district_id
      WHERE d.district_name = ?
    `;
    const params = [district];

    if (state) {
      query += ` AND d.state_name = ?`;
      params.push(state);
    }

    const [rows] = await connection.execute(query, params);
    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: `No data found for district: ${district}${state ? ' in state: ' + state : ''}` });
    }

    const data = rows[0];

    // 🧠 Construct prompt dynamically
    const prompt = `
You are an expert in sustainable forestry and environmental planning. Use the following data to create a detailed plantation strategy.

District: ${data.district_name}, State: ${data.state_name}
Coordinates: (${data.latitude}, ${data.longitude})
Soil pH: ${data.soil_ph}, Rainfall: ${data.rainfall_mm} mm, Avg Temperature: ${data.average_temp_c} °C
Land Use:
- Very Dense Forest: ${data.very_dense_forest_sq_km} sq.km
- Moderately Dense Forest: ${data.moderately_dense_forest_sq_km} sq.km
- Open Forest: ${data.open_forest_sq_km} sq.km
- Permanent Pastures: ${data.permanent_pastures_sq_km} sq.km
- Misc Tree Crops: ${data.misc_tree_crops_sq_km} sq.km
- Barren but Culturable: ${data.culturable_but_barren_sq_km} sq.km
- Total Uncultivated Land: ${data.total_uncultivated_land_sq_km} sq.km

**User Request:**
Plan to plant ${trees} trees${years ? ` over ${years} years` : ''} in this region.
Answer:
1. What species (trees, crops, small plants) should be planted and where?
2. How should land be divided between tree types?
3. Why are these species chosen (climate, soil, etc)?
4. Environmental impact and sustainability
5. Steps to make the plan climate-resilient

Be specific, practical, and environmentally optimized.
`.trim();

    // 🎯 Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const plan = response.text();

    res.json({ data, plan });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server listener
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
