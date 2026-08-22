import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './modules/auth/auth.module'
import { PostsModule } from './modules/posts/posts.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { RealtimeModule } from './modules/realtime/realtime.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    PostsModule,
    DocumentsModule,
    RealtimeModule
  ]
})
export class AppModule {}
