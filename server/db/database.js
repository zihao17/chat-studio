/**
 * SQLite 数据库配置和初始化
 * 使用 WAL 模式提升并发性能
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// 数据库文件路径 - 根据环境动态配置
function getDatabasePath() {
  // Zeabur 生产环境使用 /var/data 目录
  if (process.env.ZEABUR || process.env.ZEABUR_ENVIRONMENT_NAME) {
    const zeaburDataDir = "/var/data";
    // 确保目录存在
    if (!fs.existsSync(zeaburDataDir)) {
      fs.mkdirSync(zeaburDataDir, { recursive: true, mode: 0o755 });
    }
    return path.join(zeaburDataDir, "chat_studio.db");
  }

  // Railway 生产环境使用 /var/data 目录
  if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    const railwayDataDir = "/var/data";
    // 确保目录存在
    if (!fs.existsSync(railwayDataDir)) {
      fs.mkdirSync(railwayDataDir, { recursive: true, mode: 0o755 });
    }
    return path.join(railwayDataDir, "chat_studio.db");
  }

  // 本地开发环境使用项目目录下的 data 文件夹
  const localDataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true, mode: 0o755 });
  }
  return path.join(localDataDir, "chat_studio.db");
}

const DB_PATH = getDatabasePath();

/**
 * 创建数据库连接
 * @returns {sqlite3.Database} 数据库实例
 */
function createConnection() {
  console.log(`📍 数据库路径: ${DB_PATH}`);

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("❌ 数据库连接失败:", err.message);
      console.error("数据库路径:", DB_PATH);
      process.exit(1);
    }
    console.log("✅ SQLite 数据库连接成功");
    console.log(`💾 数据库文件: ${DB_PATH}`);
  });

  // 启用 WAL 模式提升并发性能
  db.run("PRAGMA journal_mode = WAL;", (err) => {
    if (err) console.error("WAL模式设置失败:", err.message);
  });
  db.run("PRAGMA synchronous = NORMAL;");
  db.run("PRAGMA cache_size = 1000;");
  db.run("PRAGMA foreign_keys = ON;");

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

    // 知识库相关表
    const createKbCollections = `
      CREATE TABLE IF NOT EXISTS kb_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    // 知识库分组表（第二阶段）
    const createKbGroups = `
      CREATE TABLE IF NOT EXISTS kb_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createKbDocuments = `
      CREATE TABLE IF NOT EXISTS kb_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        ext TEXT,
        mime TEXT,
        size INTEGER,
        sha256 TEXT,
        status TEXT,
        progress INTEGER DEFAULT 0,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES kb_collections (id) ON DELETE CASCADE
      )
    `;

    const createKbChunks = `
      CREATE TABLE IF NOT EXISTS kb_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        doc_id INTEGER NOT NULL,
        idx INTEGER NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER,
        start_pos INTEGER,
        end_pos INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES kb_collections (id) ON DELETE CASCADE,
        FOREIGN KEY (doc_id) REFERENCES kb_documents (id) ON DELETE CASCADE
      )
    `;

    const createKbEmbeddings = `
      CREATE TABLE IF NOT EXISTS kb_embeddings (
        chunk_id INTEGER PRIMARY KEY,
        collection_id INTEGER NOT NULL,
        vector BLOB NOT NULL,
        dim INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunk_id) REFERENCES kb_chunks (id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES kb_collections (id) ON DELETE CASCADE
      )
    `;

    const createKbFts = `
      CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
        content,
        chunk_id UNINDEXED,
        doc_id UNINDEXED,
        collection_id UNINDEXED,
        tokenize = 'unicode61'
      )
    `;

    // 触发器：保持 FTS 与主表同步
    const createKbFtsTriggers = [
      `CREATE TRIGGER IF NOT EXISTS kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
          INSERT INTO kb_chunks_fts(rowid, content, chunk_id, doc_id, collection_id)
          VALUES (new.id, new.content, new.id, new.doc_id, new.collection_id);
        END;`,
      `CREATE TRIGGER IF NOT EXISTS kb_chunks_ad AFTER DELETE ON kb_chunks BEGIN
          DELETE FROM kb_chunks_fts WHERE rowid = old.id;
        END;`,
      `CREATE TRIGGER IF NOT EXISTS kb_chunks_au AFTER UPDATE OF content ON kb_chunks BEGIN
          DELETE FROM kb_chunks_fts WHERE rowid = old.id;
          INSERT INTO kb_chunks_fts(rowid, content, chunk_id, doc_id, collection_id)
          VALUES (new.id, new.content, new.id, new.doc_id, new.collection_id);
        END;`,
    ];

    // 创建索引提升查询性能
    const createIndexes = [
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)",
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON chat_sessions (session_id)",
      "CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages (session_id)",
      "CREATE INDEX IF NOT EXISTS idx_messages_user_id ON chat_messages (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages (timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_kb_collections_user ON kb_collections (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_collections_group ON kb_collections (group_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_groups_user ON kb_groups (user_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_docs_collection ON kb_documents (collection_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks (doc_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_chunks_collection ON kb_chunks (collection_id)",
      "CREATE INDEX IF NOT EXISTS idx_kb_embeddings_collection ON kb_embeddings (collection_id)"
    ];

    // 执行表创建
    db.serialize(() => {
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error("❌ 创建用户表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 用户表创建成功");
      });

      db.run(createSessionsTable, (err) => {
        if (err) {
          console.error("❌ 创建会话表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 会话表创建成功");
      });

      db.run(createMessagesTable, (err) => {
        if (err) {
          console.error("❌ 创建消息表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 消息表创建成功");
      });

      // 知识库表
      db.run(createKbGroups, (err) => {
        if (err) {
          console.error("❌ 创建知识库分组表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库分组表创建成功");
      });
      db.run(createKbCollections, (err) => {
        if (err) {
          console.error("❌ 创建知识库表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库集合表创建成功");
      });

      db.run(createKbDocuments, (err) => {
        if (err) {
          console.error("❌ 创建知识库文档表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库文档表创建成功");
      });

      db.run(createKbChunks, (err) => {
        if (err) {
          console.error("❌ 创建知识库分块表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库分块表创建成功");
      });

      db.run(createKbEmbeddings, (err) => {
        if (err) {
          console.error("❌ 创建知识库向量表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库向量表创建成功");
      });

      db.run(createKbFts, (err) => {
        if (err) {
          console.error("❌ 创建知识库FTS虚表失败:", err.message);
          return reject(err);
        }
        console.log("✅ 知识库FTS虚表创建成功");
      });

      createKbFtsTriggers.forEach((sql) => {
        db.run(sql, (err) => {
          if (err) console.error("⚠️ 创建FTS触发器失败:", err.message);
        });
      });

      // 迁移：为 kb_collections 增加 group_id；为 kb_documents 增加 progress/error 字段（如果缺失）
      const ensureColumn = (table, column, type, callback) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
          if (err) return callback(err);
          const exists = (rows || []).some((r) => String(r.name).toLowerCase() === String(column).toLowerCase());
          if (exists) return callback();
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, callback);
        });
      };

      ensureColumn('kb_collections', 'group_id', 'INTEGER', (err) => {
        if (err) console.warn('⚠️ 为 kb_collections 添加 group_id 失败/可能已存在:', err.message);
        ensureColumn('kb_documents', 'progress', 'INTEGER DEFAULT 0', (err2) => {
          if (err2) console.warn('⚠️ 为 kb_documents 添加 progress 失败/可能已存在:', err2.message);
          ensureColumn('kb_documents', 'error', 'TEXT', (err3) => {
            if (err3) console.warn('⚠️ 为 kb_documents 添加 error 失败/可能已存在:', err3.message);
            
            db.serialize(() => {
              // 创建索引
              createIndexes.forEach((indexSql, index) => {
                db.run(indexSql, (err) => {
                  if (err) {
                    console.error(`❌ 创建索引 ${index + 1} 失败:`, err.message);
                  }
                });
              });
              
              console.log("✅ 数据库表结构初始化完成");
              console.log("📚 知识库表已就绪");
              resolve();
            });
          });
        });
      });
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
        console.error("❌ 关闭数据库连接失败:", err.message);
      } else {
        console.log("✅ 数据库连接已关闭");
      }
    });
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  initializeTables,
  closeDatabase,
  DB_PATH,
};
