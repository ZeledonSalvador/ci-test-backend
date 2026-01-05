import { IsEmail, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class SendEmailDto {

  @IsEmail()
  @IsNotEmpty()
  to: string;

  username: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  templateData?: any;
}