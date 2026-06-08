/**
 * @fileoverview MongoDB connection configuration using Mongoose.
 * Establishes and manages the database connection lifecycle with
 * proper error handling and event listeners.
 */

import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB using the URI from environment variables.
 * Sets up connection event listeners for monitoring and graceful shutdown.
 *
 * @async
 * @function connectDB
 * @returns {Promise<mongoose.Connection>} The Mongoose connection instance.
 * @throws {Error} If the initial connection attempt fails.
 */
const connectDB = async () => {
  try {
    console.log(env.MONGODB_URI);
    const conn = await mongoose.connect(env.MONGODB_URI, {
      // Mongoose 8 uses the new URL parser and unified topology by default.
      // Additional options can be added here as needed.
      autoIndex: env.NODE_ENV !== 'production', // Disable auto-index in production for performance
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    // ── Connection Event Listeners ─────────────────────────────────────
    mongoose.connection.on('connected', () => {
      console.log('📡 Mongoose connection established.');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`❌ Mongoose connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  Mongoose connection disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Mongoose reconnected to MongoDB.');
    });

    // ── Graceful Shutdown ──────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Closing MongoDB connection...`);
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination.');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    return conn.connection;
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
