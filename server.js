const express = require('express');
const axios = require('axios');
const app = express();

// CORS per TypingMind
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint per tutti i file del plugin
app.get('/plugin-files', async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  try {
    console.log('Fetching repository files...');
    
    // Ottieni lista file
    const treeResponse = await axios.get(
      'https://api.github.com/repos/VerbaManent/jemini/git/trees/main?recursive=1',
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Render-API'
        }
      }
    );

    const files = treeResponse.data.tree.filter(item => item.type === 'blob');
    
    // Leggi contenuto file principali
    const importantFiles = files.filter(file => {
      const name = file.path.toLowerCase();
      return name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.css') || name.endsWith('.md');
    });

    const fileContents = await Promise.all(
      importantFiles.slice(0, 8).map(async (file) => {
        try {
          const contentResponse = await axios.get(
            `https://api.github.com/repos/VerbaManent/jemini/contents/${file.path}`,
            {
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );

          const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf8');
          
          return {
            path: file.path,
            name: file.path.split('/').pop(),
            content: content.length > 1500 ? content.substring(0, 1500) + '\n...[truncated]' : content,
            type: file.path.split('.').pop(),
            size: file.size
          };
        } catch (error) {
          return { path: file.path, error: 'Could not read content' };
        }
      })
    );

    res.json({
      repository: 'VerbaManent/jemini',
      lastUpdated: new Date().toISOString(),
      totalFiles: files.length,
      loadedFiles: fileContents.filter(f => !f.error).length,
      files: fileContents
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch repository data',
      details: error.message 
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Jemini Plugin API is running!', 
    endpoints: ['/plugin-files'],
    timestamp: new Date() 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
