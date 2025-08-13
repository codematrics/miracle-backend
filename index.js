const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patient');
const serviceRoutes = require('./routes/service');
const visitRoutes = require('./routes/visit');
const enumRoutes = require('./routes/enums');
const { securityMiddleware, authLimiter, apiLimiter } = require('./middleware/security');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(securityMiddleware);

app.use(morgan('combined', {
  format: ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
}));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalmanagement')
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patients', apiLimiter, patientRoutes);
app.use('/api/services', apiLimiter, serviceRoutes);
app.use('/api/visits', apiLimiter, visitRoutes);
app.use('/api/enums', enumRoutes);

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${req.method} ${req.path}`);
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500
  });
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hospital Management System API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});