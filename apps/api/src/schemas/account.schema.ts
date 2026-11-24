import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length } from "class-validator";
import { USER_ROLES } from "../models/user.entity";
import { ListQueryDto } from "./base.schema";
import { VersionedDto } from "./common.schema";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

/** POST /organizations: a new company with its first administrator. */
export class CreateOrganizationDto {
  /** Công ty ABC */
  @IsString() @Length(1, 200) name!: string;
  @IsIn(["BUYER", "SUPPLIER"]) type!: "BUYER" | "SUPPLIER";
  /** admin@abc.vn */
  @Transform(lower) @IsEmail() adminEmail!: string;
  @IsString() @Length(1, 200) adminName!: string;
  /** At least 8 characters; the administrator changes it after logging in. */
  @IsString() @Length(8, 200) adminPassword!: string;
}

/** PATCH /organizations/:id: lock (active = false) or unlock a company. */
export class UpdateOrganizationDto extends VersionedDto {
  @IsBoolean() active!: boolean;
}

/** GET /users */
export class UserListQuery extends ListQueryDto {
  /** Platform administrator only: accounts of one company. */
  @IsOptional() @Type(() => Number) @IsInt() organizationId?: number;
  @IsOptional() @IsIn(USER_ROLES) role?: (typeof USER_ROLES)[number];
  /** Part of the email or name. */
  @IsOptional() @IsString() q?: string;
}

/** POST /users */
export class CreateUserDto {
  @Transform(lower) @IsEmail() email!: string;
  @IsString() @Length(1, 200) fullName!: string;
  @IsString() @Length(8, 200) password!: string;
  @IsIn(USER_ROLES) role!: (typeof USER_ROLES)[number];
  /** Platform administrator creating a company administrator: which company. */
  @IsOptional() @Type(() => Number) @IsInt() organizationId?: number;
}

/** PATCH /users/:id */
export class UpdateUserDto extends VersionedDto {
  @IsOptional() @IsString() @Length(1, 200) fullName?: string;
  @IsOptional() @IsIn(USER_ROLES) role?: (typeof USER_ROLES)[number];
  @IsOptional() @IsBoolean() active?: boolean;
}

/** POST /users/:id/reset-password */
export class ResetPasswordDto {
  @IsString() @Length(8, 200) password!: string;
}

/** POST /auth/change-password */
export class ChangePasswordDto {
  @IsString() @Length(1, 200) currentPassword!: string;
  @IsString() @Length(8, 200) newPassword!: string;
}
