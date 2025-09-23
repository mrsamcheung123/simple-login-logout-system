const express = require('express');
const session = require('express-session');
const { MongoClient, ServerApiVersion } = require('mongodb');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection URI
const uri = "mongodb+srv://admin:admin@cluster0.r2esjwt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: uri,
    dbName: 'loginSystem'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Set view engine
app.set('view engine', 'ejs');

// Database connection and collection references
let db;
let usersCollection;

// Connect to MongoDB
async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db("loginSystem");
    usersCollection = db.collection("users");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find the user in the database
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    // Store user in session (without password)
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'An error occurred during login' });
  }
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    
    if (existingUser) {
      return res.render('register', { error: 'Email already in use' });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create a new user
    const newUser = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    // Insert the user into the database
    await usersCollection.insertOne(newUser);
    
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'An error occurred during registration' });
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('dashboard', { user: req.session.user });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return console.error(err);
    }
    res.redirect('/');
  });
});

// Start the server
app.listen(PORT, async () => {
  await connectToMongo();
  console.log(`Server is running on port ${PORT}`);
});