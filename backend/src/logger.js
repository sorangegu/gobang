// 日志模块 - 使用 Winston

const winston = require('winston');
const path = require('path');

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// 创建 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'gobang-backend' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// 确保日志目录存在
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
