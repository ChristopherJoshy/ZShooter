import fp from 'fastify-plugin';
import mongoose from 'mongoose';
import type { FastifyInstance } from 'fastify';

// Connects Mongoose to MongoDB and tears down cleanly on close.
async function mongodbPlugin(fastify: FastifyInstance) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env variable is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  fastify.log.info('MongoDB connected');

  fastify.addHook('onClose', async () => {
    await mongoose.connection.close();
    fastify.log.info('MongoDB connection closed');
  });
}

export default fp(mongodbPlugin, { name: 'mongodb' });
