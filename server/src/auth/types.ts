export enum AuthBindingType {
  Required = 'required',
  Optional = 'optional',
  None = 'none',
}

export enum SmsVerifyCodeState {
  Active = 0,
  Used = 1,
}

export enum UserPasswordState {
  Active = 'Active',
  Inactive = 'Inactive',
}

export interface AuthProviderBinding {
  username: AuthBindingType
  phone: AuthBindingType
  email: AuthBindingType
  github: AuthBindingType
  wechat: AuthBindingType
  google: AuthBindingType
}

export interface AlismsConfig {
  accessKeyId: string
  accessKeySecret: string
  endpoint: string
  signName: string
  templateCode: string
}
