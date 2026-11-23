import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../common/constants/auth.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { loadEnv } from '../../config/env';
import { ACCESS_TTL_S, AuthService, REFRESH_TTL_S } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setCookies(res: Response, access: string, refresh: string) {
    const secure = loadEnv().COOKIE_SECURE;
    res.cookie(ACCESS_COOKIE, access, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: ACCESS_TTL_S * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { httpOnly: true, secure, sameSite: 'lax', path: '/api/v1/auth', maxAge: REFRESH_TTL_S * 1000 });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  @ApiOperation({ summary: 'Register a buyer account and sign in' })
  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  @ResponseMessage('Account created')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.register(dto);
    this.setCookies(res, accessToken, refreshToken);
    return { user: await this.auth.me(user.id), accessToken };
  }

  @ApiOperation({ summary: 'Sign in with email and password; returns a JWT access token' })
  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  @ResponseMessage('Signed in')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto.email, dto.password);
    this.setCookies(res, accessToken, refreshToken);
    return { user: await this.auth.me(user.id), accessToken };
  }

  @ApiOperation({ summary: 'Rotate the refresh token (cookie) and issue a new access token' })
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, accessToken, refreshToken } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      this.setCookies(res, accessToken, refreshToken);
      return { user: await this.auth.me(user.id) };
    } catch (err) {
      this.clearCookies(res);
      throw err;
    }
  }

  @ApiOperation({ summary: 'Sign out and revoke the refresh token' })
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
  }

  @ApiOperation({ summary: 'Email a password reset link (always answers 200)' })
  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If an account exists for this email, a reset link has been sent.' };
  }

  @ApiOperation({ summary: 'Set a new password with a reset token' })
  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'Your password has been changed. You can now sign in.' };
  }

  @ApiOperation({ summary: 'Profile of the signed-in user' })
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiOperation({ summary: 'Update own name and phone' })
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @ApiOperation({ summary: 'Change own password' })
  @Throttle(AUTH_LIMIT)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
