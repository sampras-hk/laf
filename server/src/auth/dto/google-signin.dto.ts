import { ApiProperty } from '@nestjs/swagger'
import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsEmail,
} from 'class-validator'

export class GoogleSigninDto {
  @ApiProperty({
    description: 'email',
    example: 'test@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description: 'name',
    example: 'chan dai man',
  })
  @IsOptional()
  @IsString()
  @Length(3, 64)
  name: string

  @ApiProperty({
    description: 'Google User Id',
    example: '123221313231231321321',
  })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  userId: string
}
