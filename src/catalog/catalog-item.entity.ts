import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../businesses/business.entity';

export enum CatalogItemKind {
  PRODUCT = 'product',
  SERVICE = 'service',
}

export enum CatalogItemPricingMode {
  FIXED_PRICE = 'fixed_price',
  QUOTE = 'quote',
  VIEW = 'view',
}

@Entity('catalog_item')
@Index('IDX_catalog_item_business_active_order', [
  'businessId',
  'isActive',
  'displayOrder',
])
@Check('CHK_catalog_item_display_order', '"displayOrder" >= 0')
@Check('CHK_catalog_item_name_not_blank', 'length(btrim("name")) > 0')
@Check(
  'CHK_catalog_item_pricing',
  `(\"pricingMode\" = 'fixed_price' AND \"priceClp\" IS NOT NULL AND \"priceClp\" > 0 AND \"startingPriceClp\" IS NULL)
   OR (\"pricingMode\" = 'quote' AND \"priceClp\" IS NULL AND (\"startingPriceClp\" IS NULL OR \"startingPriceClp\" > 0))
   OR (\"pricingMode\" = 'view' AND \"priceClp\" IS NULL AND \"startingPriceClp\" IS NULL)`,
)
export class CatalogItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessId: number;

  @ManyToOne(() => Business, (business) => business.catalogItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: CatalogItemKind })
  kind: CatalogItemKind;

  @Column({ type: 'enum', enum: CatalogItemPricingMode })
  pricingMode: CatalogItemPricingMode;

  @Column({ type: 'integer', nullable: true })
  priceClp: number | null;

  @Column({ type: 'integer', nullable: true })
  startingPriceClp: number | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
