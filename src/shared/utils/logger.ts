import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const baseConfig = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: (): string => `,"time":"${new Date().toISOString()}"`,
};

const developmentConfig = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
};

export const logger = isDevelopment ? pino(developmentConfig) : pino(baseConfig);

export default logger;
