const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection configuration (adjust with your credentials)
const dbConfig = {
  host: 'localhost',
  user: 'root', 
  password: 'ayush76a', 
  database: 'forest', 
};

// API endpoint to fetch data by district
app.get('/api/data/district', async (req, res) => {
  try {
    const { district } = req.query;

    if (!district) {
      return res.status(400).json({ error: 'District name is required' });
    }

    // Create a connection to the database
    const connection = await mysql.createConnection(dbConfig);

    // Query to fetch data for the specified district
    const [rows] = await connection.execute(
      `SELECT * FROM locations WHERE district = ?`,
      [district]
    );

    // console.log(`Data fetched for district "${district}":`, rows); // Log to backend terminal
    // Close the connection
    await connection.end();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});