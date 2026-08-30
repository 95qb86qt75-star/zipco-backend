import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Business } from './business.entity';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

describe('BusinessesController', () => {
  let controller: BusinessesController;
  let businessesService: Pick<
    BusinessesService,
    'approve' | 'reject' | 'create' | 'update'
  >;

  const approvedBusiness = {
    id: 1,
    name: 'Donde el Rudy',
    status: 'approved',
  } as Business;

  const rejectedBusiness = {
    id: 1,
    name: 'Donde el Rudy',
    status: 'rejected',
  } as Business;

  beforeEach(async () => {
    businessesService = {
      approve: jest.fn().mockResolvedValue(approvedBusiness),
      reject: jest.fn().mockResolvedValue(rejectedBusiness),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [{ provide: BusinessesService, useValue: businessesService }],
    }).compile();

    controller = module.get<BusinessesController>(BusinessesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() discards internal fields and keeps categoryId', () => {
    const unsafePayload = {
      name: 'Bicicletas Maria',
      categoryId: 5,
      status: 'approved',
      userId: 999,
      id: 999,
      createdAt: new Date(),
    } as unknown as CreateBusinessDto;

    controller.create(unsafePayload, { user: { id: 10, role: 'user' } });

    expect(businessesService.create).toHaveBeenCalledWith({
      name: 'Bicicletas Maria',
      categoryId: 5,
      userId: 10,
    });
  });

  it('update() discards internal fields and keeps categoryId', () => {
    const unsafePayload = {
      name: 'Bicicletas Maria',
      categoryId: 5,
      status: 'approved',
      userId: 999,
      id: 999,
      createdAt: new Date(),
    } as unknown as UpdateBusinessDto;

    controller.update(1, unsafePayload, { user: { id: 10, role: 'user' } });

    expect(businessesService.update).toHaveBeenCalledWith(
      1,
      { name: 'Bicicletas Maria', categoryId: 5 },
      { id: 10, role: 'user' },
    );
  });

  it("approve() throws ForbiddenException when req.user.role is not 'admin'", () => {
    expect(() =>
      controller.approve(1, { user: { id: 10, role: 'user' } }),
    ).toThrow(ForbiddenException);

    expect(businessesService.approve).not.toHaveBeenCalled();
  });

  it("approve() calls businessesService.approve(id) when req.user.role is 'admin'", async () => {
    await expect(
      controller.approve(1, { user: { id: 99, role: 'admin' } }),
    ).resolves.toEqual(approvedBusiness);

    expect(businessesService.approve).toHaveBeenCalledWith(1);
  });

  it("reject() throws ForbiddenException when req.user.role is not 'admin'", () => {
    expect(() =>
      controller.reject(1, { user: { id: 10, role: 'user' } }),
    ).toThrow(ForbiddenException);

    expect(businessesService.reject).not.toHaveBeenCalled();
  });

  it("reject() calls businessesService.reject(id) when req.user.role is 'admin'", async () => {
    await expect(
      controller.reject(1, { user: { id: 99, role: 'admin' } }),
    ).resolves.toEqual(rejectedBusiness);

    expect(businessesService.reject).toHaveBeenCalledWith(1);
  });
});
