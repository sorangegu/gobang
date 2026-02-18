// Redis 连接模块
// 用于存储房间状态，支持服务器重启后恢复

const { createClient } = require('redis');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.connected = false;
    // 从环境变量读取 Redis 配置，支持自定义
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: 'gobang:'
    };
  }

  async connect() {
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          // Redis 不可达时快速失败，避免阻塞服务启动
          connectTimeout: 3000,
          reconnectStrategy: () => false
        },
        password: this.config.password,
        database: this.config.db
      });

      this.client.on('error', (err) => {
        logger.error(`Redis 连接错误: ${err.message}`);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis 连接成功');
        this.connected = true;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis 重新连接中...');
        this.connected = false;
      });

      await this.client.connect();
      logger.info(`Redis 已连接：${this.config.host}:${this.config.port}`);
      return true;
    } catch (error) {
      logger.error(`Redis 连接失败，使用内存存储: ${error.message}`);
      this.connected = false;
      // 连接失败后主动释放 client，避免后续误用
      this.client = null;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis 已断开连接');
    }
  }

  // 生成房间键
  _roomKey(roomId) {
    return `${this.config.keyPrefix}room:${roomId}`;
  }

  // 保存房间状态
  async saveRoom(roomId, roomData) {
    if (!this.connected) return false;
    try {
      const key = this._roomKey(roomId);
      await this.client.setEx(key, 86400, JSON.stringify(roomData)); // 24 小时过期
      logger.debug(`房间 ${roomId} 已保存到 Redis`);
      return true;
    } catch (error) {
      logger.error('保存房间到 Redis 失败:', error.message);
      return false;
    }
  }

  // 获取房间状态
  async getRoom(roomId) {
    if (!this.connected) return null;
    try {
      const key = this._roomKey(roomId);
      const data = await this.client.get(key);
      if (data) {
        logger.debug(`从 Redis 获取房间 ${roomId}`);
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error('从 Redis 获取房间失败:', error.message);
      return null;
    }
  }

  // 删除房间
  async deleteRoom(roomId) {
    if (!this.connected) return false;
    try {
      const key = this._roomKey(roomId);
      await this.client.del(key);
      logger.debug(`房间 ${roomId} 已从 Redis 删除`);
      return true;
    } catch (error) {
      logger.error('从 Redis 删除房间失败:', error.message);
      return false;
    }
  }

  // 检查是否已连接
  isConnected() {
    return this.connected;
  }
}

// 单例模式
const redisClient = new RedisClient();
module.exports = redisClient;
