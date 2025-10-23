/**
 * 对话同步路由
 * 提供对话记录的云端存储和同步功能
 */

const express = require('express');
const { getDatabase } = require('../db/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

/**
 * 获取用户的所有对话会话
 * GET /api/chat-sync/sessions
 */
router.get('/sessions', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDatabase();

    const sql = `
      SELECT session_id, title, created_at, updated_at
      FROM chat_sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `;

    db.all(sql, [userId], (err, sessions) => {
      if (err) {
        console.error('获取会话列表失败:', err);
        return res.status(500).json({
          success: false,
          message: '获取会话列表失败'
        });
      }

      console.log(`获取会话列表成功: 用户${userId}, 找到${sessions ? sessions.length : 0}个会话`);
      res.json({
        success: true,
        sessions: sessions || []
      });
    });
  } catch (error) {
    console.error('获取会话列表接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取指定会话的所有消息
 * GET /api/chat-sync/sessions/:sessionId/messages
 */
router.get('/sessions/:sessionId/messages', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    const db = getDatabase();

    // 验证会话是否属于当前用户
    const checkSessionSql = 'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?';
    db.get(checkSessionSql, [sessionId, userId], (err, session) => {
      if (err) {
        console.error('验证会话权限失败:', err);
        return res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在或无权限访问'
        });
      }

      // 获取消息列表
      const messagesSql = `
        SELECT role, content, timestamp
        FROM chat_messages
        WHERE session_id = ? AND user_id = ?
        ORDER BY timestamp ASC
      `;

      db.all(messagesSql, [sessionId, userId], (err, messages) => {
        if (err) {
          console.error('获取消息列表失败:', err);
          return res.status(500).json({
            success: false,
            message: '获取消息列表失败'
          });
        }

        res.json({
          success: true,
          messages: messages || []
        });
      });
    });
  } catch (error) {
    console.error('获取消息列表接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 用于防止并发同步的锁
let syncInProgress = false;

/**
 * 同步游客数据到云端
 * POST /api/chat-sync/sync-guest-data
 */
router.post('/sync-guest-data', authenticateToken, (req, res) => {
  try {
    const { sessions } = req.body;
    const userId = req.user.userId;

    if (!sessions || !Array.isArray(sessions)) {
      return res.status(400).json({
        success: false,
        message: '无效的会话数据'
      });
    }

    // 防止并发同步
    if (syncInProgress) {
      console.warn(`用户 ${userId} 尝试并发同步，已拒绝`);
      return res.status(409).json({
        success: false,
        message: '数据同步正在进行中，请稍后重试'
      });
    }

    syncInProgress = true;

    const db = getDatabase();

    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      let completedSessions = 0;
      let hasError = false;

      if (sessions.length === 0) {
        db.run('COMMIT');
        syncInProgress = false; // 释放锁
        return res.json({
          success: true,
          message: '没有数据需要同步',
          syncedSessions: 0
        });
      }

      sessions.forEach((session, index) => {
        const { id: sessionId, title, messages, createdAt } = session;

        // 插入会话记录
        const insertSessionSql = `
          INSERT OR IGNORE INTO chat_sessions (user_id, session_id, title, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `;

        const sessionCreatedAt = createdAt || new Date().toISOString();
        const sessionUpdatedAt = new Date().toISOString();

        db.run(insertSessionSql, [userId, sessionId, title, sessionCreatedAt, sessionUpdatedAt], function(err) {
          if (err) {
            console.error('插入会话失败:', err);
            if (!hasError) {
              hasError = true;
              db.run('ROLLBACK');
              syncInProgress = false; // 释放锁
              return res.status(500).json({
                success: false,
                message: '同步会话数据失败'
              });
            }
            return;
          }

          // 插入消息记录
          if (messages && messages.length > 0) {
            let completedMessages = 0;

            messages.forEach((message) => {
              const { role, content, timestamp } = message;
              const insertMessageSql = `
                INSERT INTO chat_messages (session_id, user_id, role, content, timestamp)
                VALUES (?, ?, ?, ?, ?)
              `;

              const messageTimestamp = timestamp || new Date().toISOString();

              db.run(insertMessageSql, [sessionId, userId, role, content, messageTimestamp], (err) => {
                if (err) {
                  console.error('插入消息失败:', err);
                  if (!hasError) {
                    hasError = true;
                    db.run('ROLLBACK');
                    syncInProgress = false; // 释放锁
                    return res.status(500).json({
                      success: false,
                      message: '同步消息数据失败'
                    });
                  }
                  return;
                }

                completedMessages++;
                if (completedMessages === messages.length) {
                  completedSessions++;
                  if (completedSessions === sessions.length && !hasError) {
                    db.run('COMMIT');
                    syncInProgress = false; // 释放锁
                    res.json({
                      success: true,
                      message: '数据同步成功',
                      syncedSessions: sessions.length
                    });
                  }
                }
              });
            });
          } else {
            completedSessions++;
            if (completedSessions === sessions.length && !hasError) {
              db.run('COMMIT');
              syncInProgress = false; // 释放锁
              res.json({
                success: true,
                message: '数据同步成功',
                syncedSessions: sessions.length
              });
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('同步游客数据接口错误:', error);
    syncInProgress = false; // 释放锁
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 保存新的对话消息
 * POST /api/chat-sync/sessions/:sessionId/messages
 */
router.post('/sessions/:sessionId/messages', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role, content, title } = req.body;
    const userId = req.user.userId;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        message: '消息角色和内容不能为空'
      });
    }

    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的消息角色'
      });
    }

    const db = getDatabase();

    // 检查会话是否存在，不存在则创建
    const checkSessionSql = 'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?';
    db.get(checkSessionSql, [sessionId, userId], (err, session) => {
      if (err) {
        console.error('验证会话权限失败:', err);
        return res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }

      const saveMessage = () => {
        const insertMessageSql = `
          INSERT INTO chat_messages (session_id, user_id, role, content, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `;

        const timestamp = new Date().toISOString();

        db.run(insertMessageSql, [sessionId, userId, role, content, timestamp], function(err) {
          if (err) {
            console.error('保存消息失败:', err);
            return res.status(500).json({
              success: false,
              message: '保存消息失败'
            });
          }

          console.log(`消息保存成功: 用户${userId}, 会话${sessionId}, 角色${role}, 内容长度${content.length}`);

          // 更新会话的最后更新时间
          const updateSessionSql = 'UPDATE chat_sessions SET updated_at = ? WHERE session_id = ? AND user_id = ?';
          db.run(updateSessionSql, [timestamp, sessionId, userId], (updateErr) => {
            if (updateErr) {
              console.error('更新会话时间失败:', updateErr);
            }
          });

          res.json({
            success: true,
            message: '消息保存成功',
            messageId: this.lastID
          });
        });
      };

      if (!session) {
        // 会话不存在，创建新会话
        const insertSessionSql = `
          INSERT OR IGNORE INTO chat_sessions (user_id, session_id, title, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `;

        const now = new Date().toISOString();
        const sessionTitle = title || '新对话';

        db.run(insertSessionSql, [userId, sessionId, sessionTitle, now, now], (err) => {
          if (err) {
            console.error('创建会话失败:', err);
            return res.status(500).json({
              success: false,
              message: '创建会话失败'
            });
          }

          console.log(`会话创建成功: 用户${userId}, 会话${sessionId}, 标题${sessionTitle}`);
          saveMessage();
        });
      } else {
        saveMessage();
      }
    });
  } catch (error) {
    console.error('保存消息接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 删除对话会话
 * DELETE /api/chat-sync/sessions/:sessionId
 */
router.delete('/sessions/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    const db = getDatabase();

    // 验证会话是否属于当前用户
    const checkSessionSql = 'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?';
    db.get(checkSessionSql, [sessionId, userId], (err, session) => {
      if (err) {
        console.error('验证会话权限失败:', err);
        return res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }

      if (!session) {
        return res.status(404).json({
          success: false,
          message: '会话不存在或无权限访问'
        });
      }

      // 删除会话（级联删除消息）
      const deleteSessionSql = 'DELETE FROM chat_sessions WHERE session_id = ? AND user_id = ?';
      db.run(deleteSessionSql, [sessionId, userId], function(err) {
        if (err) {
          console.error('删除会话失败:', err);
          return res.status(500).json({
            success: false,
            message: '删除会话失败'
          });
        }

        res.json({
          success: true,
          message: '会话删除成功'
        });
      });
    });
  } catch (error) {
    console.error('删除会话接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;