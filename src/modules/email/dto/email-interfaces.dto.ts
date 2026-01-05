// En tu archivo dto/email-interfaces.dto.ts
export interface NotificationConfig {
  // Templates
  templateName?: string;
  templatesByRole?: Record<number, string>;
  
  // Destinatarios
  codigos?: string[];           // Modo 1: Lista de códigos específicos
  roles?: number[];             // Modo 2: Lista de roles
  roleFilters?: Record<number, string[]>; // Modo 3: Roles con códigos específicos
  
  // Modo 4: Configuración mixta
  mixedTargets?: {
    allUsersInRoles?: number[];            // Roles donde se envía a TODOS los usuarios
    specificUsers?: Record<number, string[]>; // Roles con códigos específicos
    specificCodes?: string[];              // Códigos individuales sin importar rol
  };
  
  // Contenido
  subject: string;
  templateData: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface NotificationResult {
  success: boolean;
  message: string;
  sentCount: number;
  details: Array<{
    recipient: string;
    role: number;
    codigo: string;
    templateUsed: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  messageId?: string;
}

export interface NotificationDetail {
  recipient: string;
  role: number;
  codigo: string;
  templateUsed: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface EmailTemplateData {
  [key: string]: any;
  recipientName?: string;
  recipientRole?: number;
  recipientCodigo?: string;
  currentYear?: number;
  fromName?: string;
  currentDate?: string;
}

export interface EmailNotificationData {
  templateName?: string;
  templatesByRole?: Record<number, string>;
  codigos?: string[];
  roles?: number[];
  roleFilters?: Record<number, string[]>;
  mixedTargets?: {
    allUsersInRoles?: number[];
    specificUsers?: Record<number, string[]>;
    specificCodes?: string[];
  };
  subject: string;
  templateData: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}