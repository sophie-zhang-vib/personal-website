const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the docs directory (also deployable to GitHub Pages)
app.use(express.static(path.join(__dirname, 'docs')));

// Friendly clean URLs: /resume, /projects, /contact -> .html
const cleanRoutes = ['resume', 'projects', 'contact'];
cleanRoutes.forEach((route) => {
  app.get('/' + route, (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', route + '.html'));
  });
});

// Fallback to homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Personal website is running at http://localhost:${PORT}`);
});
