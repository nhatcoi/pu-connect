import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import type { RegisterInput, LoginInput, UserProfile } from '@pu/schemas'

@Injectable()
export class AuthService {
  private users: Array<UserProfile & { passwordHash: string }> = [
    {
      id: 'user_1',
      email: 'alex@example.com',
      username: 'techlead',
      displayName: 'Alex Nguyễn',
      avatarUrl: null,
      bio: 'Solutions Architect & Tech Lead',
      createdAt: new Date().toISOString(),
      passwordHash: bcrypt.hashSync('password123', 10)
    }
  ]

  constructor(private readonly jwtService: JwtService) {}

  async register(data: RegisterInput) {
    const existing = this.users.find(
      (u) => u.email === data.email || u.username === data.username
    )
    if (existing) {
      throw new ConflictException('Email hoặc Username đã tồn tại')
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(data.password, salt)

    const newUser = {
      id: `user_${Date.now()}`,
      email: data.email,
      username: data.username,
      displayName: data.displayName,
      avatarUrl: null,
      bio: null,
      createdAt: new Date().toISOString(),
      passwordHash
    }

    this.users.push(newUser)

    const token = this.generateToken(newUser)
    const { passwordHash: _, ...profile } = newUser

    return {
      user: profile,
      token
    }
  }

  async login(data: LoginInput) {
    const user = this.users.find(
      (u) => u.email === data.emailOrUsername || u.username === data.emailOrUsername
    )
    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác')
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash)
    if (!isMatch) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác')
    }

    const token = this.generateToken(user)
    const { passwordHash: _, ...profile } = user

    return {
      user: profile,
      token
    }
  }

  private generateToken(user: { id?: string; username?: string; email?: string }) {
    return this.jwtService.sign({
      sub: user.id || '',
      username: user.username || '',
      email: user.email || ''
    })
  }
}
