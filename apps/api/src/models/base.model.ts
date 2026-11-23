import { Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from "typeorm";

/**
 * Columns every table shares (like BareBaseModel in model_base.py). Each table extends it and
 * declares its own primary key, because tables use business codes (GOODS_SUPPLY, CT0001...).
 */
export abstract class BaseModel {
  @Column({
    type: "text",
    default: "APP",
    comment: "Nguồn dòng: DATA_PACK (dữ liệu đề), SEED (dữ liệu mẫu), APP (tạo trong ứng dụng).",
  })
  origin!: string;

  /** Optimistic lock: TypeORM adds 1 on every update; a stale version gives 409 (BaseRepository). */
  @VersionColumn({ default: 1, comment: "Số phiên bản, tăng mỗi lần sửa (khóa lạc quan)." })
  version!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz", comment: "Thời điểm tạo dòng." })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", comment: "Thời điểm sửa gần nhất." })
  updatedAt!: Date;
}

/** CHECK on the origin column; every entity lists it, because CHECKs are not inherited. */
export const ORIGIN_CHECK = `"origin" IN ('DATA_PACK', 'SEED', 'APP')`;
