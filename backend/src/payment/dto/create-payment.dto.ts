import { IsString, IsNumber, IsEmail } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  token: string;

  @IsString()
  paymentMethodId: string;

  @IsEmail()
  email: string;

  @IsNumber()
  transactionAmount: number;

  @IsNumber()
  installments: number;

  @IsString()
  orderId: string;

  // Datos del pagador
  payer?: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}