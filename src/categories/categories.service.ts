import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find();
  }

  async create(data: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async seedCategories(): Promise<void> {
    const categories = [
      { name: 'Repostería y Pastelería', icon: '🎂' },
      { name: 'Comida y Restaurantes', icon: '🍽️' },
      { name: 'Servicios Profesionales', icon: '🔧' },
      { name: 'Belleza y Estética', icon: '💅' },
      { name: 'Hogar y Construcción', icon: '🏠' },
      { name: 'Salud y Bienestar', icon: '💊' },
      { name: 'Educación', icon: '📚' },
      { name: 'Tecnología', icon: '💻' },
      { name: 'Eventos y Entretenimiento', icon: '🎉' },
      { name: 'Otros', icon: '📦' },
    ];

    for (const cat of categories) {
      const exists = await this.categoryRepository.findOne({ where: { name: cat.name } });
      if (!exists) {
        await this.create(cat);
      }
    }
  }
}