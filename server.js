const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// SQL Server configuration
const config = {
  user: 'truck_user',
  password: 'connection24',
  server: 'Draco\\SQLEXPRESS',
  database: 'TruckComparison',
  options: {
    encrypt: false,
  },
};

// Routes

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Register route
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Home route after login
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    await sql.connect(config);

    // Query the database to check if the user exists
    const result = await sql.query`SELECT * FROM [User] WHERE Username = ${username} AND PasswordHash = ${password}`;

    if (result.recordset.length > 0) {
      // User authenticated successfully
      res.redirect('/home');
    } else {
      // User not found or invalid credentials
      res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    // Close the SQL connection
    sql.close();
  }
});

// Register post route
app.post('/register', async (req, res) => {
  const { username, password, firstName, lastName } = req.body;

  try {
    await sql.connect(config);

    // Insert user into the 'User' table
    await sql.query`INSERT INTO [User] (Username, FirstName, LastName, PasswordHash) VALUES (${username}, ${firstName}, ${lastName}, ${password})`;

    res.status(200).send('Registration successful');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  } finally {
    sql.close();
  }
});

// Brokers route for API
app.get('/api/brokers', async (req, res) => {
  try {
    // Establish a connection to the SQL Server
    const pool = await sql.connect(config);

    // Fetch data from the database
    const result = await pool.request().query('SELECT * FROM Brokers');
    const brokersData = result.recordset;

    // Send JSON response (ensure it's always an array)
    res.json(Array.isArray(brokersData) ? brokersData : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    // Close the SQL connection (if it was opened)
    if (sql) {
      sql.close();
    }
  }
});

// Brokers HTML file
app.get('/brokers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'brokers.html'));
});

// Add Broker route
app.post('/addBroker', async (req, res) => {
  const { Name, Factorable, WorkWithAgain, Notes, POC, POCNumber, POCEmail } = req.body;

  try {
    await sql.connect(config);

    // Insert broker into the 'Brokers' table
    await sql.query`INSERT INTO Brokers (Name, Factorable, WorkWithAgain, Notes, POC, POCNumber, POCEmail) 
                     VALUES (${Name}, ${Factorable}, ${WorkWithAgain}, ${Notes}, ${POC}, ${POCNumber}, ${POCEmail})`;

    res.status(200).send('Broker added successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  } finally {
    sql.close();
  }
});

// Load route
app.get('/load', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'load.html'));
});

// Trucks route for API
app.get('/api/trucks', async (req, res) => {
  try {
    // Establish a connection to the SQL Server
    const pool = await sql.connect(config);

    // Fetch data from the database
    const result = await pool.request().query('SELECT * FROM TruckInfo');
    const trucksData = result.recordset;

    // Send JSON response (ensure it's always an array)
    res.json(Array.isArray(trucksData) ? trucksData : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    // Close the SQL connection (if it was opened)
    if (sql) {
      sql.close();
    }
  }
});

// Trucks HTML file
app.get('/trucks', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'trucks.html'));
});

// Add Truck route
app.post('/addTruck', async (req, res) => {
  const {
    year,
    make,
    model,
    tareWeight,
    plate,
    trailer,  // The value for the 'Trailer' field
    flatbedLength,
    equipmentNumber,
    fuelMileage,
    fuelCapacity,
  } = req.body;

  try {
    await sql.connect(config);

    // Insert truck into the 'TruckInfo' table
    await sql.query`INSERT INTO TruckInfo (Year, Make, Model, TareWeight, Plate, Trailer, FlatbedLength, EquipmentNumber, FuelMileage, FuelCapacity) 
                     VALUES (${year}, ${make}, ${model}, ${tareWeight}, ${plate}, ${trailer}, ${flatbedLength}, ${equipmentNumber}, ${fuelMileage}, ${fuelCapacity})`;

    res.status(200).send('Truck added successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  } finally {
    sql.close();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
