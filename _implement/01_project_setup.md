# プロジェクト初期化ガイド

## 🎯 目標
MQTT MCP Server プロジェクトの開発環境を構築し、基本的なプロジェクト構造を作成します。

## ⏰ 作業時間
**推定時間**: 1日 (8時間)

## 📋 前提条件
- Node.js v18.0+ がインストール済み
- npm v8.0+ が利用可能
- Git が設定済み
- VS Code (推奨エディタ) がインストール済み

## 🔧 タスク詳細

### Task 1: Node.js プロジェクト初期化 (30分)

#### 1.1 package.json 作成
```bash
cd /path/to/mqtt-mcp-server
npm init -y
```

#### 1.2 package.json 編集
```json
{
  "name": "mqtt-mcp-server",
  "version": "0.1.0",
  "description": "MQTT Model Context Protocol Server for Claude Desktop integration",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc -w",
    "start": "node dist/index.js",
    "dev": "npm run build:watch & nodemon dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "clean": "rimraf dist",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "keywords": ["mqtt", "mcp", "claude", "desktop", "model-context-protocol"],
  "author": "Your Name",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

#### ✅ 完了条件
- package.json が作成され、適切なメタデータが設定されている
- npm スクリプトが定義されている

### Task 2: TypeScript 設定 (45分)

#### 2.1 TypeScript と関連パッケージのインストール
```bash
# TypeScript コンパイラ
npm install -D typescript @types/node

# 開発ツール
npm install -D nodemon rimraf ts-node

# TypeScript 設定
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

#### 2.2 tsconfig.json 作成
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

#### 2.3 tsconfig.test.json 作成 (テスト用設定)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist-test",
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

#### ✅ 完了条件
- TypeScript コンパイルが成功する
- 厳格な型チェックが有効になっている
- テスト用設定が分離されている

### Task 3: リンター・フォーマッター設定 (45分)

#### 3.1 ESLint インストールと設定
```bash
npm install -D eslint prettier eslint-config-prettier eslint-plugin-prettier
```

#### 3.2 .eslintrc.js 作成
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  rules: {
    // コード品質
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    
    // TypeScript 固有
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    
    // 命名規則
    '@typescript-eslint/naming-convention': [
      'error',
      {
        'selector': 'interface',
        'format': ['PascalCase'],
        'prefix': ['I']
      },
      {
        'selector': 'class',
        'format': ['PascalCase']
      },
      {
        'selector': 'enum',
        'format': ['PascalCase']
      }
    ],
    
    // Prettier
    'prettier/prettier': 'error'
  },
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js']
};
```

#### 3.3 .prettierrc.js 作成
```javascript
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  arrowParens: 'always',
  bracketSpacing: true,
  proseWrap: 'preserve'
};
```

#### 3.4 .prettierignore 作成
```
dist/
node_modules/
coverage/
*.log
*.md
```

#### ✅ 完了条件
- ESLint が設定され、TypeScript ファイルを正しく解析する
- Prettier が設定され、コードフォーマットが統一される
- IDE (VS Code) で自動修正が動作する

### Task 4: テストフレームワーク設定 (60分)

#### 4.1 Jest インストール
```bash
npm install -D jest @types/jest ts-jest
```

#### 4.2 jest.config.js 作成
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true
};
```

#### 4.3 tests/setup.ts 作成
```typescript
// Jest グローバル設定
import 'jest';

// カスタムマッチャーの設定
expect.extend({
  toBeValidMQTTTopic(received: string) {
    const pass = /^[^#+]*(\+[^#+]*)*#?$/.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid MQTT topic`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid MQTT topic`,
        pass: false,
      };
    }
  },
});

// テスト用のグローバル設定
global.console = {
  ...console,
  // テスト実行時のコンソール出力を制御
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// テストタイムアウトの設定
jest.setTimeout(30000);
```

#### 4.4 基本テストファイル作成
```typescript
// tests/example.test.ts
describe('Project Setup', () => {
  test('TypeScript compilation works', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  test('Jest is properly configured', () => {
    expect(true).toBeTruthy();
  });
});
```

#### ✅ 完了条件
- Jest が TypeScript ファイルを正しく実行する
- カバレージ測定が動作する
- テストが `npm test` で実行できる

### Task 5: プロジェクト構造作成 (45分)

#### 5.1 ディレクトリ構造作成
```bash
mkdir -p src/{core/{interfaces,errors,config,utils},services/{connection,messaging,subscription,events},mcp/{tools,resources,server},plugins}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs/api
```

#### 5.2 基本ファイル作成

**src/index.ts**
```typescript
/**
 * MQTT MCP Server Entry Point
 */
export { MCPServer } from './mcp/server/mcp-server';
export * from './core/interfaces';
export * from './core/errors';

// バージョン情報
export const VERSION = '0.1.0';
```

**src/core/interfaces/index.ts**
```typescript
/**
 * 共通インターフェース定義
 */

// 基本型定義をエクスポート
export * from './mqtt-types';
export * from './mcp-types';
export * from './config-types';
export * from './error-types';
```

**src/core/errors/index.ts**
```typescript
/**
 * エラー定義
 */

export enum ErrorCategory {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class MQTTMCPError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly timestamp: Date;

  constructor(
    category: ErrorCategory,
    code: string,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.category = category;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.name = 'MQTTMCPError';
  }
}
```

#### 5.3 .gitignore 更新
```gitignore
# Dependency directories
node_modules/

# Build outputs
dist/
dist-test/

# Test coverage
coverage/

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/
```

#### ✅ 完了条件
- 適切なディレクトリ構造が作成されている
- 基本ファイルが配置されている
- Git で追跡されている

### Task 6: 開発ツール設定 (45分)

#### 6.1 VS Code 設定ファイル作成

**.vscode/settings.json**
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "eslint.validate": ["typescript"],
  "typescript.format.enable": false,
  "javascript.format.enable": false
}
```

**.vscode/extensions.json**
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "ms-vscode.vscode-json"
  ]
}
```

**.vscode/launch.json**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug TypeScript",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

**.vscode/tasks.json**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "typescript",
      "tsconfig": "tsconfig.json",
      "problemMatcher": ["$tsc"],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "watch",
      "type": "typescript",
      "tsconfig": "tsconfig.json",
      "option": "watch",
      "problemMatcher": ["$tsc-watch"],
      "group": "build"
    }
  ]
}
```

#### 6.2 nodemon 設定

**nodemon.json**
```json
{
  "watch": ["dist"],
  "ext": "js",
  "ignore": ["dist/**/*.test.js", "dist/**/*.spec.js"],
  "exec": "node dist/index.js",
  "env": {
    "NODE_ENV": "development"
  }
}
```

#### ✅ 完了条件
- VS Code でTypeScript開発環境が正しく動作する
- デバッグ設定が動作する
- ホットリロードが機能する

### Task 7: 設定テスト・検証 (30分)

#### 7.1 ビルドテスト
```bash
npm run build
```

#### 7.2 リントテスト
```bash
npm run lint
```

#### 7.3 フォーマットテスト
```bash
npm run format
```

#### 7.4 テスト実行
```bash
npm test
```

#### 7.5 カバレージテスト
```bash
npm run test:coverage
```

#### ✅ 完了条件
- 全てのnpmスクリプトが正常実行される
- TypeScriptコンパイルが成功する
- リント・フォーマットが適用される
- テストが実行され、カバレージが出力される

## 🚨 トラブルシューティング

### 一般的な問題と解決策

#### Node.js バージョン不一致
```bash
# Node.js バージョン確認
node --version

# nvm使用の場合
nvm install 18
nvm use 18
```

#### TypeScript コンパイルエラー
```bash
# 型定義の再インストール
npm install -D @types/node

# TypeScript バージョン確認
npx tsc --version
```

#### ESLint 設定エラー
```bash
# ESLint 設定チェック
npx eslint --print-config src/index.ts

# 設定ファイル検証
npx eslint src/index.ts --debug
```

#### Jest 実行エラー
```bash
# Jest 設定検証
npx jest --showConfig

# TypeScript設定確認
npx ts-jest config:init
```

## 📋 チェックリスト

プロジェクト初期化完了前に以下を確認：

- [ ] package.json が適切に設定されている
- [ ] TypeScript コンパイルが成功する
- [ ] ESLint がエラーなく実行される
- [ ] Prettier でコードフォーマットができる
- [ ] Jest でテストが実行できる
- [ ] カバレージレポートが生成される
- [ ] VS Code で適切にデバッグできる
- [ ] 全 npm スクリプトが動作する
- [ ] プロジェクト構造が正しく作成されている
- [ ] Git で適切に管理されている

## 🎯 次のステップ

プロジェクト初期化完了後：

1. **Phase 1 基盤実装** に進む
2. 基本的な型定義を実装する
3. 設定管理システムを構築する
4. ログシステムを実装する

---

**完了予定時間**: 1日  
**次回タスク**: Phase 1 - 基盤実装  
**質問・相談**: 開発チームSlackチャンネル