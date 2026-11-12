import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

/** ชื่อ connection ของฐาน OPS ใช้กับ @InjectDataSource(OPS_CONNECTION) หรือ TypeOrmModule.forFeature([...], OPS_CONNECTION) */
export const OPS_CONNECTION = 'ops';

/**
 * ทุกฐานข้อมูลอยู่ SQL Server เดียวกัน (DB_HOST/DB_USER/DB_PASSWORD ชุดเดียว)
 * ต่างกันแค่ชื่อฐานข้อมูล: databaseEnvKey = ชื่อตัวแปรที่เก็บชื่อฐาน เช่น 'DB_NAME', 'OPS_DB_NAME'
 */
function mssqlOptions(config: ConfigService, databaseEnvKey: string, poolMax = 10): TypeOrmModuleOptions {
  const database = config.getOrThrow<string>(databaseEnvKey);
  const host = config.getOrThrow<string>('DB_HOST');
  const port = Number(config.get('DB_PORT') ?? 1433);

  new Logger('Database').log(`เชื่อมต่อ ${host}:${port} / ${database}`);

  return {
    type: 'mssql',
    host,
    port,
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database,
    autoLoadEntities: true, // entity ที่ลงทะเบียนด้วย forFeature(..., ชื่อ connection) ในแต่ละโมดูล
    synchronize: false, // ตารางสร้างด้วย SQL เอง ห้ามให้ TypeORM แก้ schema
    retryAttempts: 5,
    retryDelay: 3000,
    connectionTimeout: Number(config.get('DB_CONNECTION_TIMEOUT_MS') ?? 15000),
    requestTimeout: Number(config.get('DB_REQUEST_TIMEOUT_MS') ?? 30000),
    pool: { max: poolMax, min: 1, idleTimeoutMillis: 30000 }, // เชื่อมครั้งเดียวตอนสตาร์ท แล้วใช้ pool ร่วมกัน
    options: {
      encrypt: config.get('DB_ENCRYPT') === 'true',
      trustServerCertificate: config.get('DB_TRUST_CERT') !== 'false',
    },
  };
}

/**
 *  - default : ฐานของ Smart Tracker       (DB_NAME)
 *  - 'ops'   : ฐานของ OPS (อ่านอย่างเดียว) (OPS_DB_NAME)
 *
 * เพิ่มฐานใหม่: ใส่ XXX_DB_NAME ใน .env แล้วเพิ่ม forRootAsync({ name: 'xxx', ... }) อีกบรรทัด
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => mssqlOptions(config, 'DB_NAME'),
    }),
    TypeOrmModule.forRootAsync({
      name: OPS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => mssqlOptions(config, 'OPS_DB_NAME', 5),
    }),
  ],
})
export class DatabaseModule {}
