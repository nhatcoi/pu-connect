import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private pool: Pool

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'

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

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now()
    const res = await this.pool.query<T>(text, params)
    const duration = Date.now() - start
    if (duration > 200) {
      this.logger.warn(`Slow Query [${duration}ms]: ${text.slice(0, 80)}...`)
    }
    return res
  }

  /**
   * Execute multiple operations within an atomic ACID transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const start = Date.now()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      const duration = Date.now() - start
      if (duration > 300) {
        this.logger.warn(`Slow Transaction [${duration}ms]`)
      }
      return result
    } catch (error: any) {
      await client.query('ROLLBACK')
      this.logger.error(`Transaction rolled back due to error: ${error.message}`)
      throw error
    } finally {
      client.release()
    }
  }

  getPool(): Pool {
    return this.pool
  }
}
