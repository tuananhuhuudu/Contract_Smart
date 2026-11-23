import { CreateDateColumn, UpdateDateColumn, VersionColumn } from "typeorm";

/**
 * Columns every table shares (like BareBaseModel in model_base.py). Each table extends it and
 * declares its own primary key (a generated id).
 */
export abstract class BaseModel {
  /** Optimistic lock: TypeORM adds 1 on every update; a stale version gives 409 (BaseRepository). */
  @VersionColumn({ default: 1, comment: "Số phiên bản, tăng mỗi lần sửa (khóa lạc quan)." })
  version!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz", comment: "Thời điểm tạo dòng." })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz", comment: "Thời điểm sửa gần nhất." })
  updatedAt!: Date;
}

