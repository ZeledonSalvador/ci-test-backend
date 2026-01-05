import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterMillDto {
  @IsNotEmpty()
  @IsString()
  ingenioCode: string;

  @IsNotEmpty()
  @IsString()
  ingenioNavCode: string

  @IsNotEmpty()
  @IsString()
  username: string;


  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

