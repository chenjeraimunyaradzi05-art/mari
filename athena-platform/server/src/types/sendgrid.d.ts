// Type declarations for @sendgrid/mail
declare module '@sendgrid/mail' {
  interface MailContent {
    type: string;
    value: string;
  }

  interface MailData {
    to: string | string[] | { email: string; name?: string } | Array<{ email: string; name?: string }>;
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
    content?: MailContent[];
    templateId?: string;
    dynamicTemplateData?: Record<string, any>;
  }

  interface MailService {
    setApiKey(apiKey: string): void;
    send(data: MailData): Promise<[any, any]>;
  }

  const mail: MailService;
  export default mail;
}
