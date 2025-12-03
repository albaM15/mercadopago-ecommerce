import { Controller, Post, Body, Get, Query, HttpCode } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /payment/create-preference
   * Crea una preferencia de pago
   */
  @Post('create-preference')
  async createPreference(@Body() createPreferenceDto: CreatePreferenceDto) {
    return this.paymentService.createPreference(createPreferenceDto);
  }

  /**
   * POST /payment/process
   * Procesa un pago directo
   */
  @Post('process')
  async processPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.processPayment(createPaymentDto);
  }

  /**
   * POST /payment/webhook
   * Webhook para notificaciones de Mercado Pago
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() body: any, @Query() query: any) {
    return this.paymentService.handleWebhook(body, query);
  }

  /**
   * GET /payment/health
   * Health check
   */
  @Get('health')
  health() {
    return { status: 'ok', message: 'Payment service is running' };
  }
}