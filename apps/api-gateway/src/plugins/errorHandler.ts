import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import fp from 'fastify-plugin';
export const createResponse = (req: FastifyRequest, success: boolean, payload: any) => {
  return {
    success,
    requestId: req.id,
    [success ? 'data' : 'error']: payload,
  };
};


async function errorHandlerPlugin(server: FastifyInstance) {
  server.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {

    // Global log Error. (for tracing internally)
    server.log.error({ reqId: request.id, err: error }, 'Global Error Intercepted');

    //Validation Error
    if (error.validation) {
      return reply.status(400).send(
        createResponse(request, false, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: error.validation,
        })
      );
    }

    // Rate Limit
    if (error.statusCode === 429) {
      return reply.status(429).send(
        createResponse(request, false, {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You have exceeded the rate limit. Please try again later.',
        })
      );
    }

    const statusCode = error.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    return reply.status(statusCode).send(
      createResponse(request, false, {
        code: isClientError ? 'CLIENT_ERROR' : 'INTERNAL_SERVER_ERROR',
        message: isClientError ? error.message : 'An unexpected internal error occurred.',
      })
    );
  });
}
export default fp(errorHandlerPlugin);
