import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RespondQuoteDto } from './dto/respond-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { QuotesService } from './quotes.service';
import { ArchiveRequestDto } from '../common/dto/archive-request.dto';

@Controller('quotes')
@UseGuards(AuthGuard('jwt'))
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}
  @Post() create(@Body() data: CreateQuoteDto, @Request() req) {
    return this.quotesService.create(data, req.user?.id);
  }
  @Get('my-quotes') findMine(@Request() req) {
    return this.quotesService.findByUser(req.user?.id);
  }
  @Get('business/:businessId') findBusiness(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Request() req,
  ) {
    return this.quotesService.findByBusiness(businessId, req.user);
  }
  @Patch(':id/respond') respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: RespondQuoteDto,
    @Request() req,
  ) {
    return this.quotesService.respond(id, data, req.user);
  }
  @Patch(':id/status') updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateQuoteStatusDto,
    @Request() req,
  ) {
    return this.quotesService.updateCustomerStatus(id, data.status, req.user);
  }
  @Patch(':id/archive') archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: ArchiveRequestDto,
    @Request() req,
  ) {
    return this.quotesService.setArchived(id, data.archived, req.user);
  }
}
