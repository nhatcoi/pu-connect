import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { UsersService } from './users.service'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import { UpdatePrivacySettingsSchema, type UpdateProfileInput, type UpdatePrivacySettingsInput } from '@pu/schemas'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { Request } from 'express'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  async getProfile(@Param('username') username: string, @Req() req: Request) {
    const viewerId = (req.user as any)?.id || (req.session as any)?.passport?.user?.id
    return this.usersService.getProfileByUsername(username, viewerId)
  }

  @Patch('profile')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Req() req: Request, @Body() body: UpdateProfileInput) {
    const userId = (req.user as any).id
    const updated = await this.usersService.updateProfile(userId, body)
    // Cập nhật lại session object
    if (req.user) {
      Object.assign(req.user, updated)
    }
    return updated
  }

  @Patch('privacy')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async updatePrivacy(@Req() req: Request, @Body(new ZodValidationPipe(UpdatePrivacySettingsSchema)) body: UpdatePrivacySettingsInput) {
    const userId = (req.user as any).id
    return this.usersService.updatePrivacySettings(userId, body)
  }

  @Post('verify-university')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async verifyUniversity(@Req() req: Request) {
    const userId = (req.user as any).id
    return this.usersService.verifyUniversityAccount(userId)
  }
}
