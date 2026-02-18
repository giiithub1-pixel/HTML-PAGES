const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://topan1:topan123@cluster0.opkrxgr.mongodb.net/pagecraft?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public')); // Serve frontend files

// Page Schema
const pageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  html: { type: String, required: true },
  adminToken: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

const Page = mongoose.model('Page', pageSchema);

// ────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ────────────────────────────────────────────────────────────────────────────

// Get all pages (returns basic info without HTML for dashboard)
app.get('/api/pages', async (req, res) => {
  try {
    const pages = await Page.find({}, { html: 0, adminToken: 0 }).sort({ updatedAt: -1 });
    res.json({ success: true, pages });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pages' });
  }
});

// Get single page by slug (public view - no auth needed)
app.get('/api/page/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug }, { adminToken: 0 });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// Get page with admin verification
app.get('/api/page/:slug/:token', async (req, res) => {
  try {
    const { slug, token } = req.params;
    const page = await Page.findOne({ slug });
    
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    
    if (page.adminToken !== token) {
      return res.status(403).json({ success: false, error: 'Invalid admin token' });
    }
    
    res.json({ success: true, page });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// Create new page
app.post('/api/pages', async (req, res) => {
  try {
    const { id, title, slug, html, adminToken, createdAt, updatedAt } = req.body;
    
    // Validation
    if (!title || !slug || !html) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Check if slug already exists
    const existing = await Page.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Slug already taken' });
    }
    
    const page = new Page({
      id: id || crypto.randomUUID(),
      title,
      slug,
      html,
      adminToken: adminToken || crypto.randomBytes(18).toString('hex'),
      createdAt: createdAt || new Date().toLocaleString(),
      updatedAt: updatedAt || new Date().toLocaleString(),
    });
    
    await page.save();
    
    res.json({ 
      success: true, 
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        adminToken: page.adminToken,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({ success: false, error: 'Failed to create page' });
  }
});

// Update page (requires admin token)
app.put('/api/page/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, html, adminToken, newSlug } = req.body;
    
    if (!adminToken) {
      return res.status(403).json({ success: false, error: 'Admin token required' });
    }
    
    const page = await Page.findOne({ slug });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    
    if (page.adminToken !== adminToken) {
      return res.status(403).json({ success: false, error: 'Invalid admin token' });
    }
    
    // Check if new slug is taken
    if (newSlug && newSlug !== slug) {
      const existing = await Page.findOne({ slug: newSlug });
      if (existing) {
        return res.status(400).json({ success: false, error: 'New slug already taken' });
      }
      page.slug = newSlug;
    }
    
    if (title) page.title = title;
    if (html) page.html = html;
    page.updatedAt = new Date().toLocaleString();
    
    await page.save();
    
    res.json({ 
      success: true, 
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        adminToken: page.adminToken,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      }
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

// Delete page (requires admin token)
app.delete('/api/page/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { adminToken } = req.body;
    
    if (!adminToken) {
      return res.status(403).json({ success: false, error: 'Admin token required' });
    }
    
    const page = await Page.findOne({ slug });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    
    if (page.adminToken !== adminToken) {
      return res.status(403).json({ success: false, error: 'Invalid admin token' });
    }
    
    await Page.deleteOne({ slug });
    
    res.json({ success: true, message: 'Page deleted' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ success: false, error: 'Failed to delete page' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'Server is running', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET    /api/health`);
  console.log(`   GET    /api/pages`);
  console.log(`   GET    /api/page/:slug`);
  console.log(`   POST   /api/pages`);
  console.log(`   PUT    /api/page/:slug`);
  console.log(`   DELETE /api/page/:slug`);
});
  
