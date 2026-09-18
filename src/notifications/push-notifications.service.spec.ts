import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { Order } from '../orders/order.entity';
import { PushSubscription } from './push-subscription.entity';
import { PushNotificationsService } from './push-notifications.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushNotificationsService', () => {
  const originalEnv = process.env;
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      VAPID_PUBLIC_KEY: 'public-test-key',
      VAPID_PRIVATE_KEY: 'private-test-key',
      VAPID_SUBJECT: 'mailto:qa@example.com',
    };
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      delete: jest.fn(),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createService = () =>
    new PushNotificationsService(
      repository as unknown as Repository<PushSubscription>,
    );

  it('exposes only the public VAPID key', () => {
    const service = createService();
    expect(service.getPublicKey()).toEqual({ publicKey: 'public-test-key' });
    expect(webPush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:qa@example.com',
      'public-test-key',
      'private-test-key',
    );
  });

  it('binds a subscription to the authenticated user', async () => {
    repository.findOne.mockResolvedValue({ id: 8, userId: 2 });
    const service = createService();
    await service.save(9, {
      endpoint: 'https://push.example/subscription',
      p256dh: '1234567890123456',
      auth: '12345678',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 8, userId: 9 }),
    );
  });

  it('sends the order only to subscriptions belonging to the owner', async () => {
    repository.find.mockResolvedValue([
      {
        id: 3,
        endpoint: 'https://push.example/owner',
        p256dh: 'public-device-key',
        auth: 'device-auth',
      },
    ]);
    jest.mocked(webPush.sendNotification).mockResolvedValue({} as never);
    const service = createService();
    await service.notifyNewOrder(
      { id: 14, customerName: 'Cliente QA', total: 12000 } as Order,
      27,
    );
    expect(repository.find).toHaveBeenCalledWith({ where: { userId: 27 } });
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/owner' }),
      expect.stringContaining('"orderId":14'),
    );
  });

  it('removes a subscription rejected permanently by the push service', async () => {
    repository.find.mockResolvedValue([
      {
        id: 3,
        endpoint: 'https://push.example/expired',
        p256dh: 'public-device-key',
        auth: 'device-auth',
      },
    ]);
    jest.mocked(webPush.sendNotification).mockRejectedValue({ statusCode: 410 });
    const service = createService();
    await service.notifyNewOrder(
      { id: 15, customerName: null, total: 12000 } as Order,
      27,
    );
    expect(repository.delete).toHaveBeenCalledWith({ id: 3 });
  });
});
