/**
 * SQLite 数据库配置和初始化
 * 使用 WAL 模式提升并发性能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'chat_studio.db');

/**
 * 创建数据库连接
 * @returns {sqlite3.Database} 数据库实例
 */
function createConnection() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ 数据库连接失败:', err.message);
      process.exit(1);
    }
    console.log('✅ SQLite 数据库连接成功');
  });

  // 启用 WAL 模式提升并发性能
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA synchronous = NORMAL;');
  db.run('PRAGMA cache_size = 1000;');
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

/**
 * 初始化数据库表结构
 * @param {sqlite3.Database} db 数据库实例
 */
function initializeTables(db) {
  return new Promise((resolve, reject) => {
    // 用户表
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 对话会话表
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id VARCHAR(36) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '新对话',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    // 对话消息表
    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id VARCHAR(36) NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES chat_sessions (session_id) ON DELETE CASCADE
      )
    `;

    // 创建索引提升查询性能
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON chat_sessions (session_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages (session_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON chat_messages (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages (timestamp)'
    ];

    // 执行表创建
    db.serialize(() => {
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error('❌ 创建用户表失败:', err.message);
          return reject(err);
        }
        console.log('✅ 用户表创建成功');
      });

      db.run(createSessionsTable, (err) => {
        if (err) {
          console.error('❌ 创建会话表失败:', err.message);
          return reject(err);
        }
        console.log('✅ 会话表创建成功');
      });

      db.run(createMessagesTable, (err) => {
        if (err) {
          console.error('❌ 创建消息表失败:', err.message);
          return reject(err);
        }
        console.log('✅ 消息表创建成功');
      });

      // 创建索引
      createIndexes.forEach((indexSql, index) => {
        db.run(indexSql, (err) => {
          if (err) {
            console.error(`❌ 创建索引 ${index + 1} 失败:`, err.message);
          }
        });
      });

      console.log('✅ 数据库表结构初始化完成');
      resolve();
    });
  });
}

/**
 * 获取数据库实例（单例模式）
 */
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = createConnection();
  }
  return dbInstance;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库连接失败:', err.message);
      } else {
        console.log('✅ 数据库连接已关闭');
      }
    });
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  initializeTables,
  closeDatabase,
  DB_PATH
};