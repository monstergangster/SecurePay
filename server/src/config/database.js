const mongoose = require('mongoose');
const logger = require('./logger');

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to connect to the database.');

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
      .then((conn) => {
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        logger.error(`MongoDB connection error: ${error.message}`);
        throw error;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
