import { Controller, Get, Patch, Post, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { UsersService } from './users.service'
import { FollowSuggestionsService } from './follow-suggestions.service'
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard'
import type { UpdateProfileInput, UpdatePrivacySettingsInput } from '@pu/schemas'
import { UpdatePrivacyBodySchema } from './dto/privacy.dto'
import { UpdatePreferencesBodySchema, type UpdatePreferencesInput } from './dto/preferences.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { Request } from 'express'

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly suggestions: FollowSuggestionsService
  ) {}

  // Gợi ý theo dõi đã xếp hạng (đặt trước ':username' để không bị route động bắt)
  @Get('suggestions')
  @UseGuards(AuthenticatedGuard)
  async getSuggestions(@Req() req: Request, @Query('limit') limit?: string) {
    return this.suggestions.list((req.user as any).id, parseInt(limit ?? '', 10) || 20)
  }

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
  async updatePrivacy(@Req() req: Request, @Body(new ZodValidationPipe(UpdatePrivacyBodySchema)) body: UpdatePrivacySettingsInput) {
    const userId = (req.user as any).id
    return this.usersService.updatePrivacySettings(userId, body)
  }

  // Bật/tắt tính năng (Feature plugs) — lưu ngay từng công tắc
  @Patch('preferences')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async updatePreferences(@Req() req: Request, @Body(new ZodValidationPipe(UpdatePreferencesBodySchema)) body: UpdatePreferencesInput) {
    const userId = (req.user as any).id
    return this.usersService.updatePreferences(userId, body)
  }

  @Post('verify-university')
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.OK)
  async verifyUniversity(@Req() req: Request) {
    const userId = (req.user as any).id
    return this.usersService.verifyUniversityAccount(userId)
  }
}
