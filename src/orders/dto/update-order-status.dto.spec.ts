import { validate } from 'class-validator';
import { UpdateOrderStatusDto } from './update-order-status.dto';

describe('UpdateOrderStatusDto', () => {
  it.each(['pending', 'accepted', 'rejected', 'ready', 'completed'])(
    'accepts the valid status %s without a cancellation reason',
    async (status) => {
      const dto = Object.assign(new UpdateOrderStatusDto(), { status });

      expect(await validate(dto)).toEqual([]);
    },
  );

  it('accepts a valid cancellation', async () => {
    const dto = Object.assign(new UpdateOrderStatusDto(), {
      status: 'cancelled',
      cancellationReason: 'selected_by_mistake',
    });

    expect(await validate(dto)).toEqual([]);
  });

  it.each(['no_longer_needed', 'business_took_too_long'])(
    'accepts cancellation reason %s',
    async (cancellationReason) => {
      const dto = Object.assign(new UpdateOrderStatusDto(), {
        status: 'cancelled',
        cancellationReason,
      });

      expect(await validate(dto)).toEqual([]);
    },
  );

  it('rejects a missing status', async () => {
    const errors = await validate(new UpdateOrderStatusDto());

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects an unknown status', async () => {
    const dto = Object.assign(new UpdateOrderStatusDto(), {
      status: 'unknown',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects cancellation without a reason', async () => {
    const dto = Object.assign(new UpdateOrderStatusDto(), {
      status: 'cancelled',
    });
    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'cancellationReason'),
    ).toBe(true);
  });

  it('rejects cancellation with an unknown reason', async () => {
    const dto = Object.assign(new UpdateOrderStatusDto(), {
      status: 'cancelled',
      cancellationReason: 'other',
    });
    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'cancellationReason'),
    ).toBe(true);
  });

  it('does not validate cancellationReason for another transition', async () => {
    const dto = Object.assign(new UpdateOrderStatusDto(), {
      status: 'accepted',
      cancellationReason: 'ignored-value',
    });

    expect(await validate(dto)).toEqual([]);
  });
});
