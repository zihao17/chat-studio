/**
 * 用户认证路由
 * 提供注册、登录、登出和身份验证功能
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db/database');

const router = express.Router();

// JWT 密钥（生产环境应从环境变量获取）
const JWT_SECRET = process.env.JWT_SECRET || 'chat-studio-secret-key-2024';
const JWT_EXPIRES_IN = '7d'; // Token 有效期 7 天

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 参数校验
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名、邮箱和密码不能为空'
      });
    }

    // 邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 密码强度校验（至少6位）
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少为6位'
      });
    }

    const db = getDatabase();

    // 检查用户名和邮箱是否已存在
    const checkUserSql = 'SELECT id FROM users WHERE username = ? OR email = ?';
    db.get(checkUserSql, [username, email], async (err, existingUser) => {
      if (err) {
        console.error('数据库查询错误:', err);
        return res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: '用户名或邮箱已存在'
        });
      }

      try {
        // 密码加密
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 插入新用户
        const insertUserSql = `
          INSERT INTO users (username, email, password_hash)
          VALUES (?, ?, ?)
        `;

        db.run(insertUserSql, [username, email, passwordHash], function(err) {
          if (err) {
            console.error('用户注册失败:', err);
            return res.status(500).json({
              success: false,
              message: '用户注册失败'
            });
          }

          const userId = this.lastID;

          // 生成 JWT Token
          const token = jwt.sign(
            { userId, username, email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
          );

          // 设置 HttpOnly Cookie
          res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
          });

          res.status(201).json({
            success: true,
            message: '注册成功',
            user: {
              id: userId,
              username,
              email
            }
          });
        });
      } catch (hashError) {
        console.error('密码加密失败:', hashError);
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    });
  } catch (error) {
    console.error('注册接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // 参数校验
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱和密码不能为空'
      });
    }

    const db = getDatabase();

    // 查找用户
    const findUserSql = 'SELECT * FROM users WHERE email = ?';
    db.get(findUserSql, [email], async (err, user) => {
      if (err) {
        console.error('数据库查询错误:', err);
        return res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '邮箱或密码错误'
        });
      }

      try {
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: '邮箱或密码错误'
          });
        }

        // 生成 JWT Token
        const token = jwt.sign(
          { userId: user.id, username: user.username, email: user.email },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // 设置 HttpOnly Cookie
        res.cookie('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });

        res.json({
          success: true,
          message: '登录成功',
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      } catch (compareError) {
        console.error('密码验证失败:', compareError);
        res.status(500).json({
          success: false,
          message: '服务器内部错误'
        });
      }
    });
  } catch (error) {
    console.error('登录接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    // 清除 Cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 验证用户身份
 * GET /api/auth/verify
 */
router.get('/verify', (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未登录'
      });
    }

    // 验证 JWT Token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Token 验证失败:', err);
        return res.status(401).json({
          success: false,
          message: 'Token 无效或已过期'
        });
      }

      res.json({
        success: true,
        message: '身份验证成功',
        user: {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email
        }
      });
    });
  } catch (error) {
    console.error('身份验证接口错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 认证中间件
 * 验证用户是否已登录
 */
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Token 无效或已过期'
      });
    }

    req.user = decoded;
    next();
  });
}

module.exports = {
  router,
  authenticateToken
};