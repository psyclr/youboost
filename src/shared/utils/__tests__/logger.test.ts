import { createServiceLogger, createRequestLogger, logger } from '../logger';

describe('Logger', () => {
  describe('base logger', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have standard log methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('createServiceLogger', () => {
    it('should create a child logger with service name', () => {
      const serviceLogger = createServiceLogger('auth-service');

      expect(serviceLogger).toBeDefined();
      expect(typeof serviceLogger.info).toBe('function');
      expect(typeof serviceLogger.error).toBe('function');
    });

    it('should include service name in bindings', () => {
      const serviceLogger = createServiceLogger('order-service');
      const bindings = serviceLogger.bindings();

      expect(bindings.service).toBe('order-service');
    });
  });

  describe('createRequestLogger', () => {
    it('should create a child logger with request ID', () => {
      const requestLogger = createRequestLogger('req-123');

      expect(requestLogger).toBeDefined();
      expect(typeof requestLogger.info).toBe('function');
    });

    it('should include request ID in bindings', () => {
      const requestLogger = createRequestLogger('req-456');
      const bindings = requestLogger.bindings();

      expect(bindings.requestId).toBe('req-456');
    });
  });
});
