import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import path from 'path';

export default async function app(server: FastifyInstance, opts: any) {
  // 1. Autoload Infrastructure Plugins (Security, Error Handlers, DB connections)
  // These are loaded first so that routes can use them.
  await server.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts),
  });

  // 2. Autoload Domain Modules (Routes and Business Logic)
  // Encapsulated by default, prefixed with /api
  await server.register(AutoLoad, {
    dir: path.join(__dirname, 'modules'),
    options: Object.assign({ prefix: '/api' }, opts),
  });
}
