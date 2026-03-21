export interface RedisServer {
  id: number
  name: string
  host: string
  port: number
  use_tls: boolean
  db_index: number
  has_password: boolean
}

export interface RedisServerCreatePayload {
  name: string
  host: string
  port: number
  use_tls: boolean
  db_index: number
  password?: string
}

export interface RedisServerUpdatePayload {
  name?: string
  host?: string
  port?: number
  use_tls?: boolean
  db_index?: number
  password?: string
}
