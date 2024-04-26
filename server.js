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
  secret: crypto.randomBytes(64).toString('hex'), 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Check if user is logged in middleware
app.use((req, res, next) => {
  const allowedRoutes = /^(\/|\/register|\/reset_password)/;

  if (!req.session.user && !allowedRoutes.test(req.url)) {
    return res.redirect('/index.html'); 
  }
  
  next(); 
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
// Login route
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
      res.redirect('/home');
    } else {
      // User not found or invalid credentials
      res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Register route
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', async (req, res) => {
  const { username, password, firstName, lastName, resetQuestion, resetAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Get the ID of the selected question
    const questionResult = await pool.request()
      .input('resetQuestionText', sql.VarChar(255), resetQuestion)
      .query('SELECT ID FROM PasswordResetQuestions WHERE Question = @resetQuestionText');

    if (questionResult.recordset.length === 0) {
      // Question not found, handle appropriately
      return res.status(400).send('Invalid reset question');
    }

    const questionID = questionResult.recordset[0].ID;

    // Insert user into the 'User' table
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('firstName', sql.VarChar(50), firstName)
      .input('lastName', sql.VarChar(50), lastName)
      .input('password', sql.VarChar(255), password) // Assuming password is hashed
      .input('resetQuestion', sql.Int, questionID) // Use the ID of the selected question
      .input('resetAnswer', sql.VarChar(255), resetAnswer)
      .query('INSERT INTO [User] (Username, FirstName, LastName, Password, PasswordResetQuestion, PasswordResetAnswer) VALUES (@username, @firstName, @lastName, @password, @resetQuestion, @resetAnswer)');

    res.status(200).send('Registration successful');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle fetching password reset questions
app.get('/passwordResetQuestions', async (req, res) => {
  try {
    const pool = await sql.connect(config);

    // Query the database to fetch password reset questions
    const result = await pool.request().query('SELECT Question FROM PasswordResetQuestions');

    // Extract the questions from the result
    const questions = result.recordset.map(row => row.Question);

    // Send the questions as a JSON response
    res.json(questions);
  } catch (error) {
    console.error('Error fetching password reset questions:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//Password reset page
// Route to validate security question and answer before allowing password reset
app.post('/validate_security', async (req, res) => {
  const { username, resetQuestion, resetAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Query the database to retrieve the stored security question and answer
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .query('SELECT PasswordResetQuestion, PasswordResetAnswer FROM [User] WHERE Username = @username');

    if (result.recordset.length === 0) {
      // User not found
      return res.status(404).json({ message: 'User not found' });
    }

    const storedQuestion = result.recordset[0].PasswordResetQuestion;
    const storedAnswer = result.recordset[0].PasswordResetAnswer;

    // Compare the provided security question and answer with the stored values
    if (resetQuestion === storedQuestion && resetAnswer === storedAnswer) {
      // Security question and answer are correct, allow password reset
      res.status(200).json({ message: 'Security question and answer validated successfully' });
    } else {
      // Incorrect security question or answer
      res.status(401).json({ message: 'Incorrect security question or answer' });
    }
  } catch (error) {
    console.error('Error validating security question and answer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle password reset
app.post('/reset_password', async (req, res) => {
  const { username, newPassword } = req.body;
  const { resetQuestion, resetAnswer } = req.body; // Add this line to get the resetQuestion and resetAnswer from the request body

  try {
    const pool = await sql.connect(config);

    // Update the password in the 'User' table
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('newPassword', sql.VarChar(255), newPassword) // Assuming password is hashed
      .query('UPDATE [User] SET Password = @newPassword WHERE Username = @username');

    res.status(200).send('Password reset successful');
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Home route
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

//Brokers Page Routes
// Brokers route
app.get('/brokers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'brokers.html'));
});

// Route to handle adding a new broker
app.post('/addBroker', async (req, res) => {
  const { Name, Factorable, WorkWithAgain, Notes, POC, POCNumber, POCEmail } = req.body;
  const username = req.session.user;
  let transaction; // Declare the transaction variable outside the try block

  try {
    const pool = await sql.connect(config);

    // Begin a transaction
    transaction = await pool.transaction();

    // Begin the transaction explicitly
    await transaction.begin();

    // Insert the new broker into the 'Brokers' table
    const result = await transaction.request()
      .input('Name', sql.VarChar(50), Name)
      .input('Factorable', sql.Bit, Factorable)
      .input('WorkWithAgain', sql.Bit, WorkWithAgain)
      .input('Notes', sql.VarChar(100), Notes)
      .input('POC', sql.VarChar(50), POC)
      .input('POCNumber', sql.Char(15), POCNumber)
      .input('POCEmail', sql.VarChar(50), POCEmail)
      .query('INSERT INTO Brokers (Name, Factorable, WorkWithAgain, Notes, POC, POCNumber, POCEmail) OUTPUT INSERTED.ID VALUES (@Name, @Factorable, @WorkWithAgain, @Notes, @POC, @POCNumber, @POCEmail)');

    const brokerID = result.recordset[0].ID;

    // Associate the new broker with the logged-in user in the 'UserBrokers' table
    await transaction.request()
      .input('Username', sql.VarChar(20), username)
      .input('BrokerID', sql.Int, brokerID) // Use the ID of the newly inserted broker
      .query('INSERT INTO UserBrokers (Username, BrokerID) VALUES (@Username, @BrokerID)');

    // Commit the transaction
    await transaction.commit();

    res.status(200).send('Broker added successfully');
  } catch (error) {
    console.error('Error adding new broker:', error);

    // Rollback the transaction in case of error
    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle fetching brokers data
app.get('/api/brokers', async (req, res) => {
  const username = req.session.user;

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch brokers associated with the logged-in user
    const result = await pool.request()
      .input('username', sql.VarChar(20), username)
      .query(`
        SELECT b.*
        FROM Brokers b
        INNER JOIN UserBrokers ub ON b.ID = ub.BrokerID
        WHERE ub.Username = @username
      `);

    // Extract the brokers from the result
    const brokers = result.recordset;

    // Send the brokers data as a JSON response
    res.json(brokers);
  } catch (error) {
    console.error('Error fetching brokers data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle updating a broker by ID
app.put('/api/brokers/:id', async (req, res) => {
  const id = req.params.id;
  const { Name,Factorable, WorkWithAgain, Notes, POC, POCNumber, POCEmail } = req.body;

  try {
    const pool = await sql.connect(config);

    await pool.request()
      .input('ID', sql.Int, id)
      .input('Name', sql.VarChar(50), Name)
      .input('Factorable', sql.Bit, Factorable)
      .input('WorkWithAgain', sql.Bit, WorkWithAgain)
      .input('Notes', sql.VarChar(100), Notes)
      .input('POC', sql.VarChar(50), POC)
      .input('POCNumber', sql.Char(15), POCNumber)
      .input('POCEmail', sql.VarChar(50), POCEmail)
      .query(`
        UPDATE Brokers
        SET Name = @Name,
            Factorable = @Factorable,
            WorkWithAgain = @WorkWithAgain,
            Notes = @Notes,
            POC = @POC,
            POCNumber = @POCNumber,
            POCEmail = @POCEmail
        WHERE ID = @ID
      `);

    res.status(200).send('Broker updated successfully');
  } catch (error) {
    // Log the error to console
    console.error('Error updating broker:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Route to handle fetching a broker by ID
app.get('/api/brokers/:id', async (req, res) => {
  const brokerId = req.params.id;

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch the details of the broker by ID
    const result = await pool.request()
      .input('id', sql.Int, brokerId)
      .query('SELECT * FROM Brokers WHERE ID = @id');

    if (result.recordset.length === 0) {
      // No broker found with the provided ID
      return res.status(404).json({ message: 'Broker not found' });
    }

    // Broker found, send the broker details as a JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching broker details by ID:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Route to handle deleting a broker by ID
app.delete('/deleteBroker/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const pool = await sql.connect(config);

    await pool.request()
      .input('ID', sql.Int, id)
      .query('DELETE FROM Brokers WHERE ID = @ID');

    res.status(200).send('Broker deleted successfully');
  } catch (error) {
    console.error('Error deleting broker:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//Trucks Page Routes
// Trucks route
app.get('/trucks', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'trucks.html'));
});

// Route to handle adding a new truck
app.post('/api/trucks', async (req, res) => {
  const { Year, Make, Model, TareWeight, Plate, Trailer, FlatbedLength, EquipmentNumber, FuelMileage, FuelCapacity } = req.body;
  const username = req.session.user; // Get the username of the logged-in user

  try {
    const pool = await sql.connect(config);

    // Insert the new truck information into the 'TruckInfo' table
    const result = await pool.request()
      .input('Year', sql.Char(4), Year)
      .input('Make', sql.VarChar(15), Make)
      .input('Model', sql.VarChar(15), Model)
      .input('TareWeight', sql.Numeric(18, 0), TareWeight)
      .input('Plate', sql.Char(10), Plate)
      .input('Trailer', sql.VarChar(15), Trailer)
      .input('FlatbedLength', sql.Char(4), FlatbedLength)
      .input('EquipmentNumber', sql.Char(5), EquipmentNumber)
      .input('FuelMileage', sql.Char(3), FuelMileage)
      .input('FuelCapacity', sql.Char(4), FuelCapacity)
      .query('INSERT INTO TruckInfo (Year, Make, Model, TareWeight, Plate, Trailer, FlatbedLength, EquipmentNumber, FuelMileage, FuelCapacity) VALUES (@year, @make, @model, @tareWeight, @plate, @trailer, @flatbedLength, @equipmentNumber, @fuelMileage, @fuelCapacity); SELECT SCOPE_IDENTITY() AS TruckID');

    const TruckID = result.recordset[0].TruckID;

    // Link the new truck to the logged-in user in the 'UserTruck' table
    await pool.request()
      .input('username', sql.VarChar(20), username)
      .input('TruckID', sql.Int, TruckID)
      .query('INSERT INTO UserTruck (Username, TruckID) VALUES (@username, @truckID)');

    res.status(200).send('Truck added successfully');
  } catch (error) {
    console.error('Error adding new truck:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle fetching truck data
app.get('/api/trucks', async (req, res) => {
  const username = req.session.user;

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch trucks associated with the logged-in user
    const result = await pool.request()
      .input('username', sql.VarChar(20), username)
      .query(`
        SELECT b.*
        FROM TruckInfo b
        INNER JOIN UserTruck ub ON b.TruckID = ub.TruckID
        WHERE ub.Username = @username
      `);

    // Extract the trucks from the result
    const trucks = result.recordset;

    // Send the trucks data as a JSON response
    res.json(trucks);
  } catch (error) {
    console.error('Error fetching tucks data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle updating a truck by ID
app.put('/api/trucks/:id', async (req, res) => {
  const TruckID = req.params.id;
  const { Year, Make, Model, TareWeight, Plate, Trailer, FlatbedLength, EquipmentNumber, FuelMileage, FuelCapacity } = req.body;

  try {
    const pool = await sql.connect(config);

    await pool.request()
      .input('TruckID', sql.Int, TruckID) 
      .input('Year', sql.Char(4), Year)
      .input('Make', sql.VarChar(15), Make)
      .input('Model', sql.VarChar(15), Model)
      .input('TareWeight', sql.Numeric(18, 0), TareWeight)
      .input('Plate', sql.Char(10), Plate)
      .input('Trailer', sql.VarChar(15), Trailer)
      .input('FlatbedLength', sql.Char(4), FlatbedLength)
      .input('EquipmentNumber', sql.Char(5), EquipmentNumber)
      .input('FuelMileage', sql.Char(3), FuelMileage)
      .input('FuelCapacity', sql.Char(4), FuelCapacity)
      .query(`
        UPDATE TruckInfo
        SET Year = @Year,
        Make = @Make,
        Model = @Model,
        TareWeight = @TareWeight,
        Plate = @Plate,
        Trailer = @Trailer,
        FlatbedLength = @FlatbedLength,
        EquipmentNumber = @EquipmentNumber,
        FuelMileage = @FuelMileage,
        FuelCapacity = @FuelCapacity
        WHERE TruckID = @TruckID
      `);

    res.status(200).send('Truck updated successfully');
  } catch (error) {
    // Log the error to console
    console.error('Error updating truck:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to handle fetching a truck by ID
app.get('/api/trucks/:id', async (req, res) => {
  const TruckID = req.params.id;

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch the details of the truck by ID
    const result = await pool.request()
      .input('TruckID', sql.Int, TruckID)
      .query('SELECT * FROM TruckInfo WHERE TruckID = @TruckID');

    if (result.recordset.length === 0) {
      // No truck found with the provided ID
      return res.status(404).json({ message: 'Truck not found' });
    }

    // Truck found, send the truck details as a JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching truck details by ID:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Route to handle deleting a truck by ID
app.delete('/deleteTruck/:id', async (req, res) => {
  const TruckID = req.params.id;

  try {
    const pool = await sql.connect(config);

    await pool.request()
      .input('TruckID', sql.Int, TruckID)
      .query('DELETE FROM TruckInfo WHERE TruckID = @TruckID');

    res.status(200).send('Truck deleted successfully');
  } catch (error) {
    console.error('Error deleting truck:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//Load Page Routes
// Load route
app.get('/load', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'load.html'));
});

// Route to handle fetching truck information by plate number
app.get('/api/trucks', async (req, res) => {
  const plateNumber = req.query.plate;

  if (!plateNumber) {
    return res.status(400).json({ message: 'Plate number is required' });
  }

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch truck information by plate number
    const result = await pool.request()
      .input('plateNumber', sql.Char(10), plateNumber)
      .query('SELECT * FROM TruckInfo WHERE Plate = @plateNumber');

    if (result.recordset.length === 0) {
      // No truck found with the provided plate number
      return res.status(404).json({ message: 'Truck not found' });
    }

    // Truck found, send the truck information as a JSON response
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching truck information:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



//Account Page Routes
// Account route
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

// Route to get user information
app.get('/getUserInfo', async (req, res) => {
  const username = req.session.user;

  try {
    const pool = await sql.connect(config);

    // Query the database to fetch user information based on the username
    const result = await pool.request()
      .input('username', sql.VarChar(20), username)
      .query('SELECT * FROM [User] WHERE Username = @username');

    if (result.recordset.length > 0) {
      // User found, send the user information as a JSON response
      const userData = result.recordset[0];
      res.json({
        username: userData.Username,
        firstName: userData.FirstName,
        lastName: userData.LastName
      });
    } else {
      // User not found
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user information:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to update user information
app.put('/updateUserInfo', async (req, res) => {
  const { username, firstName, lastName } = req.body;

  try {
    const pool = await sql.connect(config);

    // Update user information in the database
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('firstName', sql.VarChar(50), firstName)
      .input('lastName', sql.VarChar(50), lastName)
      .query('UPDATE [User] SET FirstName = @firstName, LastName = @lastName WHERE Username = @username');

    res.status(200).send('User information updated successfully');
  } catch (error) {
    console.error('Error updating user information:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to reset user password
app.post('/resetPassword', async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const pool = await sql.connect(config);

    // Update user password in the database
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('newPassword', sql.VarChar(255), newPassword) // Assuming password is hashed
      .query('UPDATE [User] SET Password = @newPassword WHERE Username = @username');

    res.status(200).send('Password reset successful');
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to update user security question and answer
app.put('/updateSecurityQuestion', async (req, res) => {
  const { username, newQuestion, newAnswer } = req.body;

  try {
    const pool = await sql.connect(config);

    // Update user security question and answer in the database
    await pool.request()
      .input('username', sql.VarChar(50), username)
      .input('newQuestion', sql.VarChar(255), newQuestion)
      .input('newAnswer', sql.VarChar(255), newAnswer)
      .query('UPDATE [User] SET PasswordResetQuestion = @newQuestion, PasswordResetAnswer = @newAnswer WHERE Username = @username');

    res.status(200).send('Security question and answer updated successfully');
  } catch (error) {
    console.error('Error updating security question and answer:', error);
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
