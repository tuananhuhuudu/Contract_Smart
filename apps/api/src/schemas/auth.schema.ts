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
