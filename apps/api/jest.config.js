// Integration test: chạy trên DB riêng (TEST_DATABASE_URL), cần Postgres + Redis (docker compose up -d)
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@pu/schemas$': '<rootDir>/../../packages/schemas/src'
  },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/env.ts'],
  // Các file test dùng chung 1 DB ⇒ chạy tuần tự
  maxWorkers: 1,
  testTimeout: 30000
}
