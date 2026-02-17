export interface EmailProvider {
  send(params: { to: string; subject: string; body: string }): Promise<void>;
}
