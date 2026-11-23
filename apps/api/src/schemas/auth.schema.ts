import { Transform } from "class-transformer";
import { IsEmail, IsString, Length } from "class-validator";

const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

/** POST /auth/login */
export class LoginDto {
  /** owner@novaan.vn */
  @Transform(lower)
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 200)
  password!: string;
}

/** POST /auth/register: a read-only account (AUDITOR) until an administrator gives it a role and a party. */
export class RegisterDto {
  @Transform(lower)
  @IsEmail()
  email!: string;

  /** At least 8 characters. */
  @IsString()
  @Length(8, 200)
  password!: string;

  @IsString()
  @Length(1, 200)
  fullName!: string;
}
