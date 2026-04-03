/**
 * Unis Ticket types for the Tickets feature.
 * Aligned with the item-tickets-be OpenAPI schema.
 */

export interface TicketDTO {
  id: number;
  ticketNumber?: string;
  subject?: string;
  title?: string;
  status?: number;
  displayStatusId?: number;
  displayStatusName?: string;
  priorityId?: number;
  priorityName?: string;
  topicId?: number;
  topicName?: string;
  departmentId?: number;
  departmentName?: string;
  teamId?: number;
  teamName?: string;
  staffId?: number;
  staffName?: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  organizationId?: number;
  organizationName?: string;
  sourceChannel?: number;
  emailId?: number;
  tags?: string[];
  slaId?: number;
  slaName?: string;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  firstResponseAt?: string;
  dueDate?: string;
  isOverdue?: boolean;
  isFollowed?: boolean;
  createTime?: string;
  updateTime?: string;
  displayStatusSystemStatus?: number;
  displayStatusColor?: string;
  priorityColor?: string;
  topicTitle?: string;
}

export interface TicketDetailDto extends TicketDTO {
  description?: string;
  relatedTickets?: TicketRelationDto[];
  displayStatus?: { id: number; name: string; color?: string; systemStatus?: number };
  topicTitle?: string;
  priorityColor?: string;
  displayStatusColor?: string;
}

export interface TicketRelationDto {
  id: number;
  ticketNumber?: string;
  subject?: string;
  relationType?: string;
}

/** Timeline item — type is "MESSAGE" or "AUDIT_LOG", data is nested */
export interface TicketTimelineItemDTO {
  id: number;
  type?: string; // "MESSAGE" or "AUDIT_LOG"
  createTime?: string;
  message?: TicketMessageDto;
  auditLog?: AuditLogDTO;
}

export interface TicketMessageDto {
  id: number;
  type?: number; // 1=message, 2=system, 3=internal_note, 4=side_conversation, 5=reply
  content?: string;
  userName?: string;
  userEmail?: string;
  userType?: number; // 1=customer, 2=staff, 3=system
  userId?: number;
  sourceChannel?: number;
  attachments?: AttachmentDTO[];
  images?: AttachmentDTO[];
  firstFlag?: boolean;
  createTime?: string;
  createdAt?: string;
}

export interface AttachmentDTO {
  id: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  url?: string;
}

export interface AuditLogDTO {
  id: number;
  action?: string;
  description?: string;
  createdAt?: string;
  createTime?: string;
  staffName?: string;
  fieldChanges?: FieldChangeDTO[];
}

export interface FieldChangeDTO {
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface TicketCountStatsDto {
  /** API field: newTicketsCount */
  newTicketsCount?: number;
  /** API field: openTicketsCount */
  openTicketsCount?: number;
  /** API field: closedTicketsCount */
  closedTicketsCount?: number;
  /** API field: overdueTicketsCount */
  overdueTicketsCount?: number;
  /** API field: highPriorityTicketsCount */
  highPriorityTicketsCount?: number;
  /** API field: unassignedTicketsCount */
  unassignedTicketsCount?: number;
  /** API field: averageFirstResponseTime (seconds) */
  averageFirstResponseTime?: number;
}

export interface TicketSearchHit {
  id: number;
  ticketNumber?: string;
  subject?: string;
  title?: string;
  highlightSubject?: string;
  highlightContent?: string;
  status?: number;
  priorityName?: string;
  departmentName?: string;
  staffName?: string;
  customerName?: string;
  createdAt?: string;
  createTime?: string;
}

export interface TicketSearchDTO {
  total?: number;
  hits?: TicketSearchHit[];
}

/** Current user info from /v1/staff/auth/current — returns StaffDetailDTO */
export interface CurrentStaffDetail {
  id?: number;
  name?: string;
  email?: string;
  departments?: DepartmentOption[];
  accessibleDepartmentIds?: number[];
  teams?: { id: number; name: string }[];
}

/** Department option */
export interface DepartmentOption {
  id: number;
  name: string;
}

/** Generic paginated response wrapper from the backend */
export interface PageOutDto<T> {
  records?: T[];
  total?: number;
  page?: number;
  size?: number;
}

/** Standard API response wrapper */
export interface ResponseResult<T> {
  code?: string | number;
  msg?: string;
  data?: T;
  success?: boolean;
}

/** Report: ticket status breakdown per group (dept/staff/team) */
export interface TicketStatusReportDto {
  departmentId?: number;
  department?: string;
  teamId?: number;
  team?: string;
  staffId?: number;
  staffName?: string;
  /** Dynamic status name → count map */
  statusCounts?: Record<string, number>;
}

/** Report: ticket activity per group */
export interface TicketActivityReportDto {
  departmentId?: number;
  department?: string;
  staffId?: number;
  staffName?: string;
  processedTickets?: number;
  solvedTickets?: number;
  publicReply?: number;
  internalNote?: number;
  firstReplyTime?: number;
  totalTimeSpent?: number;
  timeSpent?: number;
}
