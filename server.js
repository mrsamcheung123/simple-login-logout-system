const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const uri = "mongodb+srv://admin:admin@cluster0.r2esjwt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});
let db, usersCollection, itemsCollection;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  secret: 'notasecret',
  resave: false,
  saveUninitialized: true
}));

function checkAuth(req, res, next) {
  if (req.session.userid) next();
  else res.redirect('/login');
}

// Connect to MongoDB and start server
client.connect().then(() => {
  db = client.db('simplelogin');
  usersCollection = db.collection('users');
  itemsCollection = db.collection('items');
  // Add a default user if not exists (userid: user, password: pass)
  usersCollection.findOne({ userid: "user" }).then(user => {
    if (!user) usersCollection.insertOne({ userid: "user", password: "pass" });
  });
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(console.error);

// Routes

// Home
app.get('/', (req, res) => {
  if (!req.session.userid) return res.redirect('/login');
  res.render('index', { userid: req.session.userid });
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', { message: "" });
});

// Login POST
app.post('/login', async (req, res) => {
  const { userid, password } = req.body;
  const user = await usersCollection.findOne({ userid, password });
  if (user) {
    req.session.userid = userid;
    res.redirect('/');
  } else {
    res.render('login', { message: "Invalid credentials" });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// CRUD UI
app.get('/items', checkAuth, async (req, res) => {
  const q = req.query.q || "";
  let query = {};
  if (q) query.name = { $regex: q, $options: "i" };
  const items = await itemsCollection.find(query).toArray();
  res.render('items', { items, q });
});

// Create Item (UI)
app.post('/items', checkAuth, async (req, res) => {
  await itemsCollection.insertOne({ name: req.body.name });
  res.redirect('/items');
});

// Delete Item (UI)
app.post('/items/delete/:id', checkAuth, async (req, res) => {
  await itemsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.redirect('/items');
});

// RESTful API (CRUD)
// Create
app.post('/api/items', async (req, res) => {
  const { name } = req.body;
  const result = await itemsCollection.insertOne({ name });
  res.json({ insertedId: result.insertedId });
});
// Read all
app.get('/api/items', async (req, res) => {
  const items = await itemsCollection.find().toArray();
  res.json(items);
});
// Update
app.put('/api/items/:id', bodyParser.json(), async (req, res) => {
  const { name } = req.body;
  await itemsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { name } });
  res.json({ status: "updated" });
});
// Delete
app.delete('/api/items/:id', async (req, res) => {
  await itemsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ status: "deleted" });
});