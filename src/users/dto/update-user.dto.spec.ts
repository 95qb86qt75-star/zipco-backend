import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('accepts allowed profile fields', async () => {
    const dto = Object.assign(new UpdateUserDto(), {
      name: 'Maria',
      location: 'Coronel',
      photo: 'https://example.com/photo.jpg',
    });
    expect(await validate(dto)).toEqual([]);
  });
});
