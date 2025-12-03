# Guía de Integración de Mercado Pago en NestJS

## 1. Arquitectura: ¿Dónde encaja Mercado Pago?

En tu API real, el módulo de pagos no debe "flotar" solo. Debe ser un servicio auxiliar que es llamado por tu módulo de Órdenes (Orders).

### Flujo correcto en una API real:

1. **Frontend**: Usuario confirma carrito → Llama a `POST /orders` (Tu API)
2. **API (OrdersService)**: Guarda la orden en Base de Datos con estado `PENDING`
3. **API (OrdersService)**: Llama a `PaymentService.createPreference(order)`
4. **API (PaymentService)**: Devuelve el `preferenceId` al Frontend
5. **Frontend**: Pinta el Brick con ese ID

---

## 2. Checklist de Migración

### A. Dependencias y Entorno

**Instalación:**
```bash
pnpm add mercadopago
```

**Variables de entorno (.env):**
```env
MP_ACCESS_TOKEN=TU_TOKEN_REAL_PRODUCCION
API_URL=https://tu-dominio.com/api
```

> ⚠️ **IMPORTANTE**: En producción usa credenciales reales, no de prueba

---

### B. El Módulo (PaymentModule)

```typescript
// src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  providers: [PaymentService],
  exports: [PaymentService], // 👈 IMPORTANTE: Exportarlo para que OrdersModule lo use
  controllers: [PaymentController], // Solo para el Webhook
})
export class PaymentModule {}
```

**Importar en OrdersModule:**
```typescript
// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [PaymentModule], // 👈 Importar el módulo de pagos
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
```

---

## 3. La Lógica de Negocio (PaymentService)

**Cambio clave**: Tu `createPreference` ya no debe recibir datos sueltos del frontend, sino una **Orden Real** de tu base de datos.

```typescript
// src/payment/payment.service.ts
import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
    });
  }

  // 👇 Recibe la ORDEN completa, no un DTO suelto
  async createPreference(order: Order) {
    // 1. Validar que la orden exista y esté pendiente
    if (order.status !== 'PENDING') {
      throw new Error('Orden no válida para crear preferencia');
    }

    const preference = new Preference(this.client);

    const preferenceData = {
      // Mapeas tus productos de la BD a items de MP
      items: order.items.map(item => ({
        id: item.productId,
        title: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.price), // Asegúrate que sean números
        currency_id: 'PEN',
      })),
      
      // Datos del usuario real
      payer: {
        email: order.user.email,
        name: order.user.fullName,
      },

      // ⚠️ VITAL: El nexo entre MP y tu BD
      external_reference: order.id.toString(), // ID de tu base de datos

      back_urls: {
        success: `${process.env.FRONTEND_URL}/payment/success`,
        failure: `${process.env.FRONTEND_URL}/payment/failure`,
        pending: `${process.env.FRONTEND_URL}/payment/pending`,
      },
      
      auto_return: 'approved',
      
      // Sin payment_methods para aceptar Yape/Todo
      notification_url: `${process.env.API_URL}/payment/webhook`, 
    };

    const response = await preference.create({ body: preferenceData });
    return response.id;
  }

  // Método auxiliar para obtener info del pago
  async getPaymentInfo(paymentId: string) {
    const payment = new Payment(this.client);
    return await payment.get({ id: paymentId });
  }
}
```

---

## 4. El Webhook: Donde se cierra el círculo

Esta es la parte **crítica** que conecta Mercado Pago con tu Base de Datos. El Webhook es el encargado de marcar la orden como pagada.

```typescript
// src/payment/payment.controller.ts
import { Controller, Post, Body, Inject } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { OrdersService } from '../orders/orders.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    const { type, data } = body;

    if (type === 'payment') {
      try {
        // 1. Consultar a MP el estado real
        const payment = await this.paymentService.getPaymentInfo(data.id);
        
        // 2. Extraer tu ID de orden
        const orderId = payment.external_reference;

        // 3. Actualizar tu Base de Datos
        if (payment.status === 'approved') {
          // 👇 Esto es lo que faltaba en la prueba
          await this.ordersService.markAsPaid(orderId, {
            paymentMethod: 'MercadoPago',
            transactionId: payment.id,
            paymentData: payment, // Opcional: guardar toda la info
          });
          
          console.log(`💰 Orden ${orderId} pagada y actualizada en BD`);
        }

        return { received: true };
      } catch (error) {
        console.error('Error procesando webhook:', error);
        return { received: false };
      }
    }

    return { received: true };
  }
}
```

**No olvides inyectar OrdersService en PaymentModule:**
```typescript
// src/payment/payment.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)], // 👈 Importar para usar OrdersService
  providers: [PaymentService],
  exports: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
```

---

## 5. Implementación en OrdersService

```typescript
// src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private paymentService: PaymentService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    // 1. Crear orden en BD con estado PENDING
    const order = this.orderRepository.create({
      ...createOrderDto,
      userId,
      status: 'PENDING',
    });
    
    await this.orderRepository.save(order);

    // 2. Crear preferencia de pago
    const preferenceId = await this.paymentService.createPreference(order);

    return {
      orderId: order.id,
      preferenceId,
    };
  }

  async markAsPaid(orderId: string, paymentInfo: any) {
    // Buscar la orden
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // Validar que no esté ya pagada (Idempotencia)
    if (order.status === 'PAID') {
      console.log(`⚠️ Orden ${orderId} ya estaba pagada. Ignorando webhook duplicado.`);
      return order;
    }

    // Actualizar estado
    order.status = 'PAID';
    order.paymentMethod = paymentInfo.paymentMethod;
    order.transactionId = paymentInfo.transactionId;
    order.paidAt = new Date();

    await this.orderRepository.save(order);

    // Aquí puedes agregar lógica adicional:
    // - Enviar email de confirmación
    // - Actualizar inventario
    // - Crear factura
    
    return order;
  }
}
```

---

## 6. Resumen: ¿Qué es lo IMPORTANTE?

### 🔑 Conceptos Clave

1. **`external_reference`**: Es el campo **MÁS IMPORTANTE**. Ahí pones el ID de tu orden (UUID o ID SQL). Sin esto, cuando Mercado Pago te avise del pago, no sabrás a quién entregarle el producto.

2. **Seguridad**: **NUNCA** crees la preferencia con el precio que te manda el frontend. 
   - ❌ **MAL**: Frontend envía `{ productId: 5, price: 1.00 }` (usuario editó el HTML)
   - ✅ **BIEN**: Frontend envía `{ productId: 5 }` → Backend busca el precio real en BD

3. **Idempotencia**: Tu Webhook debe estar preparado para recibir la **misma notificación dos veces** (Mercado Pago a veces reintenta). Asegúrate de que tu lógica de `markAsPaid` no falle si la orden ya estaba pagada.

4. **Webhook Security**: Considera validar que el webhook venga realmente de Mercado Pago usando firmas (opcional pero recomendado en producción).

---

## 7. Testing Local del Webhook

Para probar el webhook en desarrollo local, usa **ngrok** o **localtunnel**:

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer tu servidor local
ngrok http 3000

# Usar la URL en MP: https://xxxx.ngrok.io/payment/webhook
```

---

## 8. Checklist Final

- [ ] Variables de entorno configuradas
- [ ] `PaymentModule` exporta `PaymentService`
- [ ] `OrdersModule` importa `PaymentModule`
- [ ] `createPreference` recibe una orden de BD, no datos del frontend
- [ ] `external_reference` guarda el ID de la orden
- [ ] Webhook actualiza el estado de la orden en BD
- [ ] Validación de idempotencia en `markAsPaid`
- [ ] URLs de webhook y back_urls configuradas
- [ ] Probado con ngrok en desarrollo

---

## 9. Recursos Adicionales

- [Documentación Oficial de Mercado Pago](https://www.mercadopago.com.pe/developers/es/docs)
- [SDK de Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Brick de Checkout](https://www.mercadopago.com.pe/developers/es/docs/checkout-bricks/landing)

---
    