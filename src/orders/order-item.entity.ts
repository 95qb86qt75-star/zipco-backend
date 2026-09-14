import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogItem } from '../catalog/catalog-item.entity';
import { Order } from './order.entity';

@Entity('order_item')
@Index('IDX_order_item_order', ['orderId'])
@Index('IDX_order_item_catalog_item', ['catalogItemId'])
@Check('CHK_order_item_quantity', '"quantity" BETWEEN 1 AND 99')
@Check(
  'CHK_order_item_prices',
  '"unitPriceClpSnapshot" > 0 AND "subtotalClp" > 0 AND "subtotalClp" = "unitPriceClpSnapshot" * "quantity"',
)
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  catalogItemId: number | null;

  @ManyToOne(() => CatalogItem, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'catalogItemId' })
  catalogItem: CatalogItem | null;

  @Column({ type: 'varchar', length: 120 })
  nameSnapshot: string;

  @Column({ type: 'integer' })
  unitPriceClpSnapshot: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  subtotalClp: number;
}
