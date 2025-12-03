import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';  // ← AGREGADO
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [ConfigModule],  // ← AGREGADO: Importa ConfigModule
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}