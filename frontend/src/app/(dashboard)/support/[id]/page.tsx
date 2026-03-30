'use client';

import { use, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getTicket, addTicketMessage } from '@/lib/api/support';
import type { TicketMessageResponse } from '@/lib/api/support';
import { ApiError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, cn } from '@/lib/utils';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const statusConfig: Record<string, { className: string; label: string }> = {
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

const priorityConfig: Record<string, { className: string }> = {
  LOW: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  MEDIUM: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  HIGH: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  URGENT: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

function MessageBubble({ message }: Readonly<{ message: TicketMessageResponse }>) {
  return (
    <div className={cn('flex', message.isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 space-y-1',
          message.isAdmin
            ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
            : 'bg-muted',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {message.isAdmin ? 'Support Team' : message.username}
          </span>
          <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  );
}

export default function TicketDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => addTicketMessage(id, body),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ['tickets', id] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send message');
    },
  });

  const { register, handleSubmit, reset } = useForm<{ body: string }>();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/support">Back to support</Link>
        </Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const statusCfg = statusConfig[ticket.status] ?? { className: '', label: ticket.status };
  const priorityCfg = priorityConfig[ticket.priority] ?? { className: '' };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/support">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground font-mono">{ticket.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ticket Information</CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary" className={priorityCfg.className}>
                {ticket.priority}
              </Badge>
              <Badge variant="secondary" className={statusCfg.className}>
                {statusCfg.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{ticket.description}</p>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p>{formatDate(ticket.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No messages yet. Send a message to start the conversation.
              </p>
            ) : (
              ticket.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed && (
            <>
              <Separator className="my-4" />
              <form
                onSubmit={handleSubmit((data) => sendMutation.mutate(data.body))}
                className="flex gap-2"
              >
                <Textarea
                  placeholder="Type your message…"
                  rows={2}
                  className="flex-1"
                  {...register('body', { required: true, minLength: 1 })}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sendMutation.isPending}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          {isClosed && (
            <p className="text-sm text-muted-foreground text-center py-4 mt-4">
              This ticket is closed. You cannot send new messages.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
