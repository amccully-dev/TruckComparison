const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Session management middleware
app.use(session({
  secret: crypto.randomBytes(64).toString('hex'), // Generate secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Check if user is logged in middleware
app.use((req, res, next) => {
  const allowedRoutes = /^(\/|\/register|\/reset_password)/;

  console.log('Requested URL:', req.url);
  console.log('Session User:', req.session.user);

  if (!req.session.user && !allowedRoutes.test(req.url)) {
    console.log('Redirecting to index');
    return res.redirect('/index.html'); // Redirect to index if user is not logged in and not accessing allowed routes
  }
  
  next(); // User is logged in or accessing allowed routes, continue
});

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

// Home route after login
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Register route
app.get('/register', async (req, res) => {
  const { username, password, firstName, lastName, resetQuestion, resetAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Insert user into the 'User' table
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('firstName', sql.VarChar(50), firstName)
      .input('lastName', sql.VarChar(50), lastName)
      .input('password', sql.VarChar(255), password) // Assuming password is hashed
      .input('resetQuestion', sql.VarChar(255), resetQuestion)
      .input('resetAnswer', sql.VarChar(255), resetAnswer)
      .query('INSERT INTO [User] (Username, FirstName, LastName, Password, PasswordResetQuestion, PasswordResetAnswer) VALUES (@username, @firstName, @lastName, @password, @resetQuestion, @resetAnswer)');

    res.status(200).send('Registration successful');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

/// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await sql.connect(config);

    // Query the database to check if the user exists
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('password', sql.VarChar(255), password) // Assuming password is hashed
      .query('SELECT * FROM [User] WHERE Username = @username AND Password = @password');

    if (result.recordset.length > 0) {
      // User authenticated successfully
      req.session.user = username; // Set session user
      console.log('User logged in:', username);
      res.redirect('/home');
    } else {
      // User not found or invalid credentials
      console.log('Invalid credentials for username:', username);
      res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) {
      console.error('Error logging out:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    } else {
      console.log('User logged out');
      res.sendStatus(200);
    }
  });
});

// Register post route
app.post('/register', async (req, res) => {
  const { username, password, firstName, lastName, resetQuestion, resetAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Insert user into the 'User' table
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('firstName', sql.VarChar(50), firstName)
      .input('lastName', sql.VarChar(50), lastName)
      .input('password', sql.VarChar(50), password)
      .input('resetQuestion', sql.VarChar(255), resetQuestion)
      .input('resetAnswer', sql.VarChar(255), resetAnswer)
      .query('INSERT INTO [User] (Username, FirstName, LastName, Password, PasswordResetQuestion, PasswordResetAnswer) VALUES (@username, @firstName, @lastName, @password, @resetQuestion, @resetAnswer)');

    res.status(200).send('Registration successful');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Password reset route
app.post('/resetPassword', async (req, res) => {
  const { username, resetQuestion, resetAnswer, newPassword } = req.body;

  try {
    const pool = await sql.connect(config);

    // Check if the user exists and the answer matches the reset question
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('resetQuestion', sql.VarChar(255), resetQuestion)
      .input('resetAnswer', sql.VarChar(255), resetAnswer)
      .query('SELECT * FROM [User] WHERE Username = @username AND PasswordResetQuestion = @resetQuestion AND PasswordResetAnswer = @resetAnswer');

    if (result.recordset.length > 0) {
      // Update the user's password in the database with the new password
      await pool.request()
        .input('username', sql.VarChar(50), username)
        .input('newPassword', sql.VarChar(255), newPassword) // Assuming password is hashed
        .query('UPDATE [User] SET Password = @newPassword WHERE Username = @username');

      res.status(200).json({ message: 'Password reset successful.' });
    } else {
      res.status(400).json({ message: 'Invalid username, security question, or answer.' });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to fetch password reset questions
app.get('/passwordResetQuestions', async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query('SELECT Question FROM PasswordResetQuestions');
    const questions = result.recordset.map(record => record.Question);

    res.json(questions);
  } catch (error) {
    console.error('Error fetching password reset questions:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Trucks API endpoint
app.get('/api/trucks', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT * FROM TruckInfo');
    const trucksData = result.recordset;
    res.json(Array.isArray(trucksData) ? trucksData : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
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
    trailer,
    flatbedLength,
    equipmentNumber,
    fuelMileage,
    fuelCapacity,
  } = req.body;

  try {
    await sql.connect(config);
    await sql.query`
      INSERT INTO TruckInfo (Year, Make, Model, TareWeight, Plate, Trailer, FlatbedLength, EquipmentNumber, FuelMileage, FuelCapacity) 
      VALUES (${year}, ${make}, ${model}, ${tareWeight}, ${plate}, ${trailer}, ${flatbedLength}, ${equipmentNumber}, ${fuelMileage}, ${fuelCapacity})
    `;
    res.status(200).send('Truck added successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  } finally {
    sql.close();
  }
});

// Additional route to fetch truck by plate number
app.get('/api/trucks/:plate', async (req, res) => {
  const plateNumber = req.params.plate;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('plateNumber', sql.VarChar(10), plateNumber)
      .query('SELECT * FROM TruckInfo WHERE Plate = @plateNumber');
    const truckInfo = result.recordset[0];
    res.json(truckInfo || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    if (sql) {
      sql.close();
    }
  }
});

// Trucks route for API
app.get('/api/trucks', async (req, res) => {
  const plateNumber = req.query.plate;
  try {
      // Establish a connection to the SQL Server
      const pool = await sql.connect(config);

      // Fetch data from the database based on plate number
      const result = await pool.request()
          .input('plateNumber', sql.VarChar(10), plateNumber)
          .query('SELECT * FROM TruckInfo WHERE Plate = @plateNumber');
      const truckInfo = result.recordset[0]; // Assuming there's only one truck with the given plate number

      // Send JSON response
      res.json(truckInfo || {});
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

// Weather route
app.get('/weather', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'weather.html'));
});

// Account route
app.get('/acount', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// Route to fetch basic user information
app.get('/api/user', async (req, res) => {
  const username = req.session.user; // Retrieve username from session

  try {
    const pool = await sql.connect(config);

    const result = await pool.request()
      .input('username', sql.VarChar(20), username)
      .query('SELECT Username, FirstName, LastName FROM [User] WHERE Username = @username');

    const userData = result.recordset[0];
    res.json(userData || {});
  } catch (error) {
    console.error('Error fetching user information:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to update user information
app.put('/api/user', async (req, res) => {
  const { firstName, lastName } = req.body;
  const username = req.session.user; // Retrieve username from session

  try {
    const pool = await sql.connect(config);

    await pool.request()
      .input('username', sql.VarChar(20), username)
      .input('firstName', sql.VarChar(20), firstName)
      .input('lastName', sql.VarChar(20), lastName)
      .query('UPDATE [User] SET FirstName = @firstName, LastName = @lastName WHERE Username = @username');

    res.status(200).json({ message: 'User information updated successfully.' });
  } catch (error) {
    console.error('Error updating user information:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to reset password by entering current password
app.post('/resetPasswordWithCurrent', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const pool = await sql.connect(config);

    // Check if the current password matches the one in the database
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('currentPassword', sql.VarChar(255), currentPassword)
      .query('SELECT * FROM [User] WHERE Username = @username AND Password = @currentPassword');

    if (result.recordset.length > 0) {
      // Update the user's password in the database with the new password
      await pool.request()
        .input('username', sql.VarChar(50), username)
        .input('newPassword', sql.VarChar(255), newPassword) // Assuming password is hashed
        .query('UPDATE [User] SET Password = @newPassword WHERE Username = @username');

      res.status(200).json({ message: 'Password reset successful.' });
    } else {
      res.status(400).json({ message: 'Invalid current password.' });
    }
  } catch (error) {
    console.error('Error resetting password with current password:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to update password reset question and answer
app.put('/updateResetQuestion', async (req, res) => {
  const { username, resetQuestion, resetAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Update the user's password reset question and answer in the database
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('resetQuestion', sql.Int, resetQuestion)
      .input('resetAnswer', sql.VarChar(255), resetAnswer)
      .query('UPDATE [User] SET PasswordResetQuestion = @resetQuestion, PasswordResetAnswer = @resetAnswer WHERE Username = @username');

    res.status(200).json({ message: 'Password reset question and answer updated successfully.' });
  } catch (error) {
    console.error('Error updating password reset question and answer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});