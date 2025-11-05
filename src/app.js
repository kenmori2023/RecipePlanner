require('dotenv').config();
require('./db'); 

const path = require('path');
const express = require('express');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.send('<h1>Hello, CS348 Recipe Planner! 🍳</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));