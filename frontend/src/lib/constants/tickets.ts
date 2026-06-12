// Support ticket status & priority badge configs and filter options.
// Single source of truth shared across all support pages (user + admin).

export const ticketStatusConfig: Record<string, { className: string; label: string }> = {
  OPEN: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Open',
  },
  IN_PROGRESS: {
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'In Progress',
  },
  RESOLVED: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Resolved',
  },
  CLOSED: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    label: 'Closed',
  },
};

export const ticketPriorityConfig: Record<string, { className: string }> = {
  LOW: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  MEDIUM: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  HIGH: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  URGENT: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

// Status filter options (leading ALL sentinel).
export const TICKET_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

// Status values for the admin status-change select (no sentinel).
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
