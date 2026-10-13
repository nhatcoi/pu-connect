import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './modules/auth/auth.module'
import { PostsModule } from './modules/posts/posts.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { RealtimeModule } from './modules/realtime/realtime.module'
import { CoursesModule } from './modules/courses/courses.module'
import { StudyGroupsModule } from './modules/study-groups/study-groups.module'
import { CampusModule } from './modules/campus/campus.module'
import { SocialGraphQLModule } from './modules/graphql/social-graphql.module'
import { StorageModule } from './modules/storage/storage.module'
import { SearchModule } from './modules/search/search.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { CommunitiesModule } from './modules/communities/communities.module'
import { UsersModule } from './modules/users/users.module'
import { QueueModule } from './modules/queue/queue.module'
import { AdminModule } from './modules/admin/admin.module'
import { ChatModule } from './modules/chat/chat.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
      // Playground/introspection chỉ bật khi dev
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }) => ({ req, res })
    }),
    DatabaseModule,
    QueueModule,
    SocialGraphQLModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommunitiesModule,
    DocumentsModule,
    RealtimeModule,
    CoursesModule,
    StudyGroupsModule,
    CampusModule,
    StorageModule,
    SearchModule,
    NotificationsModule,
    AdminModule,
    ChatModule
  ]
})
export class AppModule {}
