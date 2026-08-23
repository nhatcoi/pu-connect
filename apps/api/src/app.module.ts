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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
      playground: true,
      context: ({ req, res }) => ({ req, res })
    }),
    DatabaseModule,
    SocialGraphQLModule,
    AuthModule,
    PostsModule,
    DocumentsModule,
    RealtimeModule,
    CoursesModule,
    StudyGroupsModule,
    CampusModule,
    StorageModule
  ]
})
export class AppModule {}
