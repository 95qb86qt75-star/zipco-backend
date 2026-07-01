import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private ensureIsAdmin(currentUser?: { role?: string }) {
    if (currentUser?.role === 'admin') {
      return;
    }

    throw new ForbiddenException('No tienes permiso para listar usuarios');
  }

  private ensureCanAccessUser(targetUserId: number, currentUser?: { id?: number; role?: string }) {
    if (currentUser?.role === 'admin' || currentUser?.id === targetUserId) {
      return;
    }

    throw new ForbiddenException('No tienes permiso para acceder a este usuario');
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Request() req) {
    this.ensureIsAdmin(req.user);
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    this.ensureCanAccessUser(id, req.user);
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() data: Partial<User>, @Request() req) {
    this.ensureIsAdmin(req.user);
    const { role, ...safeData } = data;
    return this.usersService.create(safeData);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<User>, @Request() req) {
    this.ensureCanAccessUser(id, req.user);
    const { role, ...safeData } = data;
    return this.usersService.update(id, safeData);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    this.ensureCanAccessUser(id, req.user);
    return this.usersService.remove(id);
  }
}
