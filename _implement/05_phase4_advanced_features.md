# Phase 4: 高度機能

## 🎯 フェーズ目標
プロダクション環境での運用に必要な高度機能を実装し、システムの信頼性、セキュリティ、パフォーマンスを向上させます。

## ⏰ 推定期間
**2-3週間** (実働16-24時間)

## 📋 前提条件
- Phase 1,2,3 が完了している
- 基本的なMQTT統合とMCP連携が動作している
- セキュリティ要件が明確化されている

## 🏗️ アーキテクチャ概要

```
Phase 4 高度機能レイヤー
├── セキュリティ (security/)
│   ├── AuthenticationManager
│   ├── AuthorizationEngine
│   ├── CryptoService
│   └── AuditLogger
├── パフォーマンス (performance/)
│   ├── ConnectionPool
│   ├── MessageCache
│   ├── LoadBalancer
│   └── Metrics
├── 監視・運用 (monitoring/)
│   ├── HealthChecker
│   ├── MetricsCollector
│   ├── AlertManager
│   └── Diagnostics
└── プラグイン (plugins/)
    ├── PluginManager
    ├── PluginLoader
    └── PluginAPI
```

## 📦 依存関係の追加

```bash
# セキュリティ
npm install bcrypt@^5.0.0 jsonwebtoken@^9.0.0
npm install -D @types/bcrypt @types/jsonwebtoken

# パフォーマンス監視
npm install prom-client@^15.0.0 
npm install -D @types/prom-client

# 設定検証
npm install joi@^17.0.0
npm install -D @types/joi

# データベース（軽量）
npm install better-sqlite3@^8.0.0
npm install -D @types/better-sqlite3

# プラグインシステム
npm install vm2@^3.9.0
npm install -D @types/vm2
```

## 📝 実装タスク一覧

### Task 1: セキュリティ機能実装 (3日)

#### 1.1 認証システム実装 (6時間)
**ファイル**: `src/security/authentication-manager.ts`

**TDD実装手順**:
1. **テスト作成** (2時間)
2. **実装** (3.5時間)
3. **リファクタリング** (30分)

**テストケース**:
```typescript
// tests/unit/security/authentication-manager.test.ts
describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockConfig: ISecurityConfig;

  beforeEach(() => {
    mockConfig = {
      authentication: {
        enabled: true,
        providers: ['local', 'token'],
        tokenExpiry: 3600,
        secretKey: 'test-secret-key-for-jwt'
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyPath: '/tmp/test.key'
      }
    };

    authManager = new AuthenticationManager(mockConfig);
  });

  describe('user authentication', () => {
    it('should authenticate valid user credentials', async () => {
      // テストユーザーを作成
      await authManager.createUser({
        username: 'testuser',
        password: 'password123',
        roles: ['user']
      });

      const result = await authManager.authenticate({
        type: 'local',
        username: 'testuser',
        password: 'password123'
      });

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        username: 'testuser',
        roles: ['user']
      });
      expect(result.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      await authManager.createUser({
        username: 'testuser',
        password: 'password123',
        roles: ['user']
      });

      const result = await authManager.authenticate({
        type: 'local',
        username: 'testuser',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should handle non-existent users', async () => {
      const result = await authManager.authenticate({
        type: 'local',
        username: 'nonexistent',
        password: 'password123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should rate limit authentication attempts', async () => {
      await authManager.createUser({
        username: 'testuser',
        password: 'password123',
        roles: ['user']
      });

      // 多数の失敗試行
      const promises = Array.from({ length: 10 }, () =>
        authManager.authenticate({
          type: 'local',
          username: 'testuser',
          password: 'wrongpassword'
        })
      );

      const results = await Promise.all(promises);
      
      // 最後の方はレート制限でブロックされるはず
      const blockedAttempts = results.filter(r => 
        r.error?.includes('Rate limit exceeded')
      ).length;
      
      expect(blockedAttempts).toBeGreaterThan(0);
    });
  });

  describe('token management', () => {
    it('should generate valid JWT tokens', async () => {
      const user = {
        id: 'user123',
        username: 'testuser',
        roles: ['user', 'mqtt:read']
      };

      const token = authManager.generateToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure
    });

    it('should validate JWT tokens', async () => {
      const user = {
        id: 'user123',
        username: 'testuser',
        roles: ['user']
      };

      const token = authManager.generateToken(user);
      const validation = await authManager.validateToken(token);

      expect(validation.valid).toBe(true);
      expect(validation.user).toMatchObject({
        id: 'user123',
        username: 'testuser',
        roles: ['user']
      });
    });

    it('should reject expired tokens', async () => {
      const user = { id: 'user123', username: 'testuser', roles: ['user'] };
      
      // 期限切れトークンを生成（テスト用）
      const expiredToken = authManager.generateToken(user, -3600); // 1時間前に期限切れ

      const validation = await authManager.validateToken(expiredToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Token expired');
    });

    it('should reject invalid tokens', async () => {
      const invalidTokens = [
        'invalid.token.format',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'not-a-jwt-token'
      ];

      for (const token of invalidTokens) {
        const validation = await authManager.validateToken(token);
        expect(validation.valid).toBe(false);
      }
    });

    it('should handle token refresh', async () => {
      const user = {
        id: 'user123',
        username: 'testuser',
        roles: ['user']
      };

      const originalToken = authManager.generateToken(user);
      
      // 少し待ってからリフレッシュ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const refreshedToken = await authManager.refreshToken(originalToken);

      expect(refreshedToken).toBeDefined();
      expect(refreshedToken).not.toBe(originalToken);
      
      const validation = await authManager.validateToken(refreshedToken);
      expect(validation.valid).toBe(true);
    });
  });

  describe('user management', () => {
    it('should create new users with hashed passwords', async () => {
      const userData = {
        username: 'newuser',
        password: 'securepassword123',
        roles: ['user', 'mqtt:subscribe']
      };

      const user = await authManager.createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe('newuser');
      expect(user.roles).toEqual(['user', 'mqtt:subscribe']);
      expect(user.password).not.toBe('securepassword123'); // Should be hashed
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should prevent duplicate usernames', async () => {
      await authManager.createUser({
        username: 'testuser',
        password: 'password123',
        roles: ['user']
      });

      await expect(authManager.createUser({
        username: 'testuser',
        password: 'anotherpassword',
        roles: ['user']
      })).rejects.toThrow('Username already exists');
    });

    it('should update user roles', async () => {
      const user = await authManager.createUser({
        username: 'testuser',
        password: 'password123',
        roles: ['user']
      });

      await authManager.updateUserRoles(user.id, ['user', 'admin', 'mqtt:admin']);

      const updatedUser = await authManager.getUser(user.id);
      expect(updatedUser.roles).toEqual(['user', 'admin', 'mqtt:admin']);
    });

    it('should delete users', async () => {
      const user = await authManager.createUser({
        username: 'deleteme',
        password: 'password123',
        roles: ['user']
      });

      await authManager.deleteUser(user.id);

      await expect(authManager.getUser(user.id)).rejects.toThrow('User not found');
    });
  });

  describe('password security', () => {
    it('should enforce password complexity', async () => {
      const weakPasswords = [
        '123',           // Too short
        'password',      // Too common
        'abcdefgh',      // No numbers/symbols
        '12345678'       // No letters
      ];

      for (const password of weakPasswords) {
        await expect(authManager.createUser({
          username: `user${password.length}`,
          password,
          roles: ['user']
        })).rejects.toThrow(/Password does not meet complexity requirements/);
      }
    });

    it('should accept strong passwords', async () => {
      const strongPasswords = [
        'StrongP@ssw0rd123',
        'C0mpl3x!P@ssw0rd',
        'Secur3#P@ssw0rd2024'
      ];

      for (let i = 0; i < strongPasswords.length; i++) {
        const user = await authManager.createUser({
          username: `stronguser${i}`,
          password: strongPasswords[i],
          roles: ['user']
        });
        
        expect(user.id).toBeDefined();
      }
    });

    it('should hash passwords securely', async () => {
      const password = 'testpassword123';
      
      const user1 = await authManager.createUser({
        username: 'user1',
        password,
        roles: ['user']
      });

      const user2 = await authManager.createUser({
        username: 'user2',
        password,
        roles: ['user']
      });

      // 同じパスワードでもハッシュは異なるはず（salt使用）
      expect(user1.password).not.toBe(user2.password);
      expect(user1.password).not.toBe(password);
      expect(user2.password).not.toBe(password);
    });
  });

  describe('session management', () => {
    it('should track active sessions', async () => {
      const user = await authManager.createUser({
        username: 'sessionuser',
        password: 'password123',
        roles: ['user']
      });

      const session1 = await authManager.createSession(user.id, 'device1');
      const session2 = await authManager.createSession(user.id, 'device2');

      const activeSessions = await authManager.getActiveSessions(user.id);
      
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.deviceId)).toContain('device1');
      expect(activeSessions.map(s => s.deviceId)).toContain('device2');
    });

    it('should invalidate sessions', async () => {
      const user = await authManager.createUser({
        username: 'sessionuser',
        password: 'password123',
        roles: ['user']
      });

      const session = await authManager.createSession(user.id, 'device1');
      
      expect(await authManager.isSessionValid(session.id)).toBe(true);
      
      await authManager.invalidateSession(session.id);
      
      expect(await authManager.isSessionValid(session.id)).toBe(false);
    });

    it('should cleanup expired sessions', async () => {
      const user = await authManager.createUser({
        username: 'sessionuser',
        password: 'password123',
        roles: ['user']
      });

      // 期限切れセッションを作成
      const expiredSession = await authManager.createSession(user.id, 'device1', -3600);
      const validSession = await authManager.createSession(user.id, 'device2');

      await authManager.cleanupExpiredSessions();

      expect(await authManager.isSessionValid(expiredSession.id)).toBe(false);
      expect(await authManager.isSessionValid(validSession.id)).toBe(true);
    });
  });

  describe('audit logging', () => {
    it('should log authentication attempts', async () => {
      const auditSpy = jest.spyOn(authManager, 'logAuditEvent');

      await authManager.createUser({
        username: 'audituser',
        password: 'password123',
        roles: ['user']
      });

      await authManager.authenticate({
        type: 'local',
        username: 'audituser',
        password: 'password123'
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'authentication_success',
          username: 'audituser'
        })
      );
    });

    it('should log failed authentication attempts', async () => {
      const auditSpy = jest.spyOn(authManager, 'logAuditEvent');

      await authManager.authenticate({
        type: 'local',
        username: 'nonexistent',
        password: 'wrongpassword'
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'authentication_failure',
          username: 'nonexistent',
          reason: 'user_not_found'
        })
      );
    });
  });
});
```

**実装コード**:
```typescript
// src/security/authentication-manager.ts
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

import { ISecurityConfig } from '../core/interfaces/config-types';
import { 
  ValidationError, 
  AuthenticationError, 
  SecurityError 
} from '../core/errors/security-errors';
import { getLogger } from '../core/utils/logger';

export interface IUser {
  id: string;
  username: string;
  password: string; // hashed
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface ISession {
  id: string;
  userId: string;
  deviceId?: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface IAuthenticationCredentials {
  type: 'local' | 'token' | 'certificate';
  username?: string;
  password?: string;
  token?: string;
  certificate?: string;
}

export interface IAuthenticationResult {
  success: boolean;
  user?: Omit<IUser, 'password'>;
  token?: string;
  session?: ISession;
  error?: string;
}

export interface ITokenValidation {
  valid: boolean;
  user?: Omit<IUser, 'password'>;
  session?: ISession;
  error?: string;
}

export interface IAuditEvent {
  event: string;
  userId?: string;
  username?: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export class AuthenticationManager extends EventEmitter {
  private users = new Map<string, IUser>();
  private sessions = new Map<string, ISession>();
  private rateLimitMap = new Map<string, { attempts: number; lastAttempt: Date }>();
  private auditEvents: IAuditEvent[] = [];
  
  private readonly saltRounds = 12;
  private readonly maxLoginAttempts = 5;
  private readonly rateLimitWindow = 15 * 60 * 1000; // 15 minutes
  
  private logger = getLogger().withContext({ component: 'AuthenticationManager' });

  constructor(private config: ISecurityConfig) {
    super();
    this.setupCleanupTasks();
  }

  /**
   * ユーザー認証
   */
  async authenticate(credentials: IAuthenticationCredentials): Promise<IAuthenticationResult> {
    const timer = this.logger.startTimer();
    
    try {
      // レート制限チェック
      if (credentials.username && this.isRateLimited(credentials.username)) {
        const error = 'Rate limit exceeded. Please try again later.';
        this.logAuditEvent({
          event: 'authentication_failure',
          username: credentials.username,
          timestamp: new Date(),
          success: false,
          reason: 'rate_limited'
        });
        
        return { success: false, error };
      }

      let result: IAuthenticationResult;

      switch (credentials.type) {
        case 'local':
          result = await this.authenticateLocal(credentials);
          break;
        case 'token':
          result = await this.authenticateToken(credentials);
          break;
        case 'certificate':
          result = await this.authenticateCertificate(credentials);
          break;
        default:
          throw new ValidationError(
            'INVALID_AUTH_TYPE',
            `Unsupported authentication type: ${credentials.type}`
          );
      }

      // 認証試行を記録
      if (credentials.username) {
        this.recordLoginAttempt(credentials.username, result.success);
      }

      // 監査ログ
      this.logAuditEvent({
        event: result.success ? 'authentication_success' : 'authentication_failure',
        userId: result.user?.id,
        username: credentials.username,
        timestamp: new Date(),
        success: result.success,
        reason: result.error
      });

      timer.done('Authentication completed', {
        success: result.success,
        username: credentials.username
      });

      return result;

    } catch (error) {
      timer.done('Authentication failed', { error });
      
      this.logAuditEvent({
        event: 'authentication_error',
        username: credentials.username,
        timestamp: new Date(),
        success: false,
        reason: (error as Error).message
      });

      return {
        success: false,
        error: `Authentication error: ${(error as Error).message}`
      };
    }
  }

  /**
   * ユーザー作成
   */
  async createUser(userData: {
    username: string;
    password: string;
    roles: string[];
    metadata?: Record<string, unknown>;
  }): Promise<IUser> {
    this.logger.info('Creating new user', { username: userData.username });

    // 重複チェック
    const existingUser = this.findUserByUsername(userData.username);
    if (existingUser) {
      throw new ValidationError(
        'USERNAME_EXISTS',
        `Username already exists: ${userData.username}`
      );
    }

    // パスワード複雑性チェック
    this.validatePasswordComplexity(userData.password);

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds);

    const user: IUser = {
      id: this.generateUserId(),
      username: userData.username,
      password: hashedPassword,
      roles: userData.roles,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      metadata: userData.metadata
    };

    this.users.set(user.id, user);

    this.logAuditEvent({
      event: 'user_created',
      userId: user.id,
      username: user.username,
      timestamp: new Date(),
      success: true
    });

    this.logger.info('User created successfully', {
      userId: user.id,
      username: user.username,
      roles: user.roles
    });

    return user;
  }

  /**
   * JWTトークン生成
   */
  generateToken(user: Omit<IUser, 'password'>, expiresInSeconds?: number): string {
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000)
    };

    const options: jwt.SignOptions = {
      expiresIn: expiresInSeconds || this.config.authentication.tokenExpiry
    };

    return jwt.sign(payload, this.config.authentication.secretKey, options);
  }

  /**
   * JWTトークン検証
   */
  async validateToken(token: string): Promise<ITokenValidation> {
    try {
      const decoded = jwt.verify(
        token, 
        this.config.authentication.secretKey
      ) as jwt.JwtPayload;

      const user = this.users.get(decoded.sub as string);
      if (!user || !user.isActive) {
        return {
          valid: false,
          error: 'User not found or inactive'
        };
      }

      const { password, ...userWithoutPassword } = user;

      return {
        valid: true,
        user: userWithoutPassword
      };

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      }

      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * トークンリフレッシュ
   */
  async refreshToken(token: string): Promise<string> {
    const validation = await this.validateToken(token);
    
    if (!validation.valid || !validation.user) {
      throw new AuthenticationError(
        'INVALID_TOKEN',
        'Cannot refresh invalid token'
      );
    }

    return this.generateToken(validation.user);
  }

  /**
   * セッション作成
   */
  async createSession(
    userId: string, 
    deviceId?: string, 
    expiresInSeconds?: number
  ): Promise<ISession> {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError(
        'USER_NOT_FOUND',
        'Cannot create session for invalid user'
      );
    }

    const session: ISession = {
      id: this.generateSessionId(),
      userId,
      deviceId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (expiresInSeconds || 3600) * 1000),
      isActive: true
    };

    this.sessions.set(session.id, session);

    this.logger.debug('Session created', {
      sessionId: session.id,
      userId,
      deviceId
    });

    return session;
  }

  /**
   * セッション検証
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return false;
    }

    if (session.expiresAt < new Date()) {
      this.invalidateSession(sessionId);
      return false;
    }

    return true;
  }

  /**
   * セッション無効化
   */
  async invalidateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.logger.debug('Session invalidated', { sessionId });
    }
  }

  /**
   * アクティブセッション取得
   */
  async getActiveSessions(userId: string): Promise<ISession[]> {
    return Array.from(this.sessions.values()).filter(session =>
      session.userId === userId && 
      session.isActive && 
      session.expiresAt > new Date()
    );
  }

  /**
   * ユーザー取得
   */
  async getUser(userId: string): Promise<Omit<IUser, 'password'>> {
    const user = this.users.get(userId);
    if (!user) {
      throw new ValidationError('USER_NOT_FOUND', `User not found: ${userId}`);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * ユーザー削除
   */
  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new ValidationError('USER_NOT_FOUND', `User not found: ${userId}`);
    }

    // 関連セッションも無効化
    const userSessions = await this.getActiveSessions(userId);
    for (const session of userSessions) {
      await this.invalidateSession(session.id);
    }

    this.users.delete(userId);

    this.logAuditEvent({
      event: 'user_deleted',
      userId,
      username: user.username,
      timestamp: new Date(),
      success: true
    });

    this.logger.info('User deleted', { userId, username: user.username });
  }

  /**
   * ユーザーロール更新
   */
  async updateUserRoles(userId: string, roles: string[]): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new ValidationError('USER_NOT_FOUND', `User not found: ${userId}`);
    }

    const oldRoles = [...user.roles];
    user.roles = [...roles];
    user.updatedAt = new Date();

    this.logAuditEvent({
      event: 'user_roles_updated',
      userId,
      username: user.username,
      timestamp: new Date(),
      success: true,
      metadata: { oldRoles, newRoles: roles }
    });

    this.logger.info('User roles updated', {
      userId,
      username: user.username,
      oldRoles,
      newRoles: roles
    });
  }

  /**
   * 監査イベントログ
   */
  logAuditEvent(event: IAuditEvent): void {
    this.auditEvents.push(event);
    
    // イベントバッファサイズ制限
    if (this.auditEvents.length > 10000) {
      this.auditEvents.shift();
    }

    this.logger.info('Audit event logged', event);
    this.emit('audit-event', event);
  }

  /**
   * ローカル認証
   */
  private async authenticateLocal(
    credentials: IAuthenticationCredentials
  ): Promise<IAuthenticationResult> {
    if (!credentials.username || !credentials.password) {
      return {
        success: false,
        error: 'Username and password are required'
      };
    }

    const user = this.findUserByUsername(credentials.username);
    if (!user || !user.isActive) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    // 最終ログイン時刻更新
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const { password, ...userWithoutPassword } = user;
    const token = this.generateToken(userWithoutPassword);
    const session = await this.createSession(user.id);

    return {
      success: true,
      user: userWithoutPassword,
      token,
      session
    };
  }

  /**
   * トークン認証
   */
  private async authenticateToken(
    credentials: IAuthenticationCredentials
  ): Promise<IAuthenticationResult> {
    if (!credentials.token) {
      return {
        success: false,
        error: 'Token is required'
      };
    }

    const validation = await this.validateToken(credentials.token);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    return {
      success: true,
      user: validation.user
    };
  }

  /**
   * 証明書認証
   */
  private async authenticateCertificate(
    credentials: IAuthenticationCredentials
  ): Promise<IAuthenticationResult> {
    // 証明書認証の実装
    // 実際の実装では、X.509証明書の検証を行う
    return {
      success: false,
      error: 'Certificate authentication not implemented'
    };
  }

  /**
   * ユーザー名でユーザーを検索
   */
  private findUserByUsername(username: string): IUser | undefined {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  /**
   * パスワード複雑性検証
   */
  private validatePasswordComplexity(password: string): void {
    const minLength = 8;
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors: string[] = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    // 一般的なパスワードのチェック
    const commonPasswords = [
      'password', 'password123', '123456', 'qwerty', 'admin', 'letmein'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    if (errors.length > 0) {
      throw new ValidationError(
        'WEAK_PASSWORD',
        `Password does not meet complexity requirements: ${errors.join(', ')}`
      );
    }
  }

  /**
   * レート制限チェック
   */
  private isRateLimited(username: string): boolean {
    const rateLimit = this.rateLimitMap.get(username);
    
    if (!rateLimit) {
      return false;
    }

    const timeSinceLastAttempt = Date.now() - rateLimit.lastAttempt.getTime();
    
    if (timeSinceLastAttempt > this.rateLimitWindow) {
      // ウィンドウ期間を過ぎているのでリセット
      this.rateLimitMap.delete(username);
      return false;
    }

    return rateLimit.attempts >= this.maxLoginAttempts;
  }

  /**
   * ログイン試行を記録
   */
  private recordLoginAttempt(username: string, success: boolean): void {
    if (success) {
      // 成功したら試行回数をリセット
      this.rateLimitMap.delete(username);
      return;
    }

    const existing = this.rateLimitMap.get(username) || { attempts: 0, lastAttempt: new Date() };
    
    this.rateLimitMap.set(username, {
      attempts: existing.attempts + 1,
      lastAttempt: new Date()
    });
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive || session.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info('Cleaned up expired sessions', { count: expiredSessions.length });
    }
  }

  /**
   * クリーンアップタスクの設定
   */
  private setupCleanupTasks(): void {
    // 1時間ごとに期限切れセッションをクリーンアップ
    setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        this.logger.error('Failed to cleanup expired sessions', { error });
      });
    }, 60 * 60 * 1000);

    // 24時間ごとにレート制限データをクリーンアップ
    setInterval(() => {
      const now = Date.now();
      for (const [username, rateLimit] of this.rateLimitMap) {
        if (now - rateLimit.lastAttempt.getTime() > this.rateLimitWindow) {
          this.rateLimitMap.delete(username);
        }
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * ユニークなユーザーIDを生成
   */
  private generateUserId(): string {
    return `user_${crypto.randomUUID()}`;
  }

  /**
   * ユニークなセッションIDを生成
   */
  private generateSessionId(): string {
    return `session_${crypto.randomUUID()}`;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.users.clear();
    this.sessions.clear();
    this.rateLimitMap.clear();
    this.auditEvents.length = 0;
    this.removeAllListeners();
  }
}
```

#### ✅ 完了条件 (Task 1.1)
- [ ] ユーザー認証が正常動作する
- [ ] JWT トークン管理が機能する
- [ ] セッション管理が動作する
- [ ] レート制限が機能する
- [ ] 監査ログが適切に記録される
- [ ] パスワードセキュリティが確保されている

---

#### 1.2 認可エンジン実装 (4時間)
**ファイル**: `src/security/authorization-engine.ts`

**実装コード**:
```typescript
// src/security/authorization-engine.ts
import { getLogger } from '../core/utils/logger';

export interface IPermission {
  resource: string;
  action: string;
  conditions?: ICondition[];
}

export interface ICondition {
  type: 'time' | 'ip' | 'resource_attribute' | 'user_attribute';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'matches' | 'between';
  value: unknown;
  attribute?: string;
}

export interface IRole {
  name: string;
  permissions: IPermission[];
  description?: string;
}

export interface IAuthorizationContext {
  userId: string;
  userRoles: string[];
  resource: string;
  action: string;
  resourceAttributes?: Record<string, unknown>;
  userAttributes?: Record<string, unknown>;
  timestamp?: Date;
  clientIp?: string;
}

export interface IAuthorizationResult {
  granted: boolean;
  reason?: string;
  appliedPermissions?: IPermission[];
}

export class AuthorizationEngine {
  private roles = new Map<string, IRole>();
  private logger = getLogger().withContext({ component: 'AuthorizationEngine' });

  constructor() {
    this.setupDefaultRoles();
  }

  /**
   * 認可チェック
   */
  authorize(context: IAuthorizationContext): IAuthorizationResult {
    this.logger.debug('Authorization check', {
      userId: context.userId,
      resource: context.resource,
      action: context.action,
      roles: context.userRoles
    });

    const applicablePermissions: IPermission[] = [];

    // ユーザーのロールから適用可能な権限を収集
    for (const roleName of context.userRoles) {
      const role = this.roles.get(roleName);
      if (!role) {
        this.logger.warn('Unknown role referenced', { role: roleName, userId: context.userId });
        continue;
      }

      for (const permission of role.permissions) {
        if (this.isPermissionApplicable(permission, context)) {
          applicablePermissions.push(permission);
        }
      }
    }

    // 適用可能な権限が見つからない場合は拒否
    if (applicablePermissions.length === 0) {
      return {
        granted: false,
        reason: `No permissions found for action '${context.action}' on resource '${context.resource}'`
      };
    }

    // 条件チェック
    for (const permission of applicablePermissions) {
      if (permission.conditions) {
        const conditionResult = this.evaluateConditions(permission.conditions, context);
        if (!conditionResult.satisfied) {
          return {
            granted: false,
            reason: `Permission condition not met: ${conditionResult.reason}`,
            appliedPermissions: [permission]
          };
        }
      }
    }

    this.logger.debug('Authorization granted', {
      userId: context.userId,
      resource: context.resource,
      action: context.action,
      permissionCount: applicablePermissions.length
    });

    return {
      granted: true,
      appliedPermissions: applicablePermissions
    };
  }

  /**
   * ロールを定義
   */
  defineRole(role: IRole): void {
    this.roles.set(role.name, role);
    this.logger.info('Role defined', {
      name: role.name,
      permissionCount: role.permissions.length
    });
  }

  /**
   * ロールを取得
   */
  getRole(name: string): IRole | undefined {
    return this.roles.get(name);
  }

  /**
   * 全ロールを取得
   */
  getAllRoles(): IRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * 権限が適用可能かチェック
   */
  private isPermissionApplicable(permission: IPermission, context: IAuthorizationContext): boolean {
    // リソースマッチング（ワイルドカード対応）
    if (!this.matchesResource(permission.resource, context.resource)) {
      return false;
    }

    // アクションマッチング（ワイルドカード対応）
    if (!this.matchesAction(permission.action, context.action)) {
      return false;
    }

    return true;
  }

  /**
   * リソースパターンマッチング
   */
  private matchesResource(pattern: string, resource: string): boolean {
    // 完全一致
    if (pattern === resource) {
      return true;
    }

    // ワイルドカード対応
    if (pattern === '*') {
      return true;
    }

    // プレフィックスマッチング (mqtt:* -> mqtt:publish, mqtt:subscribe)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return resource.startsWith(prefix);
    }

    // パス形式のマッチング (/mqtt/+ -> /mqtt/broker1)
    if (pattern.includes('+')) {
      const regex = new RegExp('^' + pattern.replace(/\+/g, '[^/]+') + '$');
      return regex.test(resource);
    }

    return false;
  }

  /**
   * アクションパターンマッチング
   */
  private matchesAction(pattern: string, action: string): boolean {
    return this.matchesResource(pattern, action); // 同じロジックを使用
  }

  /**
   * 条件評価
   */
  private evaluateConditions(
    conditions: ICondition[], 
    context: IAuthorizationContext
  ): { satisfied: boolean; reason?: string } {
    for (const condition of conditions) {
      const result = this.evaluateCondition(condition, context);
      if (!result.satisfied) {
        return result;
      }
    }

    return { satisfied: true };
  }

  /**
   * 単一条件評価
   */
  private evaluateCondition(
    condition: ICondition, 
    context: IAuthorizationContext
  ): { satisfied: boolean; reason?: string } {
    let actualValue: unknown;

    // 条件の値を取得
    switch (condition.type) {
      case 'time':
        actualValue = context.timestamp || new Date();
        break;
      case 'ip':
        actualValue = context.clientIp;
        break;
      case 'resource_attribute':
        actualValue = condition.attribute 
          ? context.resourceAttributes?.[condition.attribute]
          : context.resourceAttributes;
        break;
      case 'user_attribute':
        actualValue = condition.attribute
          ? context.userAttributes?.[condition.attribute]
          : context.userAttributes;
        break;
      default:
        return {
          satisfied: false,
          reason: `Unknown condition type: ${condition.type}`
        };
    }

    // 演算子に基づいて評価
    const satisfied = this.evaluateOperator(condition.operator, actualValue, condition.value);

    return {
      satisfied,
      reason: satisfied ? undefined : `Condition failed: ${condition.type} ${condition.operator} ${condition.value}`
    };
  }

  /**
   * 演算子評価
   */
  private evaluateOperator(operator: string, actual: unknown, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      
      case 'not_equals':
        return actual !== expected;
      
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      
      case 'matches':
        if (typeof actual === 'string' && typeof expected === 'string') {
          const regex = new RegExp(expected);
          return regex.test(actual);
        }
        return false;
      
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          const [min, max] = expected;
          return actual >= min && actual <= max;
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * デフォルトロールの設定
   */
  private setupDefaultRoles(): void {
    // 読み取り専用ユーザー
    this.defineRole({
      name: 'mqtt:reader',
      description: 'Read-only access to MQTT resources',
      permissions: [
        {
          resource: 'mqtt:connections',
          action: 'read'
        },
        {
          resource: 'mqtt:subscriptions',
          action: 'read'
        },
        {
          resource: 'mqtt:messages',
          action: 'read'
        },
        {
          resource: 'mqtt:metrics',
          action: 'read'
        }
      ]
    });

    // 購読ユーザー
    this.defineRole({
      name: 'mqtt:subscriber',
      description: 'Can subscribe to MQTT topics',
      permissions: [
        {
          resource: 'mqtt:*',
          action: 'read'
        },
        {
          resource: 'mqtt:subscriptions',
          action: 'create'
        },
        {
          resource: 'mqtt:subscriptions',
          action: 'delete'
        }
      ]
    });

    // 発行ユーザー
    this.defineRole({
      name: 'mqtt:publisher',
      description: 'Can publish MQTT messages',
      permissions: [
        {
          resource: 'mqtt:*',
          action: 'read'
        },
        {
          resource: 'mqtt:messages',
          action: 'create'
        }
      ]
    });

    // フルアクセスユーザー
    this.defineRole({
      name: 'mqtt:admin',
      description: 'Full access to all MQTT operations',
      permissions: [
        {
          resource: 'mqtt:*',
          action: '*'
        },
        {
          resource: 'system:*',
          action: '*'
        }
      ]
    });

    // システム管理者
    this.defineRole({
      name: 'system:admin',
      description: 'Full system administration access',
      permissions: [
        {
          resource: '*',
          action: '*'
        }
      ]
    });

    // 時間制限付きアクセス（業務時間のみ）
    this.defineRole({
      name: 'mqtt:business_hours',
      description: 'MQTT access during business hours only',
      permissions: [
        {
          resource: 'mqtt:*',
          action: 'read',
          conditions: [
            {
              type: 'time',
              operator: 'between',
              value: ['09:00', '17:00'] // 9AM to 5PM
            }
          ]
        }
      ]
    });

    this.logger.info('Default roles configured', {
      roleCount: this.roles.size
    });
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.roles.clear();
  }
}
```

#### ✅ 完了条件 (Task 1.2)
- [ ] ロールベース認可が動作する
- [ ] 条件付き権限が機能する
- [ ] ワイルドカードマッチングが動作する
- [ ] デフォルトロールが適切に設定されている

---

### Task 2: パフォーマンス最適化 (3日)

#### 2.1 接続プール実装 (4時間)
**ファイル**: `src/performance/connection-pool.ts`

**実装コード**:
```typescript
// src/performance/connection-pool.ts
import { EventEmitter } from 'events';
import { MQTTConnection } from '../services/connection/mqtt-connection';
import { IBrokerConfig } from '../core/interfaces/mqtt-types';
import { ConnectionError, TimeoutError } from '../core/errors/mqtt-errors';
import { getLogger } from '../core/utils/logger';

export interface IConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  validateOnAcquire: boolean;
  validateOnReturn: boolean;
}

export interface IPooledConnection {
  connection: MQTTConnection;
  createdAt: Date;
  lastUsedAt: Date;
  acquiredCount: number;
  isIdle: boolean;
}

export interface IPoolStats {
  totalConnections: number;
  availableConnections: number;
  busyConnections: number;
  waitingRequests: number;
  createdConnections: number;
  destroyedConnections: number;
  acquiredConnections: number;
  releasedConnections: number;
  timeoutErrors: number;
  validationErrors: number;
}

export class ConnectionPool extends EventEmitter {
  private connections: IPooledConnection[] = [];
  private availableConnections: IPooledConnection[] = [];
  private busyConnections: IPooledConnection[] = [];
  private waitingQueue: Array<{
    resolve: (connection: IPooledConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private stats: IPoolStats = {
    totalConnections: 0,
    availableConnections: 0,
    busyConnections: 0,
    waitingRequests: 0,
    createdConnections: 0,
    destroyedConnections: 0,
    acquiredConnections: 0,
    releasedConnections: 0,
    timeoutErrors: 0,
    validationErrors: 0
  };

  private healthCheckTimer?: NodeJS.Timeout;
  private isDestroyed = false;
  
  private logger = getLogger().withContext({ 
    component: 'ConnectionPool',
    brokerId: this.brokerConfig.id 
  });

  constructor(
    private brokerConfig: IBrokerConfig,
    private config: IConnectionPoolConfig
  ) {
    super();
    this.startHealthCheck();
    this.initialize();
  }

  /**
   * 接続を取得
   */
  async acquire(): Promise<IPooledConnection> {
    if (this.isDestroyed) {
      throw new ConnectionError(
        'POOL_DESTROYED',
        'Connection pool has been destroyed'
      );
    }

    // 利用可能な接続があるかチェック
    let connection = this.getAvailableConnection();
    if (connection) {
      return this.markAsBusy(connection);
    }

    // 新しい接続を作成できるかチェック
    if (this.connections.length < this.config.maxConnections) {
      try {
        connection = await this.createConnection();
        return this.markAsBusy(connection);
      } catch (error) {
        this.logger.error('Failed to create new connection', { error });
      }
    }

    // 待機キューに追加
    return this.waitForConnection();
  }

  /**
   * 接続を返却
   */
  async release(pooledConnection: IPooledConnection): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const index = this.busyConnections.indexOf(pooledConnection);
    if (index === -1) {
      this.logger.warn('Attempted to release connection not in busy list');
      return;
    }

    // バリデーションチェック
    if (this.config.validateOnReturn) {
      const isValid = await this.validateConnection(pooledConnection);
      if (!isValid) {
        await this.destroyConnection(pooledConnection);
        this.stats.validationErrors++;
        return;
      }
    }

    // busy リストから削除
    this.busyConnections.splice(index, 1);
    
    // 使用情報を更新
    pooledConnection.lastUsedAt = new Date();
    pooledConnection.isIdle = true;

    // 待機中のリクエストがあれば処理
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      clearTimeout(waiter.timeout);
      waiter.resolve(this.markAsBusy(pooledConnection));
    } else {
      // available リストに追加
      this.availableConnections.push(pooledConnection);
    }

    this.stats.releasedConnections++;
    this.updateStats();

    this.logger.debug('Connection released', {
      connectionId: pooledConnection.connection.getConfig().clientId,
      totalConnections: this.connections.length
    });
  }

  /**
   * プール統計を取得
   */
  getStats(): IPoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * プールを破棄
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.logger.info('Destroying connection pool');

    // ヘルスチェックタイマーを停止
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
    }

    // 待機中のリクエストを拒否
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new ConnectionError(
        'POOL_DESTROYED',
        'Connection pool was destroyed'
      ));
    }
    this.waitingQueue = [];

    // 全接続を破棄
    const destroyPromises = this.connections.map(pooled => 
      this.destroyConnection(pooled)
    );
    
    await Promise.allSettled(destroyPromises);

    this.connections = [];
    this.availableConnections = [];
    this.busyConnections = [];

    this.logger.info('Connection pool destroyed');
    this.emit('destroyed');
  }

  /**
   * プールの初期化
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing connection pool', {
        minConnections: this.config.minConnections,
        maxConnections: this.config.maxConnections
      });

      // 最小接続数まで接続を作成
      const initPromises = Array.from(
        { length: this.config.minConnections }, 
        () => this.createConnection()
      );

      const results = await Promise.allSettled(initPromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      this.logger.info('Connection pool initialized', {
        successfulConnections: successCount,
        failedConnections: failureCount
      });

      if (successCount === 0) {
        throw new ConnectionError(
          'POOL_INIT_FAILED',
          'Failed to create any initial connections'
        );
      }

    } catch (error) {
      this.logger.error('Failed to initialize connection pool', { error });
      throw error;
    }
  }

  /**
   * 新しい接続を作成
   */
  private async createConnection(): Promise<IPooledConnection> {
    this.logger.debug('Creating new connection');

    const connection = new MQTTConnection(this.brokerConfig);
    
    try {
      await connection.connect();
      
      const pooledConnection: IPooledConnection = {
        connection,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        acquiredCount: 0,
        isIdle: true
      };

      this.connections.push(pooledConnection);
      this.availableConnections.push(pooledConnection);
      this.stats.createdConnections++;

      this.setupConnectionEventHandlers(pooledConnection);

      this.logger.debug('Connection created successfully', {
        connectionId: connection.getConfig().clientId,
        totalConnections: this.connections.length
      });

      return pooledConnection;

    } catch (error) {
      connection.dispose();
      throw error;
    }
  }

  /**
   * 接続を破棄
   */
  private async destroyConnection(pooledConnection: IPooledConnection): Promise<void> {
    try {
      // 各リストから削除
      this.removeFromList(this.connections, pooledConnection);
      this.removeFromList(this.availableConnections, pooledConnection);
      this.removeFromList(this.busyConnections, pooledConnection);

      // 実際の接続を切断
      await pooledConnection.connection.disconnect(true);
      pooledConnection.connection.dispose();

      this.stats.destroyedConnections++;

      this.logger.debug('Connection destroyed', {
        connectionId: pooledConnection.connection.getConfig().clientId,
        totalConnections: this.connections.length
      });

    } catch (error) {
      this.logger.error('Error destroying connection', { error });
    }
  }

  /**
   * 利用可能な接続を取得
   */
  private getAvailableConnection(): IPooledConnection | null {
    if (this.availableConnections.length === 0) {
      return null;
    }

    const connection = this.availableConnections.shift()!;

    // バリデーションチェック
    if (this.config.validateOnAcquire) {
      if (!this.validateConnectionSync(connection)) {
        this.destroyConnection(connection);
        this.stats.validationErrors++;
        return this.getAvailableConnection(); // 再帰的に次の接続を試す
      }
    }

    return connection;
  }

  /**
   * 接続を使用中にマーク
   */
  private markAsBusy(pooledConnection: IPooledConnection): IPooledConnection {
    pooledConnection.isIdle = false;
    pooledConnection.acquiredCount++;
    pooledConnection.lastUsedAt = new Date();

    this.busyConnections.push(pooledConnection);
    this.stats.acquiredConnections++;

    return pooledConnection;
  }

  /**
   * 接続を待機
   */
  private async waitForConnection(): Promise<IPooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeFromWaitingQueue(resolve);
        this.stats.timeoutErrors++;
        reject(new TimeoutError(
          'ACQUIRE_TIMEOUT',
          `Failed to acquire connection within ${this.config.acquireTimeout}ms`,
          this.config.acquireTimeout
        ));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({ resolve, reject, timeout });
      this.stats.waitingRequests++;
    });
  }

  /**
   * 待機キューから削除
   */
  private removeFromWaitingQueue(resolve: Function): void {
    const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
    if (index !== -1) {
      const waiter = this.waitingQueue.splice(index, 1)[0];
      clearTimeout(waiter.timeout);
      this.stats.waitingRequests--;
    }
  }

  /**
   * 接続の検証（同期）
   */
  private validateConnectionSync(pooledConnection: IPooledConnection): boolean {
    return pooledConnection.connection.isConnected();
  }

  /**
   * 接続の検証（非同期）
   */
  private async validateConnection(pooledConnection: IPooledConnection): Promise<boolean> {
    try {
      // 基本的な接続状態チェック
      if (!pooledConnection.connection.isConnected()) {
        return false;
      }

      // 簡単なping（実装依存）
      // 実際の実装では、軽量なMQTTメッセージを送信してレスポンスを確認
      return true;

    } catch (error) {
      this.logger.debug('Connection validation failed', { error });
      return false;
    }
  }

  /**
   * 接続イベントハンドラーを設定
   */
  private setupConnectionEventHandlers(pooledConnection: IPooledConnection): void {
    const connection = pooledConnection.connection;

    connection.on('disconnected', () => {
      this.logger.warn('Pooled connection disconnected unexpectedly');
      this.destroyConnection(pooledConnection);
    });

    connection.on('error', (error) => {
      this.logger.error('Pooled connection error', { error });
      this.destroyConnection(pooledConnection);
    });
  }

  /**
   * ヘルスチェック開始
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * ヘルスチェック実行
   */
  private async performHealthCheck(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const now = new Date();
    const idleConnections = this.availableConnections.filter(pooled => {
      const idleTime = now.getTime() - pooled.lastUsedAt.getTime();
      return idleTime > this.config.idleTimeout;
    });

    // アイドル時間を超えた接続を削除（最小接続数は維持）
    for (const pooled of idleConnections) {
      if (this.connections.length > this.config.minConnections) {
        await this.destroyConnection(pooled);
      }
    }

    // 最小接続数を下回っている場合は接続を追加
    const deficit = this.config.minConnections - this.connections.length;
    if (deficit > 0) {
      const createPromises = Array.from({ length: deficit }, () => 
        this.createConnection().catch(error => {
          this.logger.error('Failed to create connection during health check', { error });
        })
      );
      
      await Promise.allSettled(createPromises);
    }
  }

  /**
   * 統計を更新
   */
  private updateStats(): void {
    this.stats.totalConnections = this.connections.length;
    this.stats.availableConnections = this.availableConnections.length;
    this.stats.busyConnections = this.busyConnections.length;
    this.stats.waitingRequests = this.waitingQueue.length;
  }

  /**
   * リストから要素を削除
   */
  private removeFromList<T>(list: T[], item: T): void {
    const index = list.indexOf(item);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }
}
```

#### ✅ 完了条件 (Task 2.1)
- [ ] 接続プールが効率的に動作する
- [ ] 最小/最大接続数が管理される
- [ ] ヘルスチェックが機能する
- [ ] 統計情報が正確に収集される

---

この時点で、Phase 4 の主要なセキュリティ機能とパフォーマンス最適化の基盤が完成しています。残りのタスク（監視機能、プラグインシステム等）も同様のパターンで実装指示を作成可能です。

続きのタスクについてご指示をお願いします。