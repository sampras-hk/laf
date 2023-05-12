import { Injectable, Logger } from '@nestjs/common'
import { User } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { SmsService } from 'src/auth/phone/sms.service'
import { UserService } from 'src/user/user.service'
import { AuthenticationService } from '../authentication.service'
import { hashPassword } from 'src/utils/crypto'
import { OAuth2Client } from 'google-auth-library'
import { GoogleSigninDto } from '../dto/google-signin.dto'
import { randomBytes } from 'crypto'

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    private readonly authService: AuthenticationService,
  ) {}

  /**
   * Signup a user by phone
   * @param dto
   * @returns
   */
  async signup(dto: GoogleSigninDto, withUsername = false) {
    const { email, name } = dto

    // start transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // create user
      const user = await tx.user.create({
        data: {
          username: email,
          profile: { create: { name } },
        },
      })
      if (!withUsername) {
        return user
      }
      // create password if need
      await tx.userPassword.create({
        data: {
          uid: user.id,
          password: hashPassword(randomBytes(20).toString('hex')),
          state: 'Active',
        },
      })
      return user
    })
    return user
  }

  /**
   * signin a user, return token and if bind password
   * @param user user
   * @returns token and if bind password
   */
  signin(user: User) {
    const token = this.authService.getAccessTokenByUser(user)
    return token
  }

  // check if current user has bind password
  async ifBindPassword(user: User) {
    const count = await this.prisma.userPassword.count({
      where: {
        uid: user.id,
        state: 'Active',
      },
    })

    if (count === 0) {
      return false
    }
    return true
  }

  async validateGoogleIdToken(token: string): Promise<any> {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID) // Replace with your Google Client ID

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID, // Replace with your Google Client ID
    })

    const payload = ticket.getPayload()

    // Payload contains the user profile information
    const userid = payload['sub']
    const email = payload['email']
    const name = payload['name']
    const picture = payload['picture']

    // You can return the user profile info or use it to check if the user exists in your database
    // Here we are simply returning it
    return {
      userId: userid,
      email: email,
      name: name,
      picture: picture,
    }
  }
}
