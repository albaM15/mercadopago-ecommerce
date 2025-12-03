import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor(private configService: ConfigService) {
    // Inicializa Mercado Pago con tu Access Token
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN no está configurado en las variables de entorno');
    }

    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: { timeout: 5000 }
    });
  }

  /**
   * Crea una preferencia de pago (para Checkout Pro/Wallet)
   */
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
          success: `${this.configService.get('FRONTEND_URL')}/pago-exitoso`,
          failure: `${this.configService.get('FRONTEND_URL')}/pago-fallido`,
          pending: `${this.configService.get('FRONTEND_URL')}/pago-pendiente`,
        },
        auto_return: 'approved' as const,
        external_reference: createPreferenceDto.orderId,
        notification_url: `${this.configService.get('BACKEND_URL')}/payment/webhook`,
        statement_descriptor: 'MI TIENDA',
        payment_methods: {
          installments: 12,
        },
      };

      const response = await preference.create({ body: preferenceData });

      return {
        preferenceId: response.id,
        initPoint: response.init_point,
        sandboxInitPoint: response.sandbox_init_point,
      };
    } catch (error) {
      console.error('Error creando preferencia:', error);
      throw new HttpException(
        'Error al crear la preferencia de pago',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Procesa un pago directo (para Payment Brick)
   */
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
        notification_url: `${this.configService.get('BACKEND_URL')}/payment/webhook`,
      };

      const response = await payment.create({ body: paymentData });

      return {
        id: response.id,
        status: response.status,
        status_detail: response.status_detail,
        external_reference: response.external_reference,
      };
    } catch (error) {
      console.error('Error procesando pago:', error);
      throw new HttpException(
        'Error al procesar el pago',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Maneja el webhook de notificaciones
   */
  async handleWebhook(body: any, query: any) {
    try {
      const { type, data } = body;

      if (type === 'payment') {
        const paymentId = data.id;
        const payment = new Payment(this.client);
        
        const paymentInfo = await payment.get({ id: paymentId });

        const status = paymentInfo.status;
        const orderId = paymentInfo.external_reference;
        const amount = paymentInfo.transaction_amount;

        // Aquí actualizas el estado del pedido en tu base de datos
        console.log('Payment Status:', {
          paymentId,
          status,
          orderId,
          amount,
        });

        // Ejemplo: actualizar en base de datos
        // await this.orderService.updateOrderStatus(orderId, status, paymentId);

        if (status === 'approved') {
          // Pedido aprobado: marcar como pagado, enviar email, etc.
          console.log(`✅ Pago aprobado para orden ${orderId}`);
        } else if (status === 'pending') {
          // Pago pendiente
          console.log(`⏳ Pago pendiente para orden ${orderId}`);
        } else if (status === 'rejected') {
          // Pago rechazado
          console.log(`❌ Pago rechazado para orden ${orderId}`);
        }
      }

      return { status: 'ok' };
    } catch (error) {
      console.error('Error en webhook:', error);
      throw new HttpException(
        'Error procesando webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}