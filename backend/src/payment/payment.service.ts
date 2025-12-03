import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    
    if (!accessToken) {
      console.error('❌ NO SE ENCONTRÓ EL ACCESS TOKEN EN .ENV');
      throw new Error('MP_ACCESS_TOKEN no está configurado');
    }

    console.log('✅ Mercado Pago inicializado correctamente');
    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: { timeout: 5000 }
    });
  }

  async createPreference(createPreferenceDto: CreatePreferenceDto) {
    try {
      const preference = new Preference(this.client);

      const preferenceData = {
        items: createPreferenceDto.items.map((item, index) => ({
          id: `item-${index + 1}`,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: item.currency_id,
        })),
        payer: {
          email: createPreferenceDto.customerEmail,
        },
        back_urls: {
          success: 'http://localhost:3000/pago-exitoso',
          failure: 'http://localhost:3000/pago-fallido',
          pending: 'http://localhost:3000/pago-pendiente',
        },
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12,
        },
        external_reference: createPreferenceDto.orderId,
        notification_url: `${this.configService.get('BACKEND_URL') || 'http://localhost:3001'}/payment/webhook`,
        statement_descriptor: 'MI TIENDA',
      };

      console.log('🚀 Creando preferencia...');
      const response = await preference.create({ body: preferenceData });
      console.log('✅ ID DE PREFERENCIA:', response.id);

      return {
        preferenceId: response.id,
        initPoint: response.init_point,
      };
    } catch (error) {
      console.error('❌ Error detallado de Mercado Pago:', JSON.stringify(error, null, 2));
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Error al crear la preferencia',
          message: error.message,
          details: error.cause || error // Para que veas el detalle en el frontend/curl
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async processPayment(createPaymentDto: CreatePaymentDto) {
    try {
      const payment = new Payment(this.client);

      const paymentData = {
        transaction_amount: createPaymentDto.transactionAmount,
        token: createPaymentDto.token,
        description: `Pago orden #${createPaymentDto.orderId}`,
        installments: createPaymentDto.installments,
        payment_method_id: createPaymentDto.paymentMethodId,
        payer: {
          email: createPaymentDto.email,
          ...(createPaymentDto.payer?.identification && {
            identification: createPaymentDto.payer.identification,
          }),
        },
        external_reference: createPaymentDto.orderId,
      };

      console.log('💳 Procesando pago directo...');
      const response = await payment.create({ body: paymentData });
      console.log('✅ Estado del pago:', response.status);

      return {
        id: response.id,
        status: response.status,
        status_detail: response.status_detail,
      };
    } catch (error) {
      console.error('❌ Error al procesar pago:', error);
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          message: 'Error al procesar el pago',
          details: error.message
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async handleWebhook(body: any, query: any) {
    // Implementación simple del webhook
    return { status: 'ok' };
  }
}