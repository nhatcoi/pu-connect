import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Pool, QueryResult, QueryResultRow } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private pool: Pool

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect()
      this.logger.log('Connected to PostgreSQL Database (pu_connector_db)')
      client.release()
    } catch (err: any) {
      this.logger.error(`Database connection failed: ${err.message}`)
    }
  }

  async onModuleDestroy() {
    await this.pool.end()
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now()
    const res = await this.pool.query<T>(text, params)
    const duration = Date.now() - start
    if (duration > 200) {
      this.logger.warn(`Slow Query [${duration}ms]: ${text.slice(0, 80)}...`)
    }
    return res
  }

  getPool(): Pool {
    return this.pool
  }
}
