// Trỏ API sang DB test trước khi import AppModule (DatabaseService đọc process.env lúc khởi tạo)
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_test'

process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.NODE_ENV = 'test'
process.env.SMTP_HOST = ''
