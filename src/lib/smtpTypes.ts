export type SmtpProviderType = "custom" | "brevo" | "gmail" | "cpanel" | "outlook";

export interface SmtpConfig {
  isEnabled: boolean;
  provider: SmtpProviderType;
  host: string;
  port: number;
  secure: boolean; // true for 465, false for 587/25
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  useBrevoFallback: boolean;
}

export interface SmtpPublicConfig extends Omit<SmtpConfig, "pass"> {
  hasPassword?: boolean;
}

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  isEnabled: false,
  provider: "custom",
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  fromEmail: "",
  fromName: "Imperial IT",
  replyTo: "",
  useBrevoFallback: true,
};

export const SMTP_PRESETS: Record<
  SmtpProviderType,
  {
    name: string;
    host: string;
    port: number;
    secure: boolean;
    hint: string;
  }
> = {
  gmail: {
    name: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    hint: "Use your full Gmail address and a 16-character Google App Password (not your personal account password). Enable 2-Step Verification in Google Account -> Security -> App passwords.",
  },
  brevo: {
    name: "Brevo (Sendinblue)",
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    hint: "Use your Brevo SMTP login username (e.g. b866f6001@smtp-brevo.com) and Brevo SMTP Master Key.",
  },
  cpanel: {
    name: "cPanel / Webmail / Hostinger",
    host: "mail.yourdomain.com",
    port: 465,
    secure: true,
    hint: "Usually uses Port 465 (SSL) or Port 587 (TLS). Enter your cPanel or custom domain webmail email and password.",
  },
  outlook: {
    name: "Outlook / Office 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    hint: "Uses Port 587 with STARTTLS. Use your Microsoft 365 or Outlook email and password / App Password.",
  },
  custom: {
    name: "Custom SMTP Server",
    host: "",
    port: 587,
    secure: false,
    hint: "Enter the hostname and credentials provided by your email or cloud hosting provider.",
  },
};
