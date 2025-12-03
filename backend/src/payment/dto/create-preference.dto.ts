import { IsString, IsNumber, IsEmail, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ItemDto {
  @IsString()
  title: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unit_price: number;

  @IsString()
  currency_id: string = 'PEN';
}


export class CreatePreferenceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsString()
  orderId: string;

  @IsEmail()
  customerEmail: string;
}