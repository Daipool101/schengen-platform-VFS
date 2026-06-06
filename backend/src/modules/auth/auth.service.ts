import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import { SUPABASE_CLIENT } from '../../database/database.module';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    const { password_hash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string; user: any }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<{ access_token: string; user: any }> {
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', registerDto.email.toLowerCase())
      .single();

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert({
        email: registerDto.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: registerDto.full_name ?? null,
      })
      .select('id, email, full_name, created_at')
      .single();

    if (error || !newUser) {
      throw new ConflictException('Failed to create account. Please try again.');
    }

    const payload = { sub: newUser.id, email: newUser.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
      },
    };
  }
}
