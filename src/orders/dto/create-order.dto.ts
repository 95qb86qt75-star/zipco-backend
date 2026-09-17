import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'orderDeliverySelection', async: false })
class OrderDeliverySelectionConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, arguments_: ValidationArguments): boolean {
    const order = arguments_.object as CreateOrderDto;
    if (typeof order.needNow !== 'boolean') return false;
    if (order.needNow) {
      return order.deliveryDate == null && order.deliveryTime == null;
    }
    return (
      typeof order.deliveryDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(order.deliveryDate) &&
      typeof order.deliveryTime === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(order.deliveryTime)
    );
  }

  defaultMessage(): string {
    return 'Selecciona entrega inmediata o una fecha y hora validas';
  }
}

export class CreateOrderItemDto {
  @IsInt()
  @Min(1)
  catalogItemId: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  businessId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((item: CreateOrderItemDto) => item.catalogItemId)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;

  @IsBoolean()
  @Validate(OrderDeliverySelectionConstraint)
  needNow: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deliveryDate?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  deliveryTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  referencePhoto?: string | null;
}
