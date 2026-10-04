import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { LocalStrategy } from './local.strategy'
import { GoogleStrategy } from './google.strategy'
import { SessionSerializer } from './session.serializer'
import { MailService } from './mail.service'
import { GOOGLE_AUTH_ENABLED } from './auth.constants'


@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    LocalStrategy,
    SessionSerializer,
    {
      provide: GOOGLE_AUTH_ENABLED,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        !!(
          config.get('GOOGLE_CLIENT_ID') &&
          config.get('GOOGLE_CLIENT_SECRET') &&
          config.get('GOOGLE_CALLBACK_URL')
        )
    },
    {
      provide: GoogleStrategy,
      inject: [ConfigService, AuthService, GOOGLE_AUTH_ENABLED],
      useFactory: (config: ConfigService, authService: AuthService, enabled: boolean) =>
        enabled
          ? new GoogleStrategy(
              {
                clientID: config.get<string>('GOOGLE_CLIENT_ID')!,
                clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET')!,
                callbackURL: config.get<string>('GOOGLE_CALLBACK_URL')!
              },
              authService
            )
          : null
    }
  ],
  exports: [AuthService, PassportModule]
})
export class AuthModule {}
