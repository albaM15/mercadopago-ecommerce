import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilita CORS para el frontend
  app.enableCors({
    origin:  [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173',
    ],
    credentials: true,
  });

  // Habilita validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
}
bootstrap();