import { SmsService } from 'src/auth/phone/sms.service'
import { Body, Controller, Logger, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ResponseUtil } from 'src/utils/response'
import { AuthenticationService } from '../authentication.service'
import { UserService } from 'src/user/user.service'
import { GoogleService } from './google.service'

@ApiTags('Authentication - New')
@Controller('auth')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name)

  constructor(
    private readonly googleService: GoogleService,
    private readonly smsService: SmsService,
    private readonly authService: AuthenticationService,
    private readonly userService: UserService,
  ) {}

  /**
   * Signin by google
   */
  @ApiOperation({ summary: 'Signin by google' })
  @ApiResponse({ type: ResponseUtil })
  @Post('google/signin')
  async signin(@Body() dto: any) {
    const { credential } = dto

    const userObj = await this.googleService.validateGoogleIdToken(credential)

    const user = await this.userService.find(userObj.email)
    if (user) {
      const token = this.googleService.signin(user)
      return ResponseUtil.ok(token)
    }

    const newUser = await this.googleService.signup(userObj)
    const data = this.googleService.signin(newUser)
    return ResponseUtil.ok(data)
  }
}
